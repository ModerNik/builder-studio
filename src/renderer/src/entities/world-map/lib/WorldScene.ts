// BlueMap-inspired Three.js scene, atmosphere, lighting, smooth 3D/Iso/2D cameras, and terrain raycasting.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { WorldDimension } from '@shared/api'
import type { Orientation } from '@/entities/viewer/model/axis-gizmo'
import type { CameraMode, LightingMode, WorldCursor } from '../model/types'
import { WorldStreamer } from './WorldStreamer'

const K = Math.PI

interface SkyPalette {
  zenith: number
  horizon: number
  ground: number
  fog: number
}

function skyFor(dim: WorldDimension, lighting: LightingMode, dark: boolean): SkyPalette {
  if (lighting === 'game') {
    const grey = dark ? 0x292929 : 0xe4e4e4
    return { zenith: grey, horizon: grey, ground: grey, fog: grey }
  }
  if (dim === 'nether') {
    return { zenith: 0x260d10, horizon: 0x541f1c, ground: 0x220c0d, fog: 0x4b1d1b }
  }
  if (dim === 'end') {
    return { zenith: 0x0d0a17, horizon: 0x1e1733, ground: 0x0b0813, fog: 0x1b152d }
  }
  return dark
    ? { zenith: 0x355c8c, horizon: 0x7ba4cc, ground: 0x273545, fog: 0x739bc2 }
    : { zenith: 0x5c96db, horizon: 0xb7d7f7, ground: 0x99b3cc, fog: 0xb0d2f4 }
}

/** Smooth vertical sky-gradient dome that always tracks the camera (BlueMap atmosphere). */
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
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(2400, 24, 16), mat)
  mesh.frustumCulled = false
  mesh.renderOrder = -10
  return { mesh, uniforms }
}

export class WorldScene {
  readonly scene = new THREE.Scene()
  readonly gl: THREE.WebGLRenderer
  readonly perspective = new THREE.PerspectiveCamera(52, 1, 0.5, 4000)
  readonly ortho = new THREE.OrthographicCamera(-120, 120, 120, -120, 0.5, 4000)
  readonly controls: OrbitControls
  readonly lights = new THREE.Group()
  readonly overlayRoot = new THREE.Group()

  activeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera = this.perspective
  cameraMode: CameraMode = '3d'

  private sky = createSkyDome()
  private raycaster = new THREE.Raycaster()
  private aspect = 1
  private raf = 0
  private dirty = true
  private disposed = false
  private dim: WorldDimension = 'overworld'
  private lighting: LightingMode = 'sun'
  private dark = true
  private keys = new Set<string>()
  private lastTime = 0
  private lastStreamAt = 0

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

  constructor(
    readonly container: HTMLElement,
    readonly streamer: WorldStreamer,
    onCameraChange?: (orientation: Orientation) => void
  ) {
    this.onCameraChange = onCameraChange
    this.gl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace
    this.gl.domElement.style.display = 'block'
    this.gl.domElement.style.width = '100%'
    this.gl.domElement.style.height = '100%'
    container.appendChild(this.gl.domElement)

    this.scene.add(this.sky.mesh)
    this.scene.add(this.lights)
    this.scene.add(streamer.lowresGroup)
    this.scene.add(streamer.hiresGroup)
    this.scene.add(this.overlayRoot)

    this.controls = new OrbitControls(this.perspective, this.gl.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.1
    this.controls.screenSpacePanning = false
    this.controls.maxPolarAngle = Math.PI * 0.485
    this.controls.minDistance = 8
    this.controls.maxDistance = 1200
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN
    }
    this.controls.addEventListener('change', () => {
      this.dirty = true
      this.emitOrientation()
    })

    this.perspective.position.set(110, 145, 110)
    this.controls.target.set(0, 66, 0)
    this.controls.update()

    this.applyAtmosphere()
    this.resize()
    this.loop(performance.now())
  }

  get domElement(): HTMLCanvasElement {
    return this.gl.domElement
  }

