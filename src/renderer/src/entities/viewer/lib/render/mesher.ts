// Schematic -> chunked BufferGeometry, one geometry per 16^3 chunk and material bucket. Faces against opaque
// neighbours are dropped; each block state's mesh is built once per neighbour pattern and copied into place.
import * as THREE from 'three'
import { mat4 } from 'gl-matrix'
import {
  BlockColors,
  type Color,
  BlockState,
  Cull,
  Identifier,
  Mesh,
  SpecialRenderers,
  type BlockModel
} from 'deepslate'
import { CUTOUT, LIQUID, OPAQUE, TRANSLUCENT, type Resources } from './resources'
import { isAir, type Schematic, type Vec3 } from './schematic'

export const BUCKETS = [OPAQUE, CUTOUT, TRANSLUCENT, LIQUID]
const CHUNK = 16
const STRIDE = 11 // per vertex: x y z, nx ny nz, u v, r g b
// neighbour bits, in this order: up, down, north (-z), south (+z), west (-x), east (+x)
const DIRS = [
  ['up', 0, 1, 0],
  ['down', 0, -1, 0],
  ['north', 0, 0, -1],
  ['south', 0, 0, 1],
  ['west', -1, 0, 0],
  ['east', 1, 0, 0]
] as const

interface Info {
  state: BlockState
  air: boolean
  opaque: boolean // a full cube of opaque texels: hides its neighbours' faces
  selfCull: boolean // hides faces against the same block (glass, water)
  wet: boolean
}
type Template = Float32Array[] // per bucket, quads of 4 vertices

/** Block colours by id (0..1 rgb), for the colour-only fallback. */
export type BlockColorMap = Record<string, number[]>

class Buf {
  f = new Float32Array(1024)
  n = 0
  push(src: Float32Array, dx: number, dy: number, dz: number): void {
    if (this.n + src.length > this.f.length) {
      const g = new Float32Array(Math.max(this.f.length * 2, this.n + src.length))
      g.set(this.f.subarray(0, this.n))
      this.f = g
    }
    this.f.set(src, this.n)
    for (let i = this.n; i < this.n + src.length; i += STRIDE) {
      this.f[i] += dx
      this.f[i + 1] += dy
      this.f[i + 2] += dz
    }
    this.n += src.length
  }
}

function geometry(buf: Buf): THREE.BufferGeometry {
  const data = buf.f.slice(0, buf.n)
  const ib = new THREE.InterleavedBuffer(data, STRIDE)
  const quads = buf.n / STRIDE / 4
  const index = new Uint32Array(quads * 6)
  for (let q = 0; q < quads; q++)
    index.set(
      [0, 1, 2, 0, 2, 3].map((k) => 4 * q + k),
      6 * q
    )
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0))
  g.setAttribute('normal', new THREE.InterleavedBufferAttribute(ib, 3, 3))
  g.setAttribute('uv', new THREE.InterleavedBufferAttribute(ib, 2, 6))
  g.setAttribute('color', new THREE.InterleavedBufferAttribute(ib, 3, 8))
  g.setIndex(new THREE.BufferAttribute(index, 1))
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

/** Flatten deepslate quads into per-bucket vertex arrays (block units, 0..1). */
function flatten(mesh: Mesh, res: Resources | null): Template {
  const out: number[][] = BUCKETS.map(() => [])
  for (const q of mesh.quads) {
    const n = q.normal()
    const lim = q.v1.textureLimit
    const kind =
      res && lim ? res.spriteAt((lim[0] + lim[2]) / 2, (lim[1] + lim[3]) / 2).kind : OPAQUE
    for (const v of q.vertices()) {
      const t = v.texture ?? [0, 0]
      out[kind].push(v.pos.x, v.pos.y, v.pos.z, n.x, n.y, n.z, t[0], t[1], ...v.color)
    }
  }
  return out.map((a) => new Float32Array(a))
}

