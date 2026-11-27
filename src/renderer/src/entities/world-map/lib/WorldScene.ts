// BlueMap-inspired Three.js scene, fog-free atmosphere, lighting, smooth 3D/Iso/2D cameras,
// demand-driven rAF scheduling, continuous paced streaming, and fast heightfield terrain picking.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { WorldDimension } from '@shared/api'
import type { Orientation } from '@/entities/viewer/model/axis-gizmo'
import type { CameraMode, LightingMode, WorldCursor } from '../model/types'
import { raymarchHeightfield } from './raymarch'
import { WorldStreamer } from './WorldStreamer'

const K = Math.PI
const UP = new THREE.Vector3(0, 1, 0)
const MOVING_STREAM_INTERVAL_MS = 200
const IDLE_STREAM_INTERVAL_MS = 120
const MAX_PIXEL_RATIO = 1.5

interface SkyPalette {
  zenith: number
  horizon: number
  ground: number
}

function skyFor(dim: WorldDimension, lighting: LightingMode, dark: boolean): SkyPalette {
  if (lighting === 'game') {
    const grey = dark ? 0x292929 : 0xe4e4e4
    return { zenith: grey, horizon: grey, ground: grey }
  }
  if (dim === 'nether') {
    return { zenith: 0x260d10, horizon: 0x541f1c, ground: 0x220c0d }
  }
  if (dim === 'end') {
    return { zenith: 0x0d0a17, horizon: 0x1e1733, ground: 0x0b0813 }
  }
  return dark
    ? { zenith: 0x355c8c, horizon: 0x7ba4cc, ground: 0x273545 }
    : { zenith: 0x5c96db, horizon: 0xb7d7f7, ground: 0x99b3cc }
}

/** Smooth vertical sky-gradient dome that always tracks the camera (expanded radius for large builds). */
function createSkyDome(): {
  mesh: THREE.Mesh
  uniforms: {
    uTop: { value: THREE.Color }
    uHorizon: { value: THREE.Color }
    uBottom: { value: THREE.Color }
  }
} {
  const uniforms = {
    uTop: { value: new THREE.Color(0x355c8c) },
    uHorizon: { value: new THREE.Color(0x7ba4cc) },
    uBottom: { value: new THREE.Color(0x273545) }
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, -1.0, 1.0);
        vec3 col = h >= 0.0
          ? mix(uHorizon, uTop, pow(h, 0.55))
          : mix(uHorizon, uBottom, pow(-h, 0.45));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(9000, 24, 16), mat)
  mesh.frustumCulled = false
  mesh.renderOrder = -10
  return { mesh, uniforms }
}

export class WorldScene {
  readonly scene = new THREE.Scene()
  readonly gl: THREE.WebGLRenderer
  readonly perspective = new THREE.PerspectiveCamera(52, 1, 1, 12000)
  readonly ortho = new THREE.OrthographicCamera(-120, 120, 120, -120, 1, 12000)
  readonly controls: OrbitControls
  readonly lights = new THREE.Group()
  readonly overlayRoot = new THREE.Group()

  activeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera = this.perspective
  cameraMode: CameraMode = '3d'

  private sky = createSkyDome()
  private raycaster = new THREE.Raycaster()
  private fwdScratch = new THREE.Vector3()
  private rightScratch = new THREE.Vector3()
  private moveScratch = new THREE.Vector3()
  private ndcScratch = new THREE.Vector2()
  private aspect = 1
  private raf = 0
  private pumpTimer: ReturnType<typeof setTimeout> | null = null
  private dirty = true
  private disposed = false
  private dim: WorldDimension = 'overworld'
  private lighting: LightingMode = 'sun'
  private dark = true
  private keys = new Set<string>()
  private lastTime = 0
  private lastStreamAt = 0
  private lastStreamX = Number.NaN
  private lastStreamZ = Number.NaN
  private lastStreamDist = Number.NaN
  private lastStreamMode: CameraMode | null = null
  private controlsActive = false
  private dampingUntil = 0
  private mountSkipFrames = 0
  private orientationPending = false
  private lastQuat: Orientation = [Number.NaN, Number.NaN, Number.NaN, Number.NaN]

