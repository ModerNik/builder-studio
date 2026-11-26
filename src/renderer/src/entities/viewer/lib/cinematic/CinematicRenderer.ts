// CinematicRenderer: dedicated Three.js post-processing renderer for the Render Studio Lightbox.
// Layers physical sky, sun shadows, emissive HDR bloom, reflective water, shadow-catcher cutouts,
// N8AO, Tilt-Shift/Focus DoF, ACES color grading, and 2x SSAA high-res export over the shared Mesher.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { N8AOPass } from 'n8ao'
import { CameraManager, SchematicObject, type Projection } from '../render/renderer'
import { fitDirectionalShadow } from '../render/look'
import { Mesher, type BlockColorMap } from '../render/mesher'
import { LIQUID, TRANSLUCENT, type Resources } from '../render/resources'
import { readSchematic, type Vec3 } from '../render/schematic'
import { buildEmissiveLayer, type EmissiveLayer } from './emissive'
import {
  CinematicGradeShader,
  createSkyDome,
  createStudioBackdrop,
  createWaterNormalTexture,
  skyPalette,
  type SkyDome,
  type StudioBackdrop
} from './shaders'
import { STUDIO_CAMERA_PRESETS, type LookPresetSettings, type StudioCameraPreset } from './presets'
import { autoCropCanvas, downscaleCanvas } from './compose'

export interface CinematicCameraState {
  projection: Projection
  position: [number, number, number]
  target: [number, number, number]
  zoom: number
  orthoTop: number
  orthoNear: number
  orthoFar: number
  fov: number
}

const K = Math.PI

const SSAO_BASE = {
  perspective: { aoRadius: 1.0, distanceFalloff: 0.4, intensity: 4.5 },
  isometric: { aoRadius: 0.32, distanceFalloff: 0.12, intensity: 0.85 }
} as const

function directionFromAngles(pitchDeg: number, yawDeg: number): THREE.Vector3 {
  const p = THREE.MathUtils.degToRad(Math.min(pitchDeg, 89.95))
  const y = THREE.MathUtils.degToRad(yawDeg)
  return new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p))
}

function sunDirection(azimuthDeg: number, elevationDeg: number): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azimuthDeg)
  const el = THREE.MathUtils.degToRad(elevationDeg)
  return new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    -Math.cos(az) * Math.cos(el)
  ).normalize()
}

