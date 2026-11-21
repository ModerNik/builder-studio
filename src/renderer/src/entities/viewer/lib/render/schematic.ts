// Reads .litematic and Sponge .schem files into one block grid. lib/mcb/prefab.py in the engine is the reference.

export type Vec3 = [number, number, number]

/** A block grid: palette indices in x-fastest, then z, then y order; palette[0] is air. */
export interface Schematic {
  min: Vec3 // world position of cell (0, 0, 0)
  size: Vec3
  palette: string[]
  data: Uint16Array
}

const AIR = /^(?:minecraft:)?(?:air|cave_air|void_air)$/
export const isAir = (state: string): boolean => AIR.test(state)

/** The state at a schematic-coordinate cell, or null outside the grid. */
export function blockAt(s: Schematic, x: number, y: number, z: number): string | null {
  const [lx, ly, lz] = [x - s.min[0], y - s.min[1], z - s.min[2]]
  if (lx < 0 || ly < 0 || lz < 0 || lx >= s.size[0] || ly >= s.size[1] || lz >= s.size[2])
    return null
  return s.palette[s.data[(ly * s.size[2] + lz) * s.size[0] + lx]]
}

/** Set a cell (schematic coordinates) to `state`, adding the state to the palette; false outside the grid. */
export function setBlock(s: Schematic, x: number, y: number, z: number, state: string): boolean {
  const [lx, ly, lz] = [x - s.min[0], y - s.min[1], z - s.min[2]]
  if (lx < 0 || ly < 0 || lz < 0 || lx >= s.size[0] || ly >= s.size[1] || lz >= s.size[2])
    return false
  let p = isAir(state) ? 0 : s.palette.indexOf(state)
  if (p < 0) p = s.palette.push(state) - 1
  s.data[(ly * s.size[2] + lz) * s.size[0] + lx] = p
  return true
}

/** A copy of `s` grown to hold every cell in `cells` with `margin` cells of air around them; the palette is
 *  shared, so its indices stay the same. */
export function grow(s: Schematic, cells: Vec3[], margin = 16): Schematic {
  const hi0 = s.min.map((m, i) => m + s.size[i] - 1)
  const min = s.min.map((m, i) => Math.min(m, ...cells.map((c) => c[i] - margin))) as Vec3
  const max = hi0.map((h, i) => Math.max(h, ...cells.map((c) => c[i] + margin)))
  const size = max.map((h, i) => h - min[i] + 1) as Vec3
  const data = new Uint16Array(size[0] * size[1] * size[2])
  const [ox, oy, oz] = s.min.map((m, i) => m - min[i])
  for (let y = 0; y < s.size[1]; y++)
    for (let z = 0; z < s.size[2]; z++) {
      const from = (y * s.size[2] + z) * s.size[0]
      data.set(
        s.data.subarray(from, from + s.size[0]),
        ((y + oy) * size[2] + z + oz) * size[0] + ox
      )
    }
  return { min, size, palette: s.palette, data }
}

// ---- NBT: plain objects; long arrays as little-endian 32-bit word pairs (low word first)
type Tag =
  number | bigint | string | Tag[] | { [k: string]: Tag } | Int8Array | Int32Array | Uint32Array
type Compound = { [k: string]: Tag }

function readNbt(buf: Uint8Array): Compound {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const text = new TextDecoder()
  let p = 0
  const str = (): string => {
    const n = v.getUint16(p)
    p += 2
    return text.decode(buf.subarray(p, (p += n)))
  }
  const read = (t: number): Tag => {
    switch (t) {
      case 1:
        return v.getInt8(p++)
      case 2:
        return v.getInt16((p += 2) - 2)
      case 3:
        return v.getInt32((p += 4) - 4)
      case 4:
        return v.getBigInt64((p += 8) - 8)
      case 5:
        return v.getFloat32((p += 4) - 4)
      case 6:
        return v.getFloat64((p += 8) - 8)
      case 7: {
        const n = v.getInt32((p += 4) - 4)
        const a = new Int8Array(buf.buffer, buf.byteOffset + p, n)
        p += n
        return a
      }
      case 8:
        return str()
      case 9: {
        const et = v.getUint8(p++)
        const n = v.getInt32((p += 4) - 4)
        return Array.from({ length: Math.max(0, n) }, () => read(et))
      }
      case 10: {
        const o: Compound = {}
        for (let et; (et = v.getUint8(p++)) !== 0;) {
          const k = str()
          o[k] = read(et)
        }
        return o
      }
      case 11: {
        const n = v.getInt32((p += 4) - 4)
        const a = new Int32Array(n)
        for (let i = 0; i < n; i++, p += 4) a[i] = v.getInt32(p)
        return a
      }
      case 12: {
        const n = v.getInt32((p += 4) - 4)
        const a = new Uint32Array(2 * n)
        for (let i = 0; i < n; i++, p += 8) {
          a[2 * i + 1] = v.getUint32(p)
          a[2 * i] = v.getUint32(p + 4)
        }
        return a
      }
    }
    throw new Error(`bad NBT tag ${t} at ${p}`)
  }
  const t = v.getUint8(p++)
  if (t !== 10) throw new Error('not an NBT compound')
  str()
  return read(10) as Compound
}