  invalidate(): void {
    this.dirty = true
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

    // Distance horizon fog in 3D mode (BlueMap feel); disabled in flat 2D top-down for crisp reading
    this.scene.fog =
      this.cameraMode === '3d'
        ? new THREE.Fog(new THREE.Color().setHex(pal.fog, THREE.LinearSRGBColorSpace), 340, 1150)
        : null

    this.lights.clear()
    if (this.lighting === 'game') {
      const dir = (intensity: number, x: number, y: number, z: number): THREE.DirectionalLight => {
        const l = new THREE.DirectionalLight(0xffffff, intensity * K)
        l.position.set(x, y, z)
        return l
      }
      this.lights.add(
        new THREE.AmbientLight(0xffffff, 0.56 * K),
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
      const hemi = new THREE.HemisphereLight(skyColor, groundColor, 0.58 * K)
      this.lights.add(hemi, sun)
    }
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
        .multiplyScalar(Math.min(260, currentDist))
      this.perspective.position.copy(target).add(offset)
    } else if (mode === 'iso') {
      this.activeCamera = this.ortho
      this.controls.object = this.ortho
      this.controls.enableRotate = true
      this.controls.maxPolarAngle = Math.PI * 0.48
      this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE
      this.ortho.top = Math.min(260, Math.max(45, currentDist * 0.48))
      this.ortho.bottom = -this.ortho.top
      this.ortho.zoom = 1
      this.ortho.position.copy(target).add(new THREE.Vector3(380, 380, 380))
    } else {
      // Top-down north-up 2D map: left-drag pans!
      this.activeCamera = this.ortho
      this.controls.object = this.ortho
      this.controls.enableRotate = false
      this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN
      this.ortho.top = Math.min(420, Math.max(60, currentDist * 0.6))
      this.ortho.bottom = -this.ortho.top
      this.ortho.zoom = 1
      this.ortho.position.set(target.x, target.y + 600, target.z + 0.01)
    }

    this.resize()
    this.controls.target.copy(target)
    this.controls.update()
    this.applyAtmosphere()
    this.emitOrientation()
    this.invalidate()
  }

  /** Smoothly fly the camera to look at (x, y, z). */
  flyTo(x: number, y: number, z: number, distance?: number): void {
    const endTarget = new THREE.Vector3(x, y, z)
    const dir = this.activeCamera.position.clone().sub(this.controls.target)
    const dist = distance ?? Math.max(60, Math.min(240, dir.length() || 140))
    if (this.cameraMode === 'top') {
      dir.set(0, 600, 0.01)
    } else if (dir.lengthSq() < 1) {
      dir.set(1, 1.1, 1).normalize().multiplyScalar(dist)
    } else {
      dir.normalize().multiplyScalar(this.cameraMode === 'iso' ? 520 : dist)
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
      this.activeCamera.position.set(x, y + 600, z + 0.01)
    } else if (this.cameraMode === 'iso') {
      this.activeCamera.position.copy(target).add(new THREE.Vector3(380, 380, 380))
    } else {
      this.activeCamera.position
        .copy(target)
        .add(new THREE.Vector3(0.65, 0.72, 0.65).normalize().multiplyScalar(distance))
    }
    this.controls.update()
    this.emitOrientation()
    this.streamer.update(x, z, this.effectiveDistance(), this.cameraMode)
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
    this.emitOrientation()
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
    this.emitOrientation()
    this.invalidate()
  }

  setFlyKey(key: string, down: boolean): void {
    const k = key.toLowerCase()
    if (down) this.keys.add(k)
    else this.keys.delete(k)
    if (down) this.invalidate()
  }