  // Smooth fly-to animation target
  private anim: {
    startPos: THREE.Vector3
    endPos: THREE.Vector3
    startTarget: THREE.Vector3
    endTarget: THREE.Vector3
    t: number
    dur: number
  } | null = null

  private onCameraChange?: (orientation: Orientation) => void
  private onDomPointerDown = (): void => {
    this.controlsActive = true
    this.wake()
  }
  private onDomPointerUp = (): void => {
    this.controlsActive = false
    this.dampingUntil = Math.max(this.dampingUntil, performance.now() + 260)
    this.wake()
  }
  private onDomWheel = (): void => {
    this.dampingUntil = Math.max(this.dampingUntil, performance.now() + 260)
    this.wake()
  }
  private onVisibilityChange = (): void => {
    if (
      !document.hidden &&
      (this.dirty || this.streamer.hasPendingMounts() || this.streamer.needsPump())
    ) {
      this.wake()
    }
  }

  constructor(
    readonly container: HTMLElement,
    readonly streamer: WorldStreamer,
    onCameraChange?: (orientation: Orientation) => void
  ) {
    this.onCameraChange = onCameraChange
    this.streamer.setDeferredMounts(true)

    this.gl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))
    this.gl.localClippingEnabled = true
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace
    this.gl.domElement.style.display = 'block'
    this.gl.domElement.style.width = '100%'
    this.gl.domElement.style.height = '100%'
    container.appendChild(this.gl.domElement)

    this.lights.matrixAutoUpdate = false
    this.lights.updateMatrix()

    this.scene.add(this.sky.mesh)
    this.scene.add(this.lights)
    this.scene.add(streamer.lowresGroup)
    this.scene.add(streamer.hiresGroup)
    this.scene.add(this.overlayRoot)

    this.controls = new OrbitControls(this.perspective, this.gl.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.16
    this.controls.screenSpacePanning = false
    this.controls.maxPolarAngle = Math.PI * 0.485
    this.controls.minDistance = 8
    this.controls.maxDistance = 3200
    this.controls.minZoom = 0.08
    this.controls.maxZoom = 12
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN
    }
    this.controls.addEventListener('change', () => {
      this.dirty = true
      this.orientationPending = true
      this.wake()
    })

    this.gl.domElement.addEventListener('pointerdown', this.onDomPointerDown, { passive: true })
    window.addEventListener('pointerup', this.onDomPointerUp, { passive: true })
    window.addEventListener('pointercancel', this.onDomPointerUp, { passive: true })
    window.addEventListener('blur', this.onDomPointerUp)
    this.gl.domElement.addEventListener('wheel', this.onDomWheel, { passive: true })
    document.addEventListener('visibilitychange', this.onVisibilityChange)

    this.perspective.position.set(110, 145, 110)
    this.controls.target.set(0, 66, 0)
    this.controls.update()
    this.emitOrientationIfChanged()

    this.applyAtmosphere()
    this.resize()
    this.wake()
  }

  get domElement(): HTMLCanvasElement {
    return this.gl.domElement
  }

  invalidate(): void {
    this.dirty = true
    this.wake()
  }

  private clearPumpTimer(): void {
    if (this.pumpTimer !== null) {
      clearTimeout(this.pumpTimer)
      this.pumpTimer = null
    }
  }

  private wake(): void {
    if (this.disposed || this.raf) return
    this.clearPumpTimer()
    this.lastTime = 0
    this.raf = requestAnimationFrame(this.loop)
  }

  setAtmosphere(dim: WorldDimension, lighting: LightingMode, dark: boolean): void {
    this.dim = dim
    this.lighting = lighting
    this.dark = dark
    this.applyAtmosphere()
    this.invalidate()
  }

  private applyAtmosphere(): void {
    const pal = skyFor(this.dim, this.lighting, this.dark)
    this.sky.uniforms.uTop.value.setHex(pal.zenith, THREE.LinearSRGBColorSpace)
    this.sky.uniforms.uHorizon.value.setHex(pal.horizon, THREE.LinearSRGBColorSpace)
    this.sky.uniforms.uBottom.value.setHex(pal.ground, THREE.LinearSRGBColorSpace)
    this.sky.mesh.visible = this.cameraMode === '3d'
    this.scene.background = new THREE.Color().setHex(pal.horizon, THREE.LinearSRGBColorSpace)

    // Fog disabled across all scales and modes so large builds and distant horizons stay crisp
    this.scene.fog = null

    this.lights.clear()
    if (this.lighting === 'game') {
      const dir = (intensity: number, x: number, y: number, z: number): THREE.DirectionalLight => {
        const l = new THREE.DirectionalLight(0xffffff, intensity * K)
        l.position.set(x, y, z)
        l.matrixAutoUpdate = false
        l.updateMatrix()
        return l
      }
      const amb = new THREE.AmbientLight(0xffffff, 0.56 * K)
      amb.matrixAutoUpdate = false
      amb.updateMatrix()
      this.lights.add(
        amb,
        dir(0.44, 0, 1, 0),
        dir(0.22, 0, 0, 1),
        dir(0.22, 0, 0, -1),
        dir(0.1, 1, 0, 0),
        dir(0.1, -1, 0, 0)
      )
    } else {
      // Warm directional sunlight + cool sky/ground fill
      const sunColor = this.dim === 'nether' ? 0xffb380 : this.dim === 'end' ? 0xd8c8ff : 0xfff5e4
      const skyColor = this.dim === 'nether' ? 0x994433 : this.dim === 'end' ? 0x6b5a99 : 0xcfe4ff
      const groundColor =
        this.dim === 'nether' ? 0x3b1514 : this.dim === 'end' ? 0x201833 : 0x6f7568
      const sun = new THREE.DirectionalLight(sunColor, 0.62 * K)
      sun.position.set(-220, 320, -160)
      sun.matrixAutoUpdate = false
      sun.updateMatrix()
      const hemi = new THREE.HemisphereLight(skyColor, groundColor, 0.58 * K)
      hemi.matrixAutoUpdate = false
      hemi.updateMatrix()
      this.lights.add(hemi, sun)
    }
    this.lights.updateMatrixWorld(true)
  }

  resize(): void {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.aspect = w / h
    this.gl.setSize(w, h, false)
    this.perspective.aspect = this.aspect
    this.perspective.updateProjectionMatrix()
    this.ortho.left = -this.ortho.top * this.aspect
    this.ortho.right = this.ortho.top * this.aspect
    this.ortho.updateProjectionMatrix()
    this.invalidate()
  }

  /** Switch between 3D Perspective, Isometric, and Top-Down 2D camera modes smoothly. */
  setCameraMode(mode: CameraMode): void {
    if (this.cameraMode === mode) return
    const target = this.controls.target.clone()
    const currentDist = Math.max(40, this.effectiveDistance())
    this.cameraMode = mode

    if (mode === '3d') {
      this.activeCamera = this.perspective
      this.controls.object = this.perspective
      this.controls.enableRotate = true
      this.controls.maxPolarAngle = Math.PI * 0.485
      this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE
      const offset = new THREE.Vector3(0.65, 0.72, 0.65)
        .normalize()
        .multiplyScalar(Math.min(600, currentDist))
      this.perspective.position.copy(target).add(offset)
    } else if (mode === 'iso') {
      this.activeCamera = this.ortho
      this.controls.object = this.ortho
      this.controls.enableRotate = true
      this.controls.maxPolarAngle = Math.PI * 0.48
      this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE
      this.ortho.top = Math.min(640, Math.max(45, currentDist * 0.48))
      this.ortho.bottom = -this.ortho.top
      this.ortho.zoom = 1
      this.ortho.position.copy(target).add(new THREE.Vector3(900, 900, 900))
    } else {
      // Top-down north-up 2D map: left-drag pans!
      this.activeCamera = this.ortho
      this.controls.object = this.ortho
      this.controls.enableRotate = false
      this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN
      this.ortho.top = Math.min(900, Math.max(60, currentDist * 0.6))
      this.ortho.bottom = -this.ortho.top
      this.ortho.zoom = 1
      this.ortho.position.set(target.x, target.y + 1200, target.z + 0.01)
    }

    this.resize()
    this.controls.target.copy(target)
    this.controls.update()
    this.applyAtmosphere()
    this.emitOrientationIfChanged()
    this.invalidate()
  }

  /** Smoothly fly the camera to look at (x, y, z). */
  flyTo(x: number, y: number, z: number, distance?: number): void {
    const endTarget = new THREE.Vector3(x, y, z)
    const dir = this.activeCamera.position.clone().sub(this.controls.target)
    const dist = distance ?? Math.max(60, Math.min(400, dir.length() || 140))
    if (this.cameraMode === 'top') {
      dir.set(0, 1200, 0.01)
    } else if (dir.lengthSq() < 1) {
      dir.set(1, 1.1, 1).normalize().multiplyScalar(dist)
    } else {
      dir.normalize().multiplyScalar(this.cameraMode === 'iso' ? 1200 : dist)
    }
    this.anim = {
      startPos: this.activeCamera.position.clone(),
      endPos: endTarget.clone().add(dir),
      startTarget: this.controls.target.clone(),
      endTarget,
      t: 0,
      dur: 0.36
    }
    this.invalidate()
  }

  /** Jump immediately without animation (on first world load). */
  snapTo(x: number, y: number, z: number, distance = 150): void {
    this.anim = null
    const target = new THREE.Vector3(x, y, z)
    this.controls.target.copy(target)
    if (this.cameraMode === 'top') {
      this.activeCamera.position.set(x, y + 1200, z + 0.01)
    } else if (this.cameraMode === 'iso') {
      this.activeCamera.position.copy(target).add(new THREE.Vector3(900, 900, 900))
    } else {
      this.activeCamera.position
        .copy(target)
        .add(new THREE.Vector3(0.65, 0.72, 0.65).normalize().multiplyScalar(distance))
    }
    this.controls.update()
    this.emitOrientationIfChanged()
    this.updateStreaming(true)
    this.invalidate()
  }

  /** Orbit camera around current target by (yaw, pitch) radians (for AxisGizmo drag). */
  orbitBy(yaw: number, pitch: number): void {
    if (this.cameraMode === 'top') return
    const offset = this.activeCamera.position.clone().sub(this.controls.target)
    const sph = new THREE.Spherical().setFromVector3(offset)
    sph.theta -= yaw
    sph.phi = Math.max(0.08, Math.min(Math.PI * 0.485, sph.phi - pitch))
    offset.setFromSpherical(sph)
    this.activeCamera.position.copy(this.controls.target).add(offset)
    this.controls.update()
    this.orientationPending = true
    this.invalidate()
  }

  /** Turn camera to look from direction `dir` (for AxisGizmo bubble clicks). */
  lookFrom(dir: [number, number, number]): void {
    if (dir[1] > 0.9) {
      this.setCameraMode('top')
      return
    }
    if (this.cameraMode === 'top') this.setCameraMode('3d')
    const dist = this.activeCamera.position.distanceTo(this.controls.target)
    const v = new THREE.Vector3(dir[0], Math.max(0.28, dir[1]), dir[2])
      .normalize()
      .multiplyScalar(dist)
    this.activeCamera.position.copy(this.controls.target).add(v)
    this.controls.update()
    this.orientationPending = true
    this.invalidate()
  }

  setFlyKey(key: string, down: boolean): void {
    const k = key.toLowerCase()
    if (down) this.keys.add(k)
    else this.keys.delete(k)
    if (down) this.invalidate()
  }

  /**
   * Pick world terrain under screen pointer.
   * Uses fast O(1)-step analytical heightfield ray-marching for hover; when `exactHires` is true
   * (clicks / drags), checks only hires chunks whose bounding sphere intersects the ray first.
   */
  pickTerrain(clientX: number, clientY: number, exactHires = false): WorldCursor | null {
    const rect = this.gl.domElement.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    this.ndcScratch.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    this.raycaster.setFromCamera(this.ndcScratch, this.activeCamera)
    const ray = this.raycaster.ray

    // 1. On click/drag, pre-filter hires chunks by bounding sphere before triangle testing (typically 1-4 chunks)
    if (exactHires && this.streamer.hiresGroup.children.length > 0) {
      const candidates: THREE.Object3D[] = []
      for (const chunkGroup of this.streamer.hiresGroup.children) {
        for (const child of chunkGroup.children) {
          if (!child.userData.isTerrain || !(child instanceof THREE.Mesh)) continue
          const bs = child.geometry.boundingSphere
          if (bs && ray.intersectsSphere(bs)) candidates.push(child)
        }
      }
      if (candidates.length > 0) {
        const hiresHits = this.raycaster.intersectObjects(candidates, false)
        for (const h of hiresHits) {
          const p = h.point
          const n = h.face?.normal
          const x = Math.floor(p.x - (n ? n.x * 0.01 : 0))
          const z = Math.floor(p.z - (n ? n.z * 0.01 : 0))
          const y = Math.floor(p.y - (n ? n.y * 0.01 : 0.01))
          return { x, y, z }
        }
      }
    }

    // 2. Analytical heightfield ray-march across loaded hires + lowres heightmaps (< 0.05 ms)
    const hit = raymarchHeightfield(
      [ray.origin.x, ray.origin.y, ray.origin.z],
      [ray.direction.x, ray.direction.y, ray.direction.z],
      (x, z) => this.streamer.heightAt(x, z),
      Math.max(4500, this.effectiveDistance() * 3)
    )
    if (hit) return hit

    // 3. Fallback horizontal ground plane at current target Y
    const plane = new THREE.Plane(UP, -this.controls.target.y)
    const pt = new THREE.Vector3()
    if (ray.intersectPlane(plane, pt)) {
      const x = Math.floor(pt.x)
      const z = Math.floor(pt.z)
      const y = this.streamer.heightAt(x, z) ?? Math.round(this.controls.target.y)
      return { x, y, z }
    }
    return null
  }

  effectiveDistance(): number {
    if (this.activeCamera instanceof THREE.OrthographicCamera) {
      return (this.activeCamera.top * 2) / Math.max(0.05, this.activeCamera.zoom)
    }
    return this.activeCamera.position.distanceTo(this.controls.target)
  }

  /** Emit camera quaternion only when rotation actually changed (skips pure panning/zooming). */
  private emitOrientationIfChanged(): void {
    this.orientationPending = false
    if (!this.onCameraChange) return
    const q = this.activeCamera.quaternion
    const [lx, ly, lz, lw] = this.lastQuat
    if (!Number.isNaN(lx)) {
      const dot = Math.abs(q.x * lx + q.y * ly + q.z * lz + q.w * lw)
      if (1 - dot < 1e-6) return
    }
    this.lastQuat = [q.x, q.y, q.z, q.w]
    this.onCameraChange(this.lastQuat)
  }

  private hasMovementKeys(): boolean {
    return this.keys.has('w') || this.keys.has('a') || this.keys.has('s') || this.keys.has('d')
  }

  private applyKeyboardFly(dt: number): boolean {
    if (!this.hasMovementKeys()) return false
    const fwd = this.fwdScratch
    this.activeCamera.getWorldDirection(fwd)
    fwd.y = 0
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1)
    fwd.normalize()
    const right = this.rightScratch.crossVectors(fwd, UP).normalize()
    const boost = this.keys.has('shift') ? 2.5 : 1
    const speed = Math.max(24, this.effectiveDistance() * 0.9) * boost * dt
    const move = this.moveScratch.set(0, 0, 0)
    if (this.keys.has('w')) move.addScaledVector(fwd, speed)
    if (this.keys.has('s')) move.addScaledVector(fwd, -speed)
    if (this.keys.has('d')) move.addScaledVector(right, speed)
    if (this.keys.has('a')) move.addScaledVector(right, -speed)
    if (move.lengthSq() === 0) return false
    this.activeCamera.position.add(move)
    this.controls.target.add(move)
    return true
  }

  private updateStreaming(force: boolean): void {
    const tx = this.controls.target.x
    const tz = this.controls.target.z
    const dist = this.effectiveDistance()
    const moved =
      force ||
      this.streamer.needsPump() ||
      this.lastStreamMode !== this.cameraMode ||
      Number.isNaN(this.lastStreamX) ||
      Math.hypot(tx - this.lastStreamX, tz - this.lastStreamZ) >= 8 ||
      Math.abs(dist - this.lastStreamDist) / Math.max(1, this.lastStreamDist) >= 0.06

    if (!moved) return
    this.lastStreamX = tx
    this.lastStreamZ = tz
    this.lastStreamDist = dist
    this.lastStreamMode = this.cameraMode

    this.activeCamera.getWorldDirection(this.fwdScratch)
    this.streamer.update(tx, tz, dist, this.cameraMode, this.fwdScratch.x, this.fwdScratch.z)
  }

  private loop = (now: number): void => {
    this.raf = 0
    if (this.disposed) return

    const dt = Math.min(0.05, Math.max(0.001, (now - (this.lastTime || now)) / 1000))
    this.lastTime = now

    if (this.anim) {
      this.anim.t = Math.min(1, this.anim.t + dt / this.anim.dur)
      const ease = 1 - Math.pow(1 - this.anim.t, 3)
      this.activeCamera.position.lerpVectors(this.anim.startPos, this.anim.endPos, ease)
      this.controls.target.lerpVectors(this.anim.startTarget, this.anim.endTarget, ease)
      if (this.anim.t >= 1) this.anim = null
      this.dirty = true
      this.orientationPending = true
    }

    const flew = this.applyKeyboardFly(dt)
    if (flew) this.dirty = true
    const controlsChanged = this.controls.update()
    if (controlsChanged) this.dirty = true

    if (this.orientationPending) {
      this.emitOrientationIfChanged()
    }

    const isMoving =
      this.controlsActive ||
      flew ||
      this.hasMovementKeys() ||
      !!this.anim ||
      controlsChanged ||
      now < this.dampingUntil

    // Continuous paced GPU mounting: keep loading while moving, but limit to <=1 mesh with breathing frames
    if (this.streamer.hasPendingMounts()) {
      if (this.mountSkipFrames > 0) {
        this.mountSkipFrames--
      } else {
        const budgetMs = isMoving ? 1.5 : 2.5
        const maxItems = isMoving ? 1 : 2
        if (this.streamer.flushMounts(budgetMs, maxItems)) {
          this.dirty = true
          if (this.streamer.lastFlushHeavy()) {
            this.mountSkipFrames = isMoving ? 2 : 1
          } else if (isMoving) {
            this.mountSkipFrames = 1
          }
        }
      }
    }

    // Continuous streaming sweeps with a strict minimum interval so needsPump() never runs back-to-back every frame
    const streamInterval = isMoving ? MOVING_STREAM_INTERVAL_MS : IDLE_STREAM_INTERVAL_MS
    const elapsedSinceStream = now - this.lastStreamAt
    if (
      (this.streamer.needsPump() && elapsedSinceStream >= streamInterval) ||
      elapsedSinceStream >= MOVING_STREAM_INTERVAL_MS
    ) {
      this.lastStreamAt = now
      this.updateStreaming(false)
    }

    if (this.dirty && !document.hidden) {
      this.dirty = false
      this.sky.mesh.position.copy(this.activeCamera.position)
      this.gl.render(this.scene, this.activeCamera)
    }

    // Keep rAF running while animating/moving/mounting; otherwise defer pump check to a lightweight timer
    if (document.hidden) return

    const keepRaf = this.dirty || isMoving || this.streamer.hasPendingMounts()

    if (keepRaf) {
      this.raf = requestAnimationFrame(this.loop)
    } else if (this.streamer.needsPump()) {
      const waitMs = Math.max(16, IDLE_STREAM_INTERVAL_MS - (now - this.lastStreamAt))
      this.clearPumpTimer()
      this.pumpTimer = setTimeout(() => {
        this.pumpTimer = null
        this.wake()
      }, waitMs)
    }
  }

  dispose(): void {
    this.disposed = true
    this.clearPumpTimer()
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.gl.domElement.removeEventListener('pointerdown', this.onDomPointerDown)
    window.removeEventListener('pointerup', this.onDomPointerUp)
    window.removeEventListener('pointercancel', this.onDomPointerUp)
    window.removeEventListener('blur', this.onDomPointerUp)
    this.gl.domElement.removeEventListener('wheel', this.onDomWheel)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.controls.dispose()
    this.sky.mesh.geometry.dispose()
    ;(this.sky.mesh.material as THREE.Material).dispose()
    this.gl.dispose()
    this.gl.domElement.remove()
  }
}
