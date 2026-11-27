// The game look, shared by the app's live view and the engine's PNG sheets (tools/render/viewer.html).
import * as THREE from 'three'
import { TRANSLUCENT } from './resources'
import type { Renderer } from './renderer'

export type Look = 'game' | 'sun' | 'flat'

export interface LookOptions {
  look: Look
  sun: [number, number] // compass azimuth (0 = north, 90 = east), elevation
  shadow: number // shadow map size (sun look)
  ao: number // SSAO: times the default per-camera strength (0 = off)
  aoradius?: number // SSAO radius in blocks (0 or unset: the per-camera default)
  bg: string // background colour (the PNG sheets use the game's plains sky, 78a7ff)
  fog: number
  glass?: 'blend' | 'opaque' // opaque: stained glass drawn as tinted panes
}

export const DEFAULT_LOOK: LookOptions = {
  look: 'game',
  sun: [135, 45],
  shadow: 4096,
  ao: 1,
  bg: '27272a',
  fog: 1
}

// SSAO per camera: iso is much gentler, stronger shows every block seam
const SSAO = {
  perspective: { aoRadius: 1, distanceFalloff: 0.4, intensity: 5 },
  isometric: { aoRadius: 0.3, distanceFalloff: 0.1, intensity: 0.8 }
}

// Lambert divides by pi, so a light of intensity pi lights a face facing it to its full texture colour.
const K = Math.PI

export interface Scene {
  centre: THREE.Vector3
  radius: number
  bg: THREE.Color
}

/** Fit a directional light's orthographic shadow frustum tightly around `box` (and optional ground shadow). */
export function fitDirectionalShadow(
  sun: THREE.DirectionalLight,
  box: THREE.Box3,
  lightDir: THREE.Vector3,
  mapSize: number,
  includeGroundShadow = false
): void {
  const dir = lightDir.clone().normalize()
  const centre = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const radius = Math.max(size.length() / 2, 1)

  sun.position.copy(centre).addScaledVector(dir, radius * 2.5)
  sun.target.position.copy(centre)
  sun.updateMatrixWorld(true)
  sun.target.updateMatrixWorld(true)

  const cam = sun.shadow.camera
  cam.up.set(0, Math.abs(dir.y) > 0.995 ? 0 : 1, Math.abs(dir.y) > 0.995 ? -1 : 0)
  cam.position.copy(sun.position)
  cam.lookAt(centre)
  cam.updateMatrixWorld(true)

  const inv = cam.matrixWorldInverse
  const points: THREE.Vector3[] = []
  for (let i = 0; i < 8; i++) {
    points.push(
      new THREE.Vector3(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z
      )
    )
  }
  if (includeGroundShadow && dir.y > 0.08) {
    const height = Math.max(0, box.max.y - box.min.y)
    // Cap low-sun ground shadow reach so grazing angles don't collapse shadow map resolution.
    const maxShift = radius * 2.2
    const step = Math.min(height / dir.y, maxShift)
    for (let i = 0; i < 4; i++) {
      const topCorner = new THREE.Vector3(
        i & 1 ? box.max.x : box.min.x,
        box.max.y,
        i & 2 ? box.max.z : box.min.z
      )
      points.push(
        new THREE.Vector3(
          topCorner.x - dir.x * step,
          box.min.y,
          topCorner.z - dir.z * step
        )
      )
    }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minDepth = Infinity
  let maxDepth = -Infinity
  for (const p of points) {
    const local = p.clone().applyMatrix4(inv)
    if (local.x < minX) minX = local.x
    if (local.x > maxX) maxX = local.x
    if (local.y < minY) minY = local.y
    if (local.y > maxY) maxY = local.y
    const depth = -local.z
    if (depth < minDepth) minDepth = depth
    if (depth > maxDepth) maxDepth = depth
  }

  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY - minY)
  const spanZ = Math.max(1, maxDepth - minDepth)
  const padXY = Math.max(0.5, Math.max(spanX, spanY) * 0.03)
  const padZ = Math.max(1, spanZ * 0.05)

  sun.shadow.mapSize.set(mapSize, mapSize)
  cam.left = minX - padXY
  cam.right = maxX + padXY
  cam.bottom = minY - padXY
  cam.top = maxY + padXY
  cam.near = Math.max(0.1, minDepth - padZ)
  cam.far = Math.max(cam.near + 1, maxDepth + padZ)
  cam.updateProjectionMatrix()

  const texel = Math.max(cam.right - cam.left, cam.top - cam.bottom) / Math.max(1, mapSize)
  sun.shadow.bias = -0.0002
  sun.shadow.normalBias = Math.max(0.02, texel * 1.15)
}