async function gunzip(buf: Uint8Array): Promise<Uint8Array> {
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return buf
  const out = new Blob([buf as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(out).arrayBuffer())
}

/** A block state tag -> 'minecraft:x[a=b]', properties sorted. Up to 26.2 {Name, Properties}; since 26.3 a bare
 *  id string or {id, properties}, and a list mixing both wraps the strings as {"": id}. */
function stateOf(e: Tag): string {
  if (typeof e === 'string') return e
  const o = e as Compound
  if ('' in o) return String(o[''])
  const props = (o.properties ?? o.Properties) as Compound | undefined
  const name = String(o.id ?? o.Name)
  const keys = props ? Object.keys(props).sort() : []
  return keys.length ? `${name}[${keys.map((k) => `${k}=${props![k]}`).join(',')}]` : name
}

const num = (t: Tag): number => Number(t)

function litematic(t: Compound): Schematic {
  const regions = Object.values(t.Regions as Compound).map((r) => {
    const reg = r as Compound
    const xyz = (c: Tag): Vec3 => ['x', 'y', 'z'].map((k) => num((c as Compound)[k])) as Vec3
    const pos = xyz(reg.Position)
    const size = xyz(reg.Size)
    const n = size.map(Math.abs) as Vec3
    const pal = (reg.BlockStatePalette as Tag[]).map(stateOf)
    const bits = Math.max(2, (pal.length - 1).toString(2).length)
    const words = reg.BlockStates as Uint32Array
    const mask = bits >= 32 ? 0xffffffff : (1 << bits) - 1
    const count = n[0] * n[1] * n[2]
    const idx = new Uint32Array(count)
    // entries are packed LSB-first across 64-bit longs and may span two longs: read the longs as one bit stream
    for (let i = 0, at = 0; i < count; i++, at += bits) {
      const w = at >>> 5
      const off = at & 31
      let val = words[w] >>> off
      if (off + bits > 32) val |= (words[w + 1] ?? 0) << (32 - off)
      idx[i] = (val & mask) >>> 0
    }
    const min = pos.map((p, i) => (size[i] < 0 ? p + size[i] + 1 : p)) as Vec3
    return { min, n, pal, idx }
  })
  const lo = [0, 1, 2].map((i) => Math.min(...regions.map((r) => r.min[i]))) as Vec3
  const hi = [0, 1, 2].map((i) => Math.max(...regions.map((r) => r.min[i] + r.n[i])))
  const size = hi.map((h, i) => h - lo[i]) as Vec3
  const palette = ['minecraft:air']
  const ids = new Map([['minecraft:air', 0]])
  const data = new Uint16Array(size[0] * size[1] * size[2])
  for (const r of regions) {
    // region palette[0] is air: later regions only paint their solid cells
    const lut = r.pal.map((s) => {
      if (isAir(s)) return 0
      if (!ids.has(s)) ids.set(s, palette.push(s) - 1)
      return ids.get(s)!
    })
    const [ox, oy, oz] = r.min.map((m, i) => m - lo[i])
    for (let y = 0, i = 0; y < r.n[1]; y++)
      for (let z = 0; z < r.n[2]; z++)
        for (let x = 0; x < r.n[0]; x++, i++) {
          const v = lut[r.idx[i]]
          if (v) data[((y + oy) * size[2] + z + oz) * size[0] + x + ox] = v
        }
  }
  return { min: lo, size, palette, data }
}

function sponge(t: Compound): Schematic {
  const size: Vec3 = [num(t.Width), num(t.Height), num(t.Length)]
  const blocks = (t.Blocks ?? t) as Compound // v3 nests Palette/Data under Blocks
  const pal = blocks.Palette as Compound
  const raw = (blocks.Data ?? blocks.BlockData) as Int8Array
  const states: string[] = []
  for (const [s, i] of Object.entries(pal)) states[num(i)] = s
  // keep palette[0] air: remap the file's ids
  const palette = ['minecraft:air']
  const lut = states.map((s) => (isAir(s) ? 0 : palette.push(s) - 1))
  const data = new Uint16Array(size[0] * size[1] * size[2])
  // varints in file order x + z*W + y*W*L, the same order as ours
  for (let p = 0, i = 0; p < raw.length && i < data.length; i++) {
    let val = 0
    for (let shift = 0; ; shift += 7) {
      const b = raw[p++] & 0xff
      val |= (b & 0x7f) << shift
      if (!(b & 0x80)) break
    }
    data[i] = lut[val]
  }
  return { min: [0, 0, 0], size, palette, data }
}

/** Parse a .litematic or Sponge .schem (gzipped or not). */
export async function readSchematic(buf: ArrayBuffer | Uint8Array): Promise<Schematic> {
  const root = readNbt(await gunzip(buf instanceof Uint8Array ? buf : new Uint8Array(buf)))
  const t = (root.Schematic as Compound | undefined) ?? root
  if ('Regions' in t) return litematic(t)
  if ('Width' in t) return sponge(t)
  throw new Error(`unrecognised schematic (keys ${Object.keys(t).slice(0, 8).join(', ')})`)
}