// The game's default uvs for a face, from where its vertex sits (block pixels): uvlock keeps these after a turn.
function uvlock(mesh: Mesh, res: Resources): void {
  for (const q of mesh.quads) {
    const n = q.normal()
    const lim = q.v1.textureLimit
    if (!lim) continue
    const [u0, v0, u1, v1] = res.spriteAt((lim[0] + lim[2]) / 2, (lim[1] + lim[3]) / 2).uv
    const [ax, ay, az] = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)]
    for (const v of q.vertices()) {
      const { x, y, z } = v.pos
      const [s, t] =
        ay >= ax && ay >= az
          ? n.y > 0
            ? [x, z]
            : [x, 16 - z]
          : az >= ax
            ? n.z < 0
              ? [16 - x, 16 - y]
              : [x, 16 - y]
            : n.x < 0
              ? [z, 16 - y]
              : [16 - z, 16 - y]
      v.texture = [u0 + ((u1 - u0) * s) / 16, v0 + ((v1 - v0) * t) / 16]
    }
  }
}

/** Every face of a quad lies on the unit cube's surface and the six cover it: a full cube. */
function fullCube(t: Template): boolean {
  const all = t.flatMap((a) => [...a])
  if (all.length !== 6 * 4 * STRIDE) return false
  const faces = new Set<string>()
  for (let q = 0; q < 6; q++) {
    const vs = [0, 1, 2, 3].map((k) => all.slice((q * 4 + k) * STRIDE, (q * 4 + k) * STRIDE + 3))
    const axis = [0, 1, 2].find((a) =>
      vs.every((v) => v[a] === vs[0][a] && (v[a] === 0 || v[a] === 1))
    )
    if (axis === undefined) return false
    const others = [0, 1, 2].filter((a) => a !== axis)
    if (!others.every((a) => vs.some((v) => v[a] === 0) && vs.some((v) => v[a] === 1))) return false
    faces.add(`${axis}${vs[0][axis]}`)
  }
  return faces.size === 6
}

// deepslate's tint table, with grass and foliage in the plains biome's colours (the engine sheets' sky too)
const DS_GRASS = BlockColors.grass_block?.({})
const DS_FOLIAGE = BlockColors.oak_leaves?.({})
const rgb = (c: number): Color => [(c >> 16) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]
const [GRASS, FOLIAGE] = [rgb(0x91bd59), rgb(0x77ab2f)]
function tintOf(path: string, props: Record<string, string>): Color | undefined {
  const t = BlockColors[path]?.(props)
  return t === DS_GRASS ? GRASS : t === DS_FOLIAGE ? FOLIAGE : t
}

const WATER = new BlockState('minecraft:water', { level: '0' })
const HERE = [['here', 0, 0, 0] as const, ...DIRS]

/** The chunks a change to `cells` (local coordinates) re-meshes: theirs and the ones beside them, whose faces
 *  against the cells may change. Chunk ids count x fastest, then z, then y. */
export function chunksAround(size: Vec3, cells: Vec3[]): Set<number> {
  const [nx, , nz] = size.map((n) => Math.ceil(n / CHUNK))
  const out = new Set<number>()
  for (const [x, y, z] of cells)
    for (const [, dx, dy, dz] of HERE) {
      const [a, b, c] = [x + dx, y + dy, z + dz]
      if (a < 0 || b < 0 || c < 0 || a >= size[0] || b >= size[1] || c >= size[2]) continue
      out.add((Math.floor(b / CHUNK) * nz + Math.floor(c / CHUNK)) * nx + Math.floor(a / CHUNK))
    }
  return out
}

export class Mesher {
  private infos: Info[] = [] // per palette entry, made as the palette grows
  private templates = new Map<number, Template>()
  private chunks = new Map<number, THREE.Mesh[]>()

  constructor(
    private s: Schematic,
    private res: Resources | null,
    private colors: BlockColorMap | null,
    private cullData: Uint16Array | null = null
  ) {}

  private info(p: number): Info {
    while (this.infos.length <= p) {
      const name = this.s.palette[this.infos.length]
      const state = BlockState.parse(name)
      const info: Info = {
        state,
        air: isAir(name),
        opaque: false,
        selfCull: false,
        wet: state.isWaterlogged()
      }
      if (!info.air && !this.res) info.opaque = true
      else if (!info.air) {
        const t = this.template(info, 0)
        const cube = fullCube(t)
        info.opaque = cube && t[OPAQUE].length === 6 * 4 * STRIDE
        info.selfCull = state.isFluid() || (cube && !state.getName().path.endsWith('leaves'))
      }
      this.infos.push(info)
    }
    return this.infos[p]
  }

