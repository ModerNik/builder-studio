// Our schematic renderer on three.js: schematics as chunked meshes, a perspective and an isometric (ortho) camera
// on orbit controls, on-demand frames, optional SSAO (n8ao), screenshots.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import type { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'
import { selectionPass } from './selection'
import { N8AOPass } from 'n8ao'
import { BUCKETS, Mesher, type BlockColorMap } from './mesher'
import { CUTOUT, LIQUID, OPAQUE, TRANSLUCENT, type Resources } from './resources'
import {
  blockAt,
  grow,
  isAir,
  readSchematic,
  setBlock,
  type Schematic,
  type Vec3
} from './schematic'

export type Projection = 'perspective' | 'isometric'
export interface SSAOPreset {
  aoRadius: number // blocks
  distanceFalloff: number
  intensity: number
}

/** One loaded file: its block grid and the group its meshes hang in (cell centres on integer coordinates). */
export class SchematicObject {
  readonly group = new THREE.Group()
  readonly materials: THREE.MeshLambertMaterial[]
  mesher: Mesher | null = null // set once meshed: builds the clip cap
  private caps: THREE.Mesh[] = []
  private onlyMask = false
  private extent: { min: Vec3; max: Vec3 } // the file's cells and every block set since

  get maskOnly(): boolean {
    return this.onlyMask
  }
  set maskOnly(value: boolean) {
    this.onlyMask = value
    this.materials.forEach((m) => {
      m.colorWrite = !value
      m.depthWrite = !value && !m.transparent
    })
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = !value
    })
  }

  constructor(
    readonly id: string,
    public schematic: Schematic,
    res: Resources | null
  ) {
    const { min, size } = schematic
    this.extent = { min: [...min], max: min.map((m, i) => m + size[i] - 1) as Vec3 }
    const map = res?.texture ?? null
    this.materials = BUCKETS.map(
      (k) =>
        new THREE.MeshLambertMaterial({
          map,
          vertexColors: true,
          alphaTest: k === CUTOUT ? 0.5 : k === OPAQUE ? 0 : 0.01,
          transparent: k === TRANSLUCENT || k === LIQUID,
          depthWrite: k === OPAQUE || k === CUTOUT
        })
    )
    this.materials.forEach((m, k) => (m.userData = { bucket: k, isLiquid: k === LIQUID }))
    this.group.name = id
  }

  /** Inclusive cell bounds: the file's, grown by the blocks `apply` set outside them. */
  get box(): { min: Vec3; max: Vec3 } {
    return { min: [...this.extent.min], max: [...this.extent.max] }
  }
  /** Set cells (schematic coordinates) to block states and re-mesh the chunks they touch. A cell outside the
   *  grid grows it, with a margin, and re-meshes everything. Wait for one call before the next. */
  async apply(cells: [number, number, number, string][]): Promise<void> {
    if (!this.mesher || !cells.length) return
    const outside = cells.filter(([x, y, z]) => blockAt(this.schematic, x, y, z) === null)
    if (outside.length) {
      this.schematic = grow(
        this.schematic,
        outside.map(([x, y, z]) => [x, y, z])
      )
      this.mesher.reset(this.schematic)
    }
    const { min, max } = this.extent
    for (const [x, y, z, state] of cells) {
      setBlock(this.schematic, x, y, z, state)
      if (isAir(state)) continue
      ;[x, y, z].forEach((v, i) => {
        min[i] = Math.min(min[i], v)
        max[i] = Math.max(max[i], v)
      })
    }
    const at = this.schematic.min
    if (outside.length) await this.mesher.build(this.group, this.materials)
    else
      this.mesher.rebuild(
        this.group,
        this.materials,
        cells.map(([x, y, z]) => [x - at[0], y - at[1], z - at[2]])
      )
    this.maskOnly = this.onlyMask // new meshes cast shadows
    this.clippingPlanes = this.materials[0].clippingPlanes ?? [] // the clip cap follows the cells
  }
  blockAt(x: number, y: number, z: number): string | null {
    return blockAt(this.schematic, x, y, z)
  }
  get visible(): boolean {
    return this.group.visible
  }
  set visible(v: boolean) {
    this.group.visible = v
  }
  /** Fade the whole object (1: as built). */
  set opacity(o: number) {
    this.materials.forEach((m, k) => {
      m.opacity = o
      m.transparent = o < 1 || k === TRANSLUCENT || k === LIQUID
      m.depthWrite = o >= 1 && (k === OPAQUE || k === CUTOUT)
      m.needsUpdate = true
    })
  }
  set clippingPlanes(planes: THREE.Plane[]) {
    this.materials.forEach((m) => (m.clippingPlanes = planes))
    // faces culled against the layer above the cut would leave holes: cap the top visible layer
    for (const c of this.caps) {
      c.removeFromParent()
      c.geometry.dispose()
    }
    const top = planes.find((p) => p.normal.y === -1) // keeps y <= constant: the top layer is constant - 0.5
    this.caps =
      top && this.mesher
        ? this.mesher.cap(Math.round(top.constant - 0.5) - this.schematic.min[1], this.materials)
        : []
    if (this.caps.length) this.group.add(...this.caps)
  }
  dispose(): void {
    this.group.traverse((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.dispose())
    this.group.removeFromParent()
    this.materials.forEach((m) => m.dispose())
  }
}