export class CinematicRenderer {
  readonly gl: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly cameras: CameraManager
  private readonly lights = new THREE.Group()
  private readonly emissiveLights = new THREE.Group()
  private readonly skyDome: SkyDome
  private readonly studioBackdrop: StudioBackdrop
  private readonly waterNormal: THREE.DataTexture
  private readonly shadowCatcher: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>
  private composer: EffectComposer
  private renderPass: RenderPass
  private aoPass: N8AOPass
  private bloomPass: UnrealBloomPass
  private gradePass: ShaderPass
  private smaaPass: SMAAPass
  private schematicObj: SchematicObject | null = null
  private baseWaterMaterial: THREE.MeshLambertMaterial | null = null
  private sheenWaterMaterial: THREE.MeshStandardMaterial | null = null
  private emissiveLayer: EmissiveLayer | null = null
  private box = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1))
  private centre = new THREE.Vector3()
  private radius = 1
  private currentLook: LookPresetSettings | null = null
  private clipY: number | null = null
  private dirty = true
  private paused = false
  private raf = 0
  private resources: Resources | null
  private colors: BlockColorMap | null

  constructor(
    readonly canvas: HTMLCanvasElement,
    opts: { resources: Resources | null; colors?: BlockColorMap | null }
  ) {
    this.resources = opts.resources
    this.colors = opts.colors ?? null
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    })
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.gl.localClippingEnabled = true
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace
    this.gl.shadowMap.enabled = true
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap

    this.cameras = new CameraManager(canvas)
    this.cameras.addEventListener('change', () => this.invalidate())

    this.scene.add(this.lights)
    this.scene.add(this.emissiveLights)

    this.skyDome = createSkyDome()
    this.studioBackdrop = createStudioBackdrop()
    this.waterNormal = createWaterNormalTexture()
    this.scene.add(this.skyDome.mesh)
    this.scene.add(this.studioBackdrop.mesh)

    const catcherMat = new THREE.ShadowMaterial({
      opacity: 0.35,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    })
    this.shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), catcherMat)
    this.shadowCatcher.rotation.x = -Math.PI / 2
    this.shadowCatcher.receiveShadow = true
    this.shadowCatcher.visible = false
    this.scene.add(this.shadowCatcher)

    const w = Math.max(1, canvas.clientWidth || 640)
    const h = Math.max(1, canvas.clientHeight || 480)
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: 0
    })
    this.composer = new EffectComposer(this.gl, rt)
    this.composer.setPixelRatio(this.gl.getPixelRatio())
    this.composer.setSize(w, h)

    this.renderPass = new RenderPass(this.scene, this.cameras.active)
    this.composer.addPass(this.renderPass)

    this.aoPass = new N8AOPass(this.scene, this.cameras.active, w, h)
    this.aoPass.configuration.gammaCorrection = false
    this.composer.addPass(this.aoPass)

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.5, 1.02)
    this.composer.addPass(this.bloomPass)

    this.gradePass = new ShaderPass(CinematicGradeShader)
    this.composer.addPass(this.gradePass)

    this.smaaPass = new SMAAPass()
    this.composer.addPass(this.smaaPass)

    this.resize()
    const loop = (): void => {
      this.raf = requestAnimationFrame(loop)
      if (!this.paused && this.dirty) this.renderFrame()
    }
    loop()
  }

  get dims(): Vec3 | null {
    return this.schematicObj ? [...this.schematicObj.schematic.size] : null
  }

  get emissiveCount(): number {
    return this.emissiveLayer?.blockCount ?? 0
  }

  invalidate(): void {
    this.dirty = true
  }

  resize(): void {
    const w = this.canvas.clientWidth || this.canvas.width
    const h = this.canvas.clientHeight || this.canvas.height
    if (!w || !h) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    this.gl.setPixelRatio(ratio)
    this.gl.setSize(w, h, false)
    this.composer.setPixelRatio(ratio)
    this.composer.setSize(w, h)
    this.bloomPass.resolution.set(w * ratio, h * ratio)
    this.gradePass.uniforms.uResolution.value.set(w * ratio, h * ratio)
    this.cameras.setAspect(w / h)
    this.invalidate()
  }

  async loadSchematic(
    buf: ArrayBuffer | Uint8Array,
    opts: {
      edits?: [number, number, number, string][]
      onProgress?: (frac: number) => void
      stale?: () => boolean
    } = {}
  ): Promise<boolean> {
    const schematic = await readSchematic(buf)
    if (opts.stale?.()) return false
    const obj = new SchematicObject('studio-build', schematic, this.resources)
    obj.mesher = new Mesher(schematic, this.resources, this.colors)
    const ok = await obj.mesher.build(obj.group, obj.materials, opts.onProgress, opts.stale)
    if (!ok || opts.stale?.()) {
      obj.dispose()
      return false
    }
    if (opts.edits?.length) await obj.apply(opts.edits)
    if (opts.stale?.()) {
      obj.dispose()
      return false
    }

    const emissive = await buildEmissiveLayer(obj.schematic, this.resources, this.colors)
    if (opts.stale?.()) {
      obj.dispose()
      emissive.dispose()
      return false
    }

    this.clearBuild()
    this.schematicObj = obj
    this.baseWaterMaterial = obj.materials[LIQUID]
    this.sheenWaterMaterial = new THREE.MeshStandardMaterial({
      map: this.resources?.texture ?? null,
      vertexColors: true,
      normalMap: this.waterNormal,
      normalScale: new THREE.Vector2(0.18, 0.18),
      roughness: 0.12,
      metalness: 0.14,
      transparent: true,
      opacity: 0.86,
      depthWrite: false
    })
    this.emissiveLayer = emissive

    this.scene.add(obj.group)
    this.scene.add(emissive.group)

    this.box = new THREE.Box3(
      new THREE.Vector3(...obj.box.min).subScalar(0.5),
      new THREE.Vector3(...obj.box.max).addScalar(0.5)
    )
    this.centre = this.box.getCenter(new THREE.Vector3())
    this.radius = Math.max(this.box.getSize(new THREE.Vector3()).length() / 2, 1)
    this.cameras.setBounds(this.box)

    // Position the invisible shadow catcher right under the schematic floor
    const span = Math.max(this.radius * 8, 64)
    this.shadowCatcher.scale.set(span, span, 1)
    this.shadowCatcher.position.set(this.centre.x, this.box.min.y - 0.002, this.centre.z)

    this.applyClip()
    if (this.currentLook) this.applyLook(this.currentLook)
    this.invalidate()
    return true
  }

  private clearBuild(): void {
    this.schematicObj?.dispose()
    this.schematicObj = null
    this.baseWaterMaterial = null
    this.sheenWaterMaterial?.dispose()
    this.sheenWaterMaterial = null
    this.emissiveLayer?.dispose()
    this.emissiveLayer = null
  }

  setClipY(y: number | null): void {
    this.clipY = y
    this.applyClip()
    this.invalidate()
  }

  private applyClip(): void {
    const planes =
      this.clipY !== null ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), this.clipY + 0.501)] : []
    if (this.schematicObj) this.schematicObj.clippingPlanes = planes
    if (this.sheenWaterMaterial) this.sheenWaterMaterial.clippingPlanes = planes
    if (this.emissiveLayer) {
      this.emissiveLayer.materials.forEach((m) => (m.clippingPlanes = planes))
    }
  }

  framePreset(preset: StudioCameraPreset, projection?: Projection, fov?: number): void {
    const spec = STUDIO_CAMERA_PRESETS.find((v) => v.id === preset) ?? STUDIO_CAMERA_PRESETS[0]
    if (fov !== undefined) {
      this.cameras.perspective.fov = fov
      this.cameras.perspective.updateProjectionMatrix()
    }
    this.cameras.frame(this.box, directionFromAngles(spec.pitch, spec.yaw), projection ?? spec.mode)
    this.invalidate()
  }

  setProjection(projection: Projection, fov?: number): void {
    if (fov !== undefined) {
      this.cameras.perspective.fov = fov
      this.cameras.perspective.updateProjectionMatrix()
    }
    if (this.cameras.projection !== projection) {
      const dir = this.cameras.active.getWorldDirection(new THREE.Vector3()).negate()
      this.cameras.frame(this.box, dir, projection)
    }
    this.invalidate()
  }

  setFov(fov: number): void {
    this.cameras.perspective.fov = fov
    this.cameras.perspective.updateProjectionMatrix()
    this.invalidate()
  }

  getCameraState(): CinematicCameraState {
    const cam = this.cameras.active
    return {
      projection: this.cameras.projection,
      position: cam.position.toArray() as [number, number, number],
      target: this.cameras.target.toArray() as [number, number, number],
      zoom: cam instanceof THREE.OrthographicCamera ? cam.zoom : 1,
      orthoTop: this.cameras.ortho.top,
      orthoNear: this.cameras.ortho.near,
      orthoFar: this.cameras.ortho.far,
      fov: this.cameras.perspective.fov
    }
  }

  setCameraState(state: CinematicCameraState): void {
    const size = this.gl.getSize(new THREE.Vector2())
    const aspect = size.x / Math.max(1, size.y)
    this.cameras.perspective.fov = state.fov
    this.cameras.perspective.updateProjectionMatrix()
    this.cameras.setProjection(state.projection)
    this.cameras.lookAt(new THREE.Vector3(...state.position), new THREE.Vector3(...state.target))
    if (state.projection === 'isometric') {
      this.cameras.ortho.top = state.orthoTop
      this.cameras.ortho.bottom = -state.orthoTop
      this.cameras.ortho.near = state.orthoNear
      this.cameras.ortho.far = state.orthoFar
      this.cameras.ortho.zoom = state.zoom
    }
    this.cameras.setAspect(aspect)
    this.invalidate()
  }

  /** Apply all lighting, sky, water, emissive, AO, bloom, DoF, and color grading settings live. */
  applyLook(look: LookPresetSettings): void {
    this.currentLook = look
    const dir = sunDirection(look.sunAzimuth, look.sunElevation)
    const palette = skyPalette(look.sunElevation)

    // Rebuild scene lights
    this.lights.clear()
    this.gl.shadowMap.enabled = look.lightingMode === 'sun'

    const dirLight = (
      intensity: number,
      pos: THREE.Vector3,
      color = 0xffffff
    ): THREE.DirectionalLight => {
      const l = new THREE.DirectionalLight(color, intensity * K)
      l.position.copy(pos)
      l.target.position.copy(this.centre)
      return l
    }

    if (look.lightingMode === 'flat') {
      this.lights.add(new THREE.AmbientLight(0xffffff, K))
    } else if (look.lightingMode === 'game') {
      const c = this.centre
      this.lights.add(
        new THREE.AmbientLight(0xffffff, 0.5 * K),
        dirLight(0.5, new THREE.Vector3(c.x, c.y + 1, c.z)),
        dirLight(0.3, new THREE.Vector3(c.x, c.y, c.z + 1)),
        dirLight(0.3, new THREE.Vector3(c.x, c.y, c.z - 1)),
        dirLight(0.1, new THREE.Vector3(c.x + 1, c.y, c.z)),
        dirLight(0.1, new THREE.Vector3(c.x - 1, c.y, c.z))
      )
    } else {
      // Sun / Moon casting shadows + atmospheric sky/ground hemisphere fill + subtle cool rim
      const lightDir = dir.clone()
      if (lightDir.y < 0.08) lightDir.y = 0.25 // keep shadow-casting moonlight angled from above
      lightDir.normalize()
      const sunPos = this.centre.clone().addScaledVector(lightDir, this.radius * 2.5)
      const sun = dirLight(
        0.68 * look.sunIntensity * palette.sunStrength,
        sunPos,
        palette.sunColor.getHex()
      )
      sun.castShadow = true
      const mapSize = Math.min(look.shadowMapSize, this.gl.capabilities.maxTextureSize)
      fitDirectionalShadow(sun, this.box, lightDir, mapSize, look.groundShadow)
      const hemi = new THREE.HemisphereLight(
        palette.hemiSky.getHex(),
        palette.hemiGround.getHex(),
        (look.backdrop === 'sky' ? 0.56 : 0.62) * K
      )
      const rimPos = this.centre
        .clone()
        .addScaledVector(lightDir.clone().negate().setY(0.35).normalize(), this.radius * 2)
      const rim = dirLight(0.16 * look.sunIntensity, rimPos, palette.hemiSky.getHex())
      this.lights.add(hemi, sun, rim)
    }
    for (const child of [...this.lights.children]) {
      if (child instanceof THREE.DirectionalLight) this.lights.add(child.target)
    }

    // Localized warm/cool point lights around glowing block clusters
    this.emissiveLights.clear()
    if (look.emissiveLights && look.emissiveGlow > 0.05 && this.emissiveLayer?.clusters.length) {
      const dist = Math.max(14, this.radius * 0.65)
      for (const c of this.emissiveLayer.clusters) {
        const pt = new THREE.PointLight(c.color, c.intensity * look.emissiveGlow * 1.8, dist, 1.4)
        pt.position.copy(c.position)
        this.emissiveLights.add(pt)
      }
    }

    // Backdrop & Sky
    this.skyDome.mesh.visible = look.backdrop === 'sky'
    this.studioBackdrop.mesh.visible = look.backdrop === 'studio'
    if (look.backdrop === 'sky') {
      this.skyDome.update(dir, palette)
      this.scene.background = palette.horizon.clone()
    } else if (look.backdrop === 'studio') {
      this.studioBackdrop.update(look.bgColor)
      this.scene.background = new THREE.Color(look.bgColor)
    } else if (look.backdrop === 'solid') {
      this.scene.background = new THREE.Color(look.bgColor)
    } else {
      this.scene.background = null
    }

    // Shadow catcher
    this.shadowCatcher.visible = look.groundShadow && look.lightingMode === 'sun'
    this.shadowCatcher.material.opacity = look.groundShadowOpacity

    // Fog (applied dynamically in renderFrame for perspective camera)
    this.updateMaterials(look)

    // Emissive HDR overlay
    if (this.emissiveLayer) {
      const active = look.emissiveGlow > 0.01 && look.lightingMode !== 'flat'
      this.emissiveLayer.group.visible = active
      const boost = 1 + look.emissiveGlow * 0.85
      this.emissiveLayer.materials.forEach((m) => {
        m.color.setRGB(boost, boost, boost)
      })
    }

    // Bloom
    this.bloomPass.enabled = look.bloomStrength > 0.005
    this.bloomPass.strength = look.bloomStrength
    this.bloomPass.radius = look.bloomRadius
    this.bloomPass.threshold = 1.02

    // Color grading + Tilt-Shift / Focus DoF
    const u = this.gradePass.uniforms
    u.uToneMapping.value = look.toneMapping === 'aces' ? 1 : 0
    u.uExposure.value = look.exposure
    u.uContrast.value = look.contrast
    u.uSaturation.value = look.saturation
    u.uTemperature.value = look.temperature
    u.uVignette.value = look.backdrop === 'transparent' ? 0 : look.vignette
    u.uDofMode.value = look.dofMode === 'tilt-shift' ? 1 : look.dofMode === 'focus' ? 2 : 0
    u.uFocusPoint.value.set(look.dofFocusX, 1 - look.dofFocusY)
    u.uAperture.value = look.dofAperture

    this.invalidate()
  }

  private updateMaterials(look: LookPresetSettings): void {
    if (!this.schematicObj) return
    const glassMat = this.schematicObj.materials[TRANSLUCENT]
    glassMat.transparent = glassMat.opacity < 1 || look.glass !== 'opaque'
    glassMat.depthWrite = !glassMat.transparent
    glassMat.needsUpdate = true

    const useSheen =
      look.waterSheen > 0.05 && look.lightingMode === 'sun' && !!this.sheenWaterMaterial
    if (this.sheenWaterMaterial) {
      this.sheenWaterMaterial.roughness = THREE.MathUtils.lerp(0.45, 0.08, look.waterSheen)
      this.sheenWaterMaterial.metalness = THREE.MathUtils.lerp(0.02, 0.22, look.waterSheen)
      this.sheenWaterMaterial.normalScale.setScalar(0.06 + look.waterSheen * 0.24)
      this.sheenWaterMaterial.needsUpdate = true
    }
    const targetWater = useSheen ? this.sheenWaterMaterial! : this.baseWaterMaterial!
    this.schematicObj.group.traverse((o) => {
      if (
        o instanceof THREE.Mesh &&
        (o.material === this.baseWaterMaterial || o.material === this.sheenWaterMaterial)
      ) {
        o.material = targetWater
      }
    })
  }

  private configurePassesForCamera(): void {
    const cam = this.cameras.active
    const look = this.currentLook
    this.renderPass.camera = cam
    if (this.skyDome.mesh.visible) this.skyDome.setCamera(cam)
    if (this.studioBackdrop.mesh.visible) this.studioBackdrop.setCamera(cam)

    // Distance fog for perspective shots only (keeps iso clean)
    if (
      look &&
      look.fog &&
      look.fogDensity > 0.01 &&
      look.backdrop !== 'transparent' &&
      cam instanceof THREE.PerspectiveCamera
    ) {
      const dist = cam.position.distanceTo(this.centre)
      const fogCol =
        look.backdrop === 'sky'
          ? skyPalette(look.sunElevation).fogColor
          : new THREE.Color(look.bgColor)
      const far =
        dist + Math.max(this.radius * 1.4, (1.15 - look.fogDensity * 0.8) * this.radius * 4.5)
      this.scene.fog = new THREE.Fog(fogCol, Math.max(1, dist - this.radius * 0.4), far)
    } else {
      this.scene.fog = null
    }

    const aoOn = !!look && look.aoStrength > 0.01 && look.backdrop !== 'transparent'
    this.aoPass.enabled = aoOn
    this.renderPass.enabled = !aoOn
    if (aoOn) {
      if (this.aoPass.camera !== cam) {
        const [t, ortho] = [this.aoPass.configuration.depthBufferType, cam === this.cameras.ortho]
        this.aoPass.camera = cam
        this.aoPass.configureAOPass(t, ortho)
        this.aoPass.configureDenoisePass(t, ortho)
        this.aoPass.configureEffectCompositer(t, ortho)
      }
      const base = SSAO_BASE[this.cameras.projection]
      this.aoPass.configuration.intensity = base.intensity * look.aoStrength
      this.aoPass.configuration.aoRadius = Math.max(0.15, base.aoRadius * (look.aoRadius / 0.65))
      this.aoPass.configuration.distanceFalloff = base.distanceFalloff
    }
  }

  private renderFrame(): void {
    this.dirty = false
    this.configurePassesForCamera()
    const transparent = this.currentLook?.backdrop === 'transparent'
    if (transparent) {
      this.gl.setClearColor(0x000000, 0)
      this.gl.clear(true, true, true)
      // Direct render preserves true WebGL alpha including soft ground shadows on live stage
      this.gl.render(this.scene, this.cameras.active)
      return
    }
    this.gl.setClearColor(0x000000, 1)
    this.composer.render()
  }

  /** Capture the current view at arbitrary resolution with optional 2x SSAA, alpha preservation, and auto-crop. */
  captureCanvas(opts: {
    width: number
    height: number
    ssaa?: 1 | 2
    autoCrop?: boolean
  }): HTMLCanvasElement {
    const ssaa = opts.ssaa ?? 1
    const maxDim = Math.min(this.gl.capabilities.maxTextureSize || 4096, 4096)
    const scale = Math.min(
      ssaa,
      maxDim / Math.max(opts.width, 1),
      maxDim / Math.max(opts.height, 1)
    )
    const rw = Math.max(1, Math.round(opts.width * Math.max(1, scale)))
    const rh = Math.max(1, Math.round(opts.height * Math.max(1, scale)))

    const prevSize = this.gl.getSize(new THREE.Vector2())
    const prevRatio = this.gl.getPixelRatio()
    const transparent = this.currentLook?.backdrop === 'transparent'

    const raw = document.createElement('canvas')
    raw.width = rw
    raw.height = rh
    const ctx = raw.getContext('2d', { willReadFrequently: true })!

    try {
      this.gl.setPixelRatio(1)
      this.gl.setSize(rw, rh, false)
      this.composer.setPixelRatio(1)
      this.composer.setSize(rw, rh)
      this.bloomPass.resolution.set(rw, rh)
      this.gradePass.uniforms.uResolution.value.set(rw, rh)
      this.cameras.setAspect(rw / rh)

      this.configurePassesForCamera()
      if (transparent) {
        // Pass 1: capture true alpha (build + soft shadow catcher)
        this.gl.setClearColor(0x000000, 0)
        this.gl.clear(true, true, true)
        this.gl.render(this.scene, this.cameras.active)
        const alphaCanvas = document.createElement('canvas')
        alphaCanvas.width = rw
        alphaCanvas.height = rh
        const aCtx = alphaCanvas.getContext('2d', { willReadFrequently: true })!
        aCtx.drawImage(this.canvas, 0, 0, rw, rh)
        const alphaPixels = aCtx.getImageData(0, 0, rw, rh).data

        // Pass 2: run post-processing (Bloom + ACES Grade + SMAA) for RGB, then restore true alpha
        this.smaaPass.enabled = ssaa === 1
        this.composer.render()
        ctx.drawImage(this.canvas, 0, 0, rw, rh)
        const rgbImg = ctx.getImageData(0, 0, rw, rh)
        for (let i = 3; i < rgbImg.data.length; i += 4) {
          rgbImg.data[i] = alphaPixels[i]
        }
        ctx.putImageData(rgbImg, 0, 0)
      } else {
        this.gl.setClearColor(0x000000, 1)
        this.smaaPass.enabled = ssaa === 1
        this.composer.render()
        ctx.drawImage(this.canvas, 0, 0, rw, rh)
      }
    } finally {
      this.smaaPass.enabled = true
      this.gl.setPixelRatio(prevRatio)
      this.gl.setSize(prevSize.x, prevSize.y, false)
      this.composer.setPixelRatio(prevRatio)
      this.composer.setSize(prevSize.x, prevSize.y)
      this.bloomPass.resolution.set(prevSize.x * prevRatio, prevSize.y * prevRatio)
      this.gradePass.uniforms.uResolution.value.set(prevSize.x * prevRatio, prevSize.y * prevRatio)
      this.cameras.setAspect(prevSize.x / Math.max(1, prevSize.y))
      this.invalidate()
    }

    let out = downscaleCanvas(raw, opts.width, opts.height)
    if (opts.autoCrop) out = autoCropCanvas(out, transparent)
    return out
  }

  /** Render multiple named camera presets using the active cinematic look (restores live camera afterward). */
  captureAngles(
    views: StudioCameraPreset[],
    opts: { tileWidth: number; tileHeight: number; ssaa: 1 | 2; autoCrop: boolean; fov: number }
  ): { id: StudioCameraPreset; label: string; canvas: HTMLCanvasElement }[] {
    const saved = this.getCameraState()
    const results: { id: StudioCameraPreset; label: string; canvas: HTMLCanvasElement }[] = []
    const tileAspect = opts.tileWidth / Math.max(1, opts.tileHeight)
    try {
      for (const id of views) {
        const spec = STUDIO_CAMERA_PRESETS.find((v) => v.id === id)
        if (!spec) continue
        // Frame each angle against the tile's aspect ratio so wide builds are never cropped on export
        this.cameras.setAspect(tileAspect)
        this.framePreset(id, spec.mode, opts.fov)
        const canvas = this.captureCanvas({
          width: opts.tileWidth,
          height: opts.tileHeight,
          ssaa: opts.ssaa,
          autoCrop: opts.autoCrop
        })
        results.push({ id, label: spec.short, canvas })
      }
    } finally {
      this.setCameraState(saved)
    }
    return results
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    this.clearBuild()
    this.skyDome.dispose()
    this.studioBackdrop.dispose()
    this.waterNormal.dispose()
    this.shadowCatcher.geometry.dispose()
    this.shadowCatcher.material.dispose()
    this.cameras.dispose()
    this.aoPass.dispose()
    this.bloomPass.dispose()
    this.composer.dispose()
    this.gl.dispose()
    this.gl.forceContextLoss()
  }
}