  private template(info: Info, mask: number): Template {
    const cull: Cull = {}
    DIRS.forEach(([d], i) => (cull[d] = !!(mask & (1 << i))))
    if (!this.res) return this.cube(info, cull)
    const res = this.res
    const name = info.state.getName()
    const props = info.state.getProperties()
    const mesh = new Mesh()
    let empty = true
    try {
      const def = res.getBlockDefinition(name)
      const tint = tintOf(name.path, props)
      for (const v of def?.getModelVariants(props) ?? []) {
        const model: BlockModel | null = res.getBlockModel(Identifier.parse(v.model))
        if (!model) continue
        const m = model.getMesh(res, Cull.rotate(cull, v.x ?? 0, v.y ?? 0), tint)
        if (v.x || v.y) {
          const t = mat4.create()
          mat4.translate(t, t, [8, 8, 8])
          mat4.rotateY(t, t, (-(v.y ?? 0) * Math.PI) / 180)
          mat4.rotateX(t, t, (-(v.x ?? 0) * Math.PI) / 180)
          mat4.translate(t, t, [-8, -8, -8])
          m.transform(t)
          if (v.uvlock) uvlock(m, res)
        }
        if (!m.isEmpty()) empty = false
        mesh.merge(m)
      }
    } catch (e) {
      console.warn(`render: ${info.state}`, e)
    }
    mesh.transform(mat4.fromScaling(mat4.create(), [1 / 16, 1 / 16, 1 / 16]))
    // blocks the pack draws no model for (chests, skulls, banners, shulkers, liquids): deepslate's box models,
    // textured from the pack's entity textures; a model-drawn waterlogged block only adds its water
    const special = empty || info.state.is('bell')
    const extra = special ? info.state : info.wet && !info.state.isFluid() ? WATER : null
    if (extra) {
      try {
        mesh.merge(SpecialRenderers.getBlockMesh(extra, undefined, res, cull))
      } catch (e) {
        console.warn(`render: ${info.state}`, e)
      }
    }
    return flatten(mesh, res)
  }