/** Compute dynamic near/far clip planes so depth precision and far visibility hold for any build size. */
export function computeClipPlanes(
  projection: Projection,
  distToCentre: number,
  distToTarget: number,
  radius: number
): { near: number; far: number } {
  const safeR = Math.max(radius, 1) * 1.2 + 4
  const reach = Math.max(distToCentre, distToTarget)
  if (projection === 'isometric') {
    // Keep near > 0 for N8AO's depth shader while ensuring panned/zoomed large builds never clip.
    return {
      near: 0.1,
      far: Math.max(safeR * 6, reach + safeR * 2.5)
    }
  }
  const clearance = distToCentre - safeR
  const near =
    clearance > 1
      ? Math.max(0.05, Math.min(clearance * 0.4, distToCentre * 0.02))
      : Math.max(0.05, Math.min(0.5, distToTarget * 0.005))
  const far = Math.max(200, reach + safeR * 2.5, near * 20)
  return { near, far }
}

/** Both cameras on one set of orbit controls; 'change' fires on every camera move. */
export class CameraManager extends THREE.EventDispatcher<{ change: object }> {
  readonly perspective = new THREE.PerspectiveCamera(60, 1, 0.05, 5000)
  readonly ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 5000)
  readonly controls: OrbitControls
  active: THREE.PerspectiveCamera | THREE.OrthographicCamera = this.perspective
  private aspect = 1
  private bounds: { centre: THREE.Vector3; radius: number } | null = null
  private autoClip = true

  constructor(dom: HTMLElement) {
    super()
    this.controls = new OrbitControls(this.perspective, dom)
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE // the wheel zooms; the middle button orbits
    this.controls.addEventListener('change', () => {
      this.updateClipPlanes()
      this.changed()
    })
    this.perspective.position.set(20, 20, 20)
    this.perspective.lookAt(0, 0, 0)
  }
  get projection(): Projection {
    return this.active === this.ortho ? 'isometric' : 'perspective'
  }
  get target(): THREE.Vector3 {
    return this.controls.target
  }
  /** Track the scene's bounding box so near/far clip planes adapt cleanly as the camera orbits or zooms. */
  setBounds(box: THREE.Box3): void {
    if (box.isEmpty()) {
      this.bounds = null
      return
    }
    this.bounds = {
      centre: box.getCenter(new THREE.Vector3()),
      radius: Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1)
    }
    this.updateClipPlanes()
  }
  private updateClipPlanes(): void {
    if (!this.autoClip) return
    const cam = this.active
    const distToTarget = cam.position.distanceTo(this.controls.target)
    const centre = this.bounds?.centre ?? this.controls.target
    const radius = this.bounds?.radius ?? Math.max(distToTarget * 0.5, 10)
    const distToCentre = cam.position.distanceTo(centre)
    const { near, far } = computeClipPlanes(this.projection, distToCentre, distToTarget, radius)
    if (
      Math.abs(cam.near - near) > Math.max(1e-4, cam.near * 1e-3) ||
      Math.abs(cam.far - far) > Math.max(1e-2, cam.far * 1e-3)
    ) {
      cam.near = near
      cam.far = far
      cam.updateProjectionMatrix()
    }
  }
  changed(): void {
    this.dispatchEvent({ type: 'change' })
  }
  setAspect(a: number): void {
    this.aspect = a
    this.perspective.aspect = a
    this.perspective.updateProjectionMatrix()
    this.ortho.left = -this.ortho.top * a
    this.ortho.right = this.ortho.top * a
    this.ortho.updateProjectionMatrix()
  }
  /** Switch cameras; the new one starts where the old one stood. */
  setProjection(p: Projection): void {
    const next = p === 'isometric' ? this.ortho : this.perspective
    if (next === this.active) return
    next.position.copy(this.active.position)
    next.quaternion.copy(this.active.quaternion)
    this.active = next
    this.controls.object = next
    this.updateClipPlanes()
    this.controls.update()
    this.changed()
  }
  /** Look from `dir` (pointing from the box to the camera) and fit the box in view, in the given projection. */
  frame(box: THREE.Box3, dir: THREE.Vector3, projection: Projection = this.projection): void {
    this.autoClip = true
    this.setProjection(projection)
    const d = dir.clone().normalize()
    const centre = box.getCenter(new THREE.Vector3())
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1)
    this.bounds = { centre: centre.clone(), radius }
    const cam = this.active
    cam.up.set(0, 1, 0)
    cam.position.copy(centre).addScaledVector(d, radius * 2.5)
    cam.lookAt(centre)
    cam.updateMatrixWorld(true)
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1)
    const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
      new THREE.Vector3(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z
      ).sub(centre)
    )
    if (cam instanceof THREE.OrthographicCamera) {
      const w = Math.max(...corners.map((c) => Math.abs(c.dot(right))))
      const h = Math.max(...corners.map((c) => Math.abs(c.dot(up))))
      cam.top = Math.max(h, w / this.aspect) * 1.05
      cam.bottom = -cam.top
      cam.zoom = 1
      this.controls.maxDistance = Infinity
    } else {
      const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
      const th = tv * this.aspect
      // the distance that puts every corner inside the frustum
      const dist = Math.max(
        ...corners.map(
          (c) => c.dot(d) + Math.max(Math.abs(c.dot(right)) / th, Math.abs(c.dot(up)) / tv)
        )
      )
      cam.position.copy(centre).addScaledVector(d, dist * 1.05)
      this.controls.maxDistance = Infinity
    }
    this.controls.target.copy(centre)
    this.updateClipPlanes()
    this.setAspect(this.aspect)
    this.controls.update()
    this.changed()
  }
  /** Put the active camera at `pos` looking at `target`. */
  lookAt(pos: THREE.Vector3, target: THREE.Vector3, opts?: { keepClip?: boolean }): void {
    if (opts?.keepClip !== undefined) this.autoClip = !opts.keepClip
    this.active.position.copy(pos)
    this.controls.target.copy(target)
    this.active.lookAt(target)
    this.updateClipPlanes()
    this.controls.update()
    this.changed()
  }
  /** Orbit around the target as the orbit controls do: `yaw` turns around +Y, `pitch` raises the camera. */
  orbitBy(yaw: number, pitch: number): void {
    const s = new THREE.Spherical().setFromVector3(this.active.position.clone().sub(this.target))
    s.theta -= yaw
    s.phi = THREE.MathUtils.clamp(s.phi - pitch, 0.01, Math.PI - 0.01)
    this.active.up.set(0, 1, 0)
    this.active.position.copy(this.target).add(new THREE.Vector3().setFromSpherical(s))
    this.active.lookAt(this.target)
    this.controls.update()
    this.changed()
  }
  dispose(): void {
    this.controls.dispose()
  }
}