export function applyLook(r: Renderer, LOOK: LookOptions): Scene {
  const scene = r.scene
  const gl = r.gl
  const box = new THREE.Box3()
  for (const o of r.getAllSchematics()) box.expandByObject(o.group)
  if (box.isEmpty()) box.set(new THREE.Vector3(), new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1)
  const bg = new THREE.Color().setHex(parseInt(LOOK.bg, 16), THREE.LinearSRGBColorSpace)

  const dirLight = (intensity: number, [x, y, z]: number[]): THREE.DirectionalLight => {
    const l = new THREE.DirectionalLight(0xffffff, intensity * K)
    l.position.set(centre.x + x, centre.y + y, centre.z + z)
    l.target.position.copy(centre)
    return l
  }

  // the game multiplies texels by the light directly: no sRGB encode, no gamma pass
  gl.outputColorSpace = THREE.LinearSRGBColorSpace
  gl.shadowMap.enabled = false
  // dispose frees a shadow-casting light's shadow map, which clear() would leave on the GPU
  for (const l of r.lights.children) if (l instanceof THREE.Light) l.dispose()
  r.lights.clear()
  if (LOOK.look === 'flat') r.lights.add(new THREE.AmbientLight(0xffffff, K))
  else if (LOOK.look === 'game') {
    // per-face shade as in the game: up 1.0, down 0.5, N/S 0.8, E/W 0.6 (ambient 0.5 + one light per axis side)
    r.lights.add(
      new THREE.AmbientLight(0xffffff, 0.5 * K),
      dirLight(0.5, [0, 1, 0]),
      dirLight(0.3, [0, 0, 1]),
      dirLight(0.3, [0, 0, -1]),
      dirLight(0.1, [1, 0, 0]),
      dirLight(0.1, [-1, 0, 0])
    )
  } else {
    // a sun at a set compass bearing and elevation, casting shadows, plus sky and ground fill
    const [az, el] = LOOK.sun.map((v) => THREE.MathUtils.degToRad(v))
    const d = new THREE.Vector3(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      -Math.cos(az) * Math.cos(el)
    )
    const sun = dirLight(0.6, d.clone().multiplyScalar(2 * radius).toArray())
    sun.castShadow = true
    const mapSize = Math.min(LOOK.shadow, gl.capabilities.maxTextureSize)
    fitDirectionalShadow(sun, box, d, mapSize, false)
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFShadowMap // three draws PCFSoftShadowMap as this anyway
    r.lights.add(new THREE.HemisphereLight(0xdde8ff, 0x9a9488, 0.6 * K), sun)
  }
  for (const l of [...r.lights.children] as THREE.DirectionalLight[])
    if (l.target) r.lights.add(l.target)

  for (const o of r.getAllSchematics()) {
    const m = o.materials[TRANSLUCENT]
    // opaque glass: alpha-0 texels still cut out
    m.transparent = m.opacity < 1 || LOOK.glass !== 'opaque'
    m.depthWrite = !o.maskOnly && !m.transparent
    m.needsUpdate = true
    o.materials.forEach((mat) => (mat.needsUpdate = true))
  }

  const radiusOverride = LOOK.aoradius ? { aoRadius: LOOK.aoradius } : {}
  r.setSSAO(
    LOOK.ao > 0
      ? {
          perspective: {
            ...SSAO.perspective,
            intensity: SSAO.perspective.intensity * LOOK.ao,
            ...radiusOverride
          },
          isometric: {
            ...SSAO.isometric,
            intensity: SSAO.isometric.intensity * LOOK.ao,
            ...radiusOverride
          }
        }
      : null
  )
  scene.background = bg
  r.invalidate()
  return { centre, radius, bg }
}