  /** The fallback: a cube in the block's measured colour. */
  private cube(info: Info, cull: Cull): Template {
    const c = this.colors?.[info.state.getName().toString()] ?? [0.6, 0.6, 0.6]
    const faces: Record<string, number[]> = {
      up: [0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0],
      down: [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
      north: [1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0],
      south: [0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
      west: [0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0],
      east: [1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1]
    }
    const out: number[] = []
    for (const [d, dx, dy, dz] of DIRS) {
      if (cull[d]) continue
      const p = faces[d]
      for (let k = 0; k < 4; k++)
        out.push(p[3 * k], p[3 * k + 1], p[3 * k + 2], dx, dy, dz, 0, 0, ...c)
    }
    return [new Float32Array(out), new Float32Array(), new Float32Array(), new Float32Array()]
  }

  private needsCull(a: Info, q: number, dir: number): boolean {
    if (q <= 0) return false
    const b = this.info(q)
    if (b.air) return false
    if (b.selfCull && a.state.getName().equals(b.state.getName())) return true
    if (b.opaque) return !(dir === 0 && a.wet)
    return a.wet && b.wet
  }

  /** The up faces of layer `ly` (local) that a block above hid: drawn while a clip plane cuts the layers above. */
  cap(ly: number, materials: THREE.Material[]): THREE.Mesh[] {
    const { size, min, data } = this.s
    const [sx, sy, sz] = size
    if (ly < 0 || ly >= sy - 1) return []
    const bufs = [new Buf(), new Buf()] // opaque, cutout: translucent faces are never culled by a different block
    for (let z = 0; z < sz; z++)
      for (let x = 0; x < sx; x++) {
        const p = data[(ly * sz + z) * sx + x]
        const info = this.info(p)
        if (!p || info.air || !this.needsCull(info, data[((ly + 1) * sz + z) * sx + x], 0)) continue
        const key = p * 64 + 62 // every side culled but up
        let t = this.templates.get(key)
        if (!t) this.templates.set(key, (t = this.template(info, 62)))
        const [ox, oy, oz] = [x + min[0] - 0.5, ly + min[1] - 0.5, z + min[2] - 0.5]
        for (const k of [OPAQUE, CUTOUT]) if (t[k].length) bufs[k].push(t[k], ox, oy, oz)
      }
    return bufs.flatMap((b, k) => (b.n ? [new THREE.Mesh(geometry(b), materials[k])] : []))
  }

  /** One chunk's meshes, by chunk id (see chunksAround). */
  private chunk(id: number, materials: THREE.Material[]): THREE.Mesh[] {
    const { size, min, data } = this.s
    const [sx, sy, sz] = size
    const [nx, , nz] = size.map((n) => Math.ceil(n / CHUNK))
    const [cx, cz, cy] = [id % nx, Math.floor(id / nx) % nz, Math.floor(id / nx / nz)].map(
      (c) => c * CHUNK
    )
    const neighbors = this.cullData ?? data
    const at = (x: number, y: number, z: number): number =>
      x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz
        ? -1
        : neighbors[(y * sz + z) * sx + x]
    const bufs = BUCKETS.map(() => new Buf())
    for (let y = cy; y < Math.min(cy + CHUNK, sy); y++)
      for (let z = cz; z < Math.min(cz + CHUNK, sz); z++)
        for (let x = cx; x < Math.min(cx + CHUNK, sx); x++) {
          const p = data[(y * sz + z) * sx + x]
          const info = this.info(p)
          if (!p || info.air) continue
          let mask = 0
          DIRS.forEach(([, dx, dy, dz], d) => {
            if (this.needsCull(info, at(x + dx, y + dy, z + dz), d)) mask |= 1 << d
          })
          const key = p * 64 + mask
          let t = this.templates.get(key)
          if (!t) this.templates.set(key, (t = this.template(info, mask)))
          // cells are centred on integer coordinates: cell y spans [y - 0.5, y + 0.5]
          const [ox, oy, oz] = [x + min[0] - 0.5, y + min[1] - 0.5, z + min[2] - 0.5]
          t.forEach((a, b) => a.length && bufs[b].push(a, ox, oy, oz))
        }
    return bufs.flatMap((b, k) => {
      if (!b.n) return []
      const m = new THREE.Mesh(geometry(b), materials[k])
      m.castShadow = m.receiveShadow = true
      m.renderOrder = k // translucent after cutout after opaque
      return [m]
    })
  }

  /** Swap a chunk's meshes in `group` for `meshes`. */
  private place(group: THREE.Group | null, id: number, meshes: THREE.Mesh[]): void {
    for (const m of this.chunks.get(id) ?? []) {
      m.removeFromParent()
      m.geometry.dispose()
    }
    this.chunks.set(id, meshes)
    if (meshes.length) group?.add(...meshes)
  }

  /** Mesh every chunk into `group` (cell centres on integer schematic coordinates). Yields to the event loop
   *  now and then; stops early (returning false) once `stale` says so. */
  async build(
    group: THREE.Group,
    materials: THREE.Material[],
    onProgress?: (frac: number) => void,
    stale?: () => boolean
  ): Promise<boolean> {
    const [nx, ny, nz] = this.s.size.map((n) => Math.ceil(n / CHUNK))
    const count = nx * ny * nz
    let last = performance.now()
    for (let id = 0; id < count; id++) {
      this.place(group, id, this.chunk(id, materials))
      if (performance.now() - last > 25) {
        onProgress?.((id + 1) / count)
        await new Promise((r) => setTimeout(r))
        last = performance.now()
        if (stale?.()) return false
      }
    }
    return true
  }

  /** Re-mesh after `cells` (local coordinates) changed in the grid. */
  rebuild(group: THREE.Group, materials: THREE.Material[], cells: Vec3[]): void {
    for (const id of chunksAround(this.s.size, cells))
      this.place(group, id, this.chunk(id, materials))
  }

  /** Swap in a resized grid with the same palette (schematic `grow`); build() meshes it again. */
  reset(s: Schematic): void {
    for (const id of this.chunks.keys()) this.place(null, id, [])
    this.chunks.clear()
    this.s = s
  }
}