export interface RendererOptions {
  resources: Resources | null // null: colour-only cubes from `colors`
  colors?: BlockColorMap | null
  pixelRatio?: number
}

export class Renderer {
  readonly gl: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly cameras: CameraManager
  readonly lights = new THREE.Group() // the look's lights
  resources: Resources | null
  colors: BlockColorMap | null
  fps = 0
  private objects = new Map<string, SchematicObject>()
  private dirty = true
  private raf = 0
  private frames: number[] = []
  private paused = false
  private composer: EffectComposer | null = null
  private ao: N8AOPass | null = null
  private beauty: RenderPass | null = null
  private outline: OutlinePass | null = null
  private ssao: Record<Projection, SSAOPreset> | null = null

  constructor(
    readonly canvas: HTMLCanvasElement,
    opts: RendererOptions
  ) {
    this.resources = opts.resources
    this.colors = opts.colors ?? null
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    })
    this.gl.setPixelRatio(opts.pixelRatio ?? window.devicePixelRatio)
    this.gl.localClippingEnabled = true
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace // the game look: no sRGB encode
    this.cameras = new CameraManager(canvas)
    this.cameras.addEventListener('change', () => this.invalidate())
    this.scene.add(this.lights)
    this.lights.add(new THREE.AmbientLight(0xffffff, Math.PI))
    this.resize()
    const loop = (): void => {
      this.raf = requestAnimationFrame(loop)
      if (!this.paused && this.dirty) this.render()
    }
    loop()
  }

  get suspended(): boolean {
    return this.paused
  }
  invalidate(): void {
    this.dirty = true
  }
  suspend(): void {
    this.paused = true
  }
  resume(): void {
    if (!this.paused) return
    this.paused = false
    this.dirty = true
  }

  /** Match the drawing buffer to the canvas's CSS size. */
  resize(): void {
    const w = this.canvas.clientWidth || this.canvas.width
    const h = this.canvas.clientHeight || this.canvas.height
    if (!w || !h) return
    this.gl.setSize(w, h, false)
    this.composer?.setPixelRatio(this.gl.getPixelRatio())
    this.composer?.setSize(w, h)
    this.cameras.setAspect(w / h)
    this.invalidate()
  }

  /** Per-projection SSAO, or null for none. */
  setSSAO(presets: Record<Projection, SSAOPreset> | null): void {
    this.ssao = presets
    if (presets) this.ensureComposer()
    this.invalidate()
  }

  private ensureComposer(): void {
    if (!this.composer) {
      const size = this.gl.getSize(new THREE.Vector2())
      this.composer = new EffectComposer(this.gl)
      this.composer.setPixelRatio(this.gl.getPixelRatio())
      this.beauty = new RenderPass(this.scene, this.cameras.active)
      this.composer.addPass(this.beauty)
      this.composer.setSize(size.x, size.y)
      this.ao = new N8AOPass(this.scene, this.cameras.active, size.x, size.y)
      this.ao.configuration.gammaCorrection = false // output stays linear, as the look wants
      this.composer.addPass(this.ao)
      this.composer.addPass(new SMAAPass())
    }
  }

  setSelection(ids: string[], color: THREE.ColorRepresentation, planes: THREE.Plane[] = []): void {
    const objects = ids.flatMap((id) => this.objects.get(id)?.group ?? [])
    if (objects.length && !this.outline) {
      this.ensureComposer()
      this.outline = selectionPass(this.scene, this.cameras.active)
      this.composer!.insertPass(this.outline, this.composer!.passes.length - 1)
    }
    if (this.outline) {
      this.outline.selectedObjects = objects
      this.outline.enabled = objects.length > 0
      this.outline.overlayMaterial.uniforms.selectionColor.value.set(color)
      this.outline.depthMaterial.clippingPlanes = planes
      this.outline.prepareMaskMaterial.clippingPlanes = planes
    }
    this.invalidate()
  }

  private render(): void {
    this.dirty = false
    const cam = this.cameras.active
    if ((this.ssao || this.outline?.enabled) && this.composer && this.ao && this.beauty) {
      this.beauty.camera = cam
      this.beauty.enabled = !this.ssao
      this.ao.enabled = !!this.ssao
      if (this.outline && this.outline.renderCamera !== cam) {
        this.outline.renderCamera = cam
        this.outline.prepareMaskMaterial.fragmentShader =
          this.outline.prepareMaskMaterial.fragmentShader.replace(
            /(?:perspective|orthographic)DepthToViewZ/g,
            cam === this.cameras.ortho ? 'orthographicDepthToViewZ' : 'perspectiveDepthToViewZ'
          )
        this.outline.prepareMaskMaterial.needsUpdate = true
      }
      if (this.ao.camera !== cam) {
        // n8ao compiles the projection type into its shaders: rebuild them when the camera switches
        const [t, ortho] = [this.ao.configuration.depthBufferType, cam === this.cameras.ortho]
        this.ao.camera = cam
        this.ao.configureAOPass(t, ortho)
        this.ao.configureDenoisePass(t, ortho)
        this.ao.configureEffectCompositer(t, ortho)
      }
      if (this.ssao) Object.assign(this.ao.configuration, this.ssao[this.cameras.projection])
      this.composer.render()
    } else this.gl.render(this.scene, cam)
    const now = performance.now()
    this.frames.push(now)
    while (this.frames[0] < now - 1000) this.frames.shift()
    this.fps = this.frames.length
  }

  /** Read a file and mesh it into the scene under `id` (replacing any object of that id). */
  async loadSchematic(
    id: string,
    buf: ArrayBuffer | Uint8Array,
    opts: { onProgress?: (frac: number) => void; stale?: () => boolean } = {}
  ): Promise<SchematicObject | null> {
    const schematic = await readSchematic(buf)
    if (opts.stale?.()) return null
    const obj = new SchematicObject(id, schematic, this.resources)
    obj.mesher = new Mesher(schematic, this.resources, this.colors)
    const done = await obj.mesher.build(obj.group, obj.materials, opts.onProgress, opts.stale)
    if (!done || opts.stale?.()) {
      obj.dispose()
      return null
    }
    this.removeSchematic(id)
    this.objects.set(id, obj)
    this.scene.add(obj.group)
    this.syncCameraBounds()
    this.invalidate()
    return obj
  }
  private syncCameraBounds(): void {
    const box = new THREE.Box3()
    for (const o of this.objects.values()) box.expandByObject(o.group)
    this.cameras.setBounds(box)
  }
  getSchematic(id: string): SchematicObject | undefined {
    return this.objects.get(id)
  }
  getAllSchematics(): SchematicObject[] {
    return [...this.objects.values()]
  }
  removeSchematic(id: string): void {
    this.objects.get(id)?.dispose()
    this.objects.delete(id)
    this.syncCameraBounds()
    this.invalidate()
  }
  removeAll(): void {
    for (const id of [...this.objects.keys()]) this.removeSchematic(id)
  }

  /** Render one frame at width x height and encode it (the on-screen size is restored after). */
  async screenshot(width: number, height: number, type = 'image/png'): Promise<Blob> {
    const size = this.gl.getSize(new THREE.Vector2())
    const ratio = this.gl.getPixelRatio()
    this.gl.setPixelRatio(1)
    this.gl.setSize(width, height, false)
    this.composer?.setPixelRatio(1)
    this.composer?.setSize(width, height)
    this.cameras.setAspect(width / height)
    this.render()
    // read back in the same task as the draw: the buffer is still there without preserveDrawingBuffer
    const blob = new Promise<Blob>((ok, fail) =>
      this.canvas.toBlob((b) => (b ? ok(b) : fail(new Error('screenshot failed'))), type)
    )
    this.gl.setPixelRatio(ratio)
    this.gl.setSize(size.x, size.y, false)
    this.composer?.setPixelRatio(ratio)
    this.composer?.setSize(size.x, size.y)
    this.cameras.setAspect(size.x / size.y)
    this.invalidate()
    return blob
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    this.removeAll()
    this.cameras.dispose()
    this.outline?.dispose()
    this.ao?.dispose()
    this.composer?.passes.forEach((pass) => {
      if (pass !== this.outline && pass !== this.ao) pass.dispose()
    })
    this.composer?.dispose()
    this.gl.dispose()
    this.gl.forceContextLoss()
  }
}