  /** Raycast screen pointer against loaded 3D terrain (hires chunks first, then lowres regions, then Y plane). */
  pickTerrain(clientX: number, clientY: number): WorldCursor | null {
    const rect = this.gl.domElement.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    this.raycaster.setFromCamera(ndc, this.activeCamera)

    // 1. Check hires terrain meshes first for exact 1-block precision
    const hiresHits = this.raycaster.intersectObjects(this.streamer.hiresGroup.children, true)
    for (const h of hiresHits) {
      if (h.object.userData.isTerrain) {
        const p = h.point
        const n = h.face?.normal
        const x = Math.floor(p.x - (n ? n.x * 0.01 : 0))
        const z = Math.floor(p.z - (n ? n.z * 0.01 : 0))
        const y = Math.floor(p.y - (n ? n.y * 0.01 : 0.01))
        return { x, y, z }
      }
    }

    // 2. Fall back to lowres terrain meshes
    const lowHits = this.raycaster.intersectObjects(this.streamer.lowresGroup.children, true)
    for (const h of lowHits) {
      if (h.object.userData.isTerrain) {
        const x = Math.floor(h.point.x)
        const z = Math.floor(h.point.z)
        const y = this.streamer.heightAt(x, z) ?? Math.floor(h.point.y)
        return { x, y, z }
      }
    }

    // 3. Fallback horizontal ground plane at current target Y
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.controls.target.y)
    const pt = new THREE.Vector3()
    if (this.raycaster.ray.intersectPlane(plane, pt)) {
      const x = Math.floor(pt.x)
      const z = Math.floor(pt.z)
      const y = this.streamer.heightAt(x, z) ?? Math.round(this.controls.target.y)
      return { x, y, z }
    }
    return null
  }

  effectiveDistance(): number {
    if (this.activeCamera instanceof THREE.OrthographicCamera) {
      return (this.activeCamera.top * 2) / Math.max(0.1, this.activeCamera.zoom)
    }
    return this.activeCamera.position.distanceTo(this.controls.target)
  }

  private emitOrientation(): void {
    if (!this.onCameraChange) return
    const q = this.activeCamera.quaternion
    this.onCameraChange([q.x, q.y, q.z, q.w])
  }

  private applyKeyboardFly(dt: number): boolean {
    if (!this.keys.size) return false
    const fwd = new THREE.Vector3()
    this.activeCamera.getWorldDirection(fwd)
    fwd.y = 0
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1)
    fwd.normalize()
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize()
    const speed = Math.max(24, this.effectiveDistance() * 0.9) * dt
    const move = new THREE.Vector3()
    if (this.keys.has('w')) move.addScaledVector(fwd, speed)
    if (this.keys.has('s')) move.addScaledVector(fwd, -speed)
    if (this.keys.has('d')) move.addScaledVector(right, speed)
    if (this.keys.has('a')) move.addScaledVector(right, -speed)
    if (move.lengthSq() === 0) return false
    this.activeCamera.position.add(move)
    this.controls.target.add(move)
    return true
  }

  private loop = (now: number): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, Math.max(0.001, (now - (this.lastTime || now)) / 1000))
    this.lastTime = now

    if (this.anim) {
      this.anim.t = Math.min(1, this.anim.t + dt / this.anim.dur)
      const ease = 1 - Math.pow(1 - this.anim.t, 3)
      this.activeCamera.position.lerpVectors(this.anim.startPos, this.anim.endPos, ease)
      this.controls.target.lerpVectors(this.anim.startTarget, this.anim.endTarget, ease)
      if (this.anim.t >= 1) this.anim = null
      this.dirty = true
    }

    if (this.applyKeyboardFly(dt)) this.dirty = true
    if (this.controls.update()) this.dirty = true

    // Throttle streaming updates to ~10 Hz while moving
    if (now - this.lastStreamAt > 100) {
      this.lastStreamAt = now
      this.streamer.update(
        this.controls.target.x,
        this.controls.target.z,
        this.effectiveDistance(),
        this.cameraMode
      )
    }

    if (!this.dirty) return
    this.dirty = false
    this.sky.mesh.position.copy(this.activeCamera.position)
    this.gl.render(this.scene, this.activeCamera)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.controls.dispose()
    this.sky.mesh.geometry.dispose()
    ;(this.sky.mesh.material as THREE.Material).dispose()
    this.gl.dispose()
    this.gl.domElement.remove()
  }
}
