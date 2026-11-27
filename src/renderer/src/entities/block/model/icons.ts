// Block icons: each block state drawn once, isometric, from the game's textures with the game's face shading,
// into a cached image URL. A few draw per frame, so a picker grid fills in without a stall.
import { useEffect, useSyncExternalStore } from 'react'
import {
  THREE,
  acquireResources,
  loadResources,
  releaseResources,
  type Resources
} from '@/entities/viewer/lib/render'
import { BUCKETS, Mesher } from '@/entities/viewer/lib/render/mesher'
import { CUTOUT, OPAQUE } from '@/entities/viewer/lib/render/resources'

const SIZE = 64 // pixels; tiles show them at 36 to 48
const STRIDE = 11 // the mesher's vertex layout: position, normal, uv, colour
const BUDGET = 8 // milliseconds of drawing per frame
const IDLE_MS = 10_000 // the drawing context is freed this long after the last icon
// the game shades faces by direction: top, bottom, north and south, east and west
const shade = (ny: number, nz: number): number =>
  ny > 0.5 ? 1 : ny < -0.5 ? 0.5 : Math.abs(nz) > 0.5 ? 0.8 : 0.6

let gl: THREE.WebGLRenderer | null = null
let idle: ReturnType<typeof setTimeout> | undefined
function releaseSoon(): void {
  clearTimeout(idle)
  idle = setTimeout(() => {
    gl?.dispose()
    gl?.forceContextLoss()
    gl = null
  }, IDLE_MS)
}
const scene = new THREE.Scene()
// the game's inventory angle: 30° down, from the south-east, so south shows left and east right
const camera = new THREE.OrthographicCamera(-0.85, 0.85, 0.85, -0.85, 0.1, 10)
camera.position.set(Math.SQRT1_2 * Math.cos(Math.PI / 6), 0.5, Math.SQRT1_2 * Math.cos(Math.PI / 6))
camera.position.multiplyScalar(4)
camera.lookAt(0, 0, 0)

/** Draw one icon as a PNG data URL; '' for a block that draws nothing. */
function draw(res: Resources, materials: THREE.Material[], state: string): string {
  clearTimeout(idle)
  gl ??= new THREE.WebGLRenderer({ alpha: true, antialias: true })
  gl.setSize(SIZE, SIZE, false)
  gl.outputColorSpace = THREE.LinearSRGBColorSpace // the viewer's look: raw texels times the shade
  gl.setClearColor(0x000000, 0)
  const group = new THREE.Group()
  new Mesher(
    { min: [0, 0, 0], size: [1, 1, 1], palette: ['minecraft:air', state], data: Uint16Array.of(1) },
    res,
    null
  ).rebuild(group, materials, [[0, 0, 0]])
  if (!group.children.length) return '' // nothing to draw (air, light, barrier)
  for (const m of group.children as THREE.Mesh[]) {
    const d = (m.geometry.getAttribute('color') as THREE.InterleavedBufferAttribute).data
      .array as Float32Array
    for (let i = 0; i < d.length; i += STRIDE) {
      const k = shade(d[i + 4], d[i + 5])
      d[i + 8] *= k
      d[i + 9] *= k
      d[i + 10] *= k
    }
  }
  scene.add(group)
  gl.render(scene, camera)
  scene.remove(group)
  for (const m of group.children as THREE.Mesh[]) m.geometry.dispose()
  // read in the same task as the render, so the drawing buffer needs no preserving
  return gl.domElement.toDataURL('image/png')
}

class Painter {
  private urls = new Map<string, string>()
  private queue = new Set<string>()
  private listeners = new Set<() => void>()
  private res: Resources | null = null
  private materials: THREE.Material[] = []
  private frame: number | null = null
  private users = 0
  /** The lookup hooks hand out: a new function after each drawn batch, so memoized callers ask again. */
  lookup = (state: string): string | undefined => this.get(state)

  attach(res: Resources): void {
    if (this.res === res) return
    this.res = res
    this.materials = BUCKETS.map(
      (k) =>
        new THREE.MeshBasicMaterial({
          map: res.texture,
          vertexColors: true,
          alphaTest: k === CUTOUT ? 0.5 : k === OPAQUE ? 0 : 0.01,
          transparent: k !== OPAQUE && k !== CUTOUT
        })
    )
    this.schedule()
  }
  retain(): void {
    this.users++
  }
  /** With no picker left, let the pack go; the drawn icons stay. */
  release(): void {
    if (--this.users) return
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null
    this.res = null
    this.materials.forEach((m) => m.dispose())
    this.materials = []
    releaseSoon()
  }
  /** The state's icon: a URL, '' when it draws nothing, undefined until drawn. */
  get(state: string): string | undefined {
    const url = this.urls.get(state)
    if (url === undefined && !this.queue.has(state)) {
      this.queue.add(state)
      this.schedule()
    }
    return url
  }
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
  private schedule(): void {
    if (this.frame !== null || !this.res || !this.queue.size) return
    this.frame = requestAnimationFrame(() => {
      this.frame = null
      const start = performance.now()
      for (const state of this.queue) {
        if (performance.now() - start > BUDGET) break
        this.queue.delete(state)
        let url = ''
        try {
          url = draw(this.res!, this.materials, state)
        } catch (e) {
          console.warn(`block icon: ${state}`, e)
        }
        this.urls.set(state, url)
      }
      this.notify()
      this.schedule()
    })
  }
  // once per drawn batch: each update re-renders the pickers
  private notify(): void {
    this.lookup = (state) => this.get(state)
    this.listeners.forEach((cb) => cb())
    if (!this.queue.size) releaseSoon()
  }
}

const painters = new Map<string, Painter>()
const NONE = { subscribe: () => () => {}, lookup: (): undefined => undefined }

/** A lookup of block icons drawn with the texture pack at `pack` (an mcpack:// URL); undefined while one is
 *  being drawn or without a pack, '' for a block that draws nothing. */
export function useBlockIcons(
  pack: string | null | undefined
): (state: string) => string | undefined {
  let painter = pack ? painters.get(pack) : undefined
  if (pack && !painter) painters.set(pack, (painter = new Painter()))
  useEffect(() => {
    if (!pack || !painter) return
    const key = `pack:${pack}`
    let live = true
    painter.retain()
    acquireResources(key, async () => {
      const res = await fetch(pack)
      if (!res.ok) throw new Error(`texture pack: ${res.status}`)
      return loadResources(await res.arrayBuffer())
    }).then(
      (res) => live && painter.attach(res),
      () => {}
    )
    return () => {
      live = false
      releaseResources(key)
      painter.release()
    }
  }, [pack, painter])
  const p = painter ?? NONE
  return useSyncExternalStore(p.subscribe, () => p.lookup)
}
