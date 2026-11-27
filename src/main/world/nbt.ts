// Fast binary NBT & Anvil (.mca) chunk parser for Node.js (Electron main process).
// Supports Java 1.12 legacy, 1.13-1.17 flattened, 1.18-26.2 modern, and 26.3+ bare-string palettes.
import { gunzipSync, inflateSync } from 'zlib'

export type NbtTag =
  number | bigint | string | NbtTag[] | NbtCompound | Int8Array | Int32Array | Uint32Array

export interface NbtCompound {
  [key: string]: NbtTag
}

const textDecoder = new TextDecoder()

// Heavy chunk/section NBT keys never needed for terrain or block rendering.
const SKIP_CHUNK_KEYS = new Set([
  'BlockLight',
  'SkyLight',
  'entities',
  'Entities',
  'block_entities',
  'TileEntities',
  'block_ticks',
  'TileTicks',
  'fluid_ticks',
  'LiquidTicks',
  'PostProcessing',
  'structures',
  'Structures',
  'Lights',
  'CarvingMasks',
  'BlendingData',
  'below_zero_retrogen',
  'ToBeTicked',
  'LiquidsToBeTicked',
  'UpgradeData'
])

/** Parse an uncompressed NBT buffer into plain JS objects. LongArrays become [lo, hi, ...] Uint32Array pairs. */
export function parseNbt(buf: Uint8Array, skipKeys?: Set<string>): NbtCompound {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let p = 0

  const readStr = (): string => {
    const len = view.getUint16(p)
    p += 2
    const s = textDecoder.decode(buf.subarray(p, p + len))
    p += len
    return s
  }

  const skipTag = (type: number): void => {
    switch (type) {
      case 0:
        return
      case 1:
        p += 1
        return
      case 2:
        p += 2
        return
      case 3:
      case 5:
        p += 4
        return
      case 4:
      case 6:
        p += 8
        return
      case 7: {
        const n = view.getInt32(p)
        p += 4 + Math.max(0, n)
        return
      }
      case 8: {
        const len = view.getUint16(p)
        p += 2 + len
        return
      }
      case 9: {
        const elemType = view.getUint8(p++)
        const n = view.getInt32(p)
        p += 4
        const count = Math.max(0, n)
        if (elemType === 0 || count === 0) return
        if (elemType === 1) {
          p += count
          return
        }
        if (elemType === 2) {
          p += count * 2
          return
        }
        if (elemType === 3 || elemType === 5) {
          p += count * 4
          return
        }
        if (elemType === 4 || elemType === 6) {
          p += count * 8
          return
        }
        for (let i = 0; i < count; i++) skipTag(elemType)
        return
      }
      case 10: {
        while (p < buf.byteLength) {
          const et = view.getUint8(p++)
          if (et === 0) break
          const klen = view.getUint16(p)
          p += 2 + klen
          skipTag(et)
        }
        return
      }
      case 11: {
        const n = view.getInt32(p)
        p += 4 + Math.max(0, n) * 4
        return
      }
      case 12: {
        const n = view.getInt32(p)
        p += 4 + Math.max(0, n) * 8
        return
      }
      default:
        throw new Error(`Unsupported NBT tag ${type} at offset ${p}`)
    }
  }

  const readTag = (type: number): NbtTag => {
    switch (type) {
      case 1:
        return view.getInt8(p++)
      case 2: {
        const v = view.getInt16(p)
        p += 2
        return v
      }
      case 3: {
        const v = view.getInt32(p)
        p += 4
        return v
      }
      case 4: {
        const v = view.getBigInt64(p)
        p += 8
        return v
      }
      case 5: {
        const v = view.getFloat32(p)
        p += 4
        return v
      }
      case 6: {
        const v = view.getFloat64(p)
        p += 8
        return v
      }
      case 7: {
        const n = view.getInt32(p)
        p += 4
        const a = new Int8Array(n)
        a.set(new Int8Array(buf.buffer, buf.byteOffset + p, n))
        p += n
        return a
      }
      case 8:
        return readStr()
      case 9: {
        const elemType = view.getUint8(p++)
        const n = view.getInt32(p)
        p += 4
        const count = Math.max(0, n)
        const arr = new Array<NbtTag>(count)
        for (let i = 0; i < count; i++) arr[i] = readTag(elemType)
        return arr
      }
      case 10: {
        const obj: NbtCompound = {}
        while (p < buf.byteLength) {
          const et = view.getUint8(p++)
          if (et === 0) break
          const key = readStr()
          if (skipKeys && skipKeys.has(key)) {
            skipTag(et)
            continue
          }
          obj[key] = readTag(et)
        }
        return obj
      }
      case 11: {
        const n = view.getInt32(p)
        p += 4
        const a = new Int32Array(n)
        for (let i = 0; i < n; i++, p += 4) a[i] = view.getInt32(p)
        return a
      }
      case 12: {
        const n = view.getInt32(p)
        p += 4
        const a = new Uint32Array(n * 2)
        for (let i = 0; i < n; i++, p += 8) {
          // Store little-endian word order [lo, hi] for fast 32-bit bit shifting
          a[i * 2 + 1] = view.getUint32(p)
          a[i * 2] = view.getUint32(p + 4)
        }
        return a
      }
      default:
        throw new Error(`Unsupported NBT tag ${type} at offset ${p}`)
    }
  }

  const rootType = view.getUint8(p++)
  if (rootType !== 10) throw new Error(`Expected root NBT compound (10), got ${rootType}`)
  readStr()
  return readTag(10) as NbtCompound
}

/** Fast selective NBT chunk parser that skips lighting, entities, ticks, and structures without allocations. */
export function parseChunkNbt(buf: Uint8Array): NbtCompound {
  return parseNbt(buf, SKIP_CHUNK_KEYS)
}

/** Decompress (gzip if needed) and parse a level.dat file. */
export function parseGzippedNbt(buf: Uint8Array): NbtCompound {
  const raw = buf.byteLength >= 2 && buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf
  return parseNbt(raw)
}

/** Read and parse one chunk (cx, cz) from an Anvil .mca region buffer, or null if absent. */
export function readRegionChunk(
  region: Uint8Array,
  cx: number,
  cz: number,
  fast = false
): NbtCompound | null {
  if (region.byteLength < 8192) return null
  const idx = 4 * ((cx & 31) + (cz & 31) * 32)
  const sectorOffset = (region[idx] << 16) | (region[idx + 1] << 8) | region[idx + 2]
  if (sectorOffset === 0) return null
  const off = sectorOffset * 4096
  if (off + 5 > region.byteLength) return null
  const length =
    ((region[off] << 24) | (region[off + 1] << 16) | (region[off + 2] << 8) | region[off + 3]) >>> 0
  const end = off + 4 + length
  if (length < 1 || end > region.byteLength) return null
  const compression = region[off + 4]
  const payload = region.subarray(off + 5, end)
  let raw: Uint8Array
  if (compression === 1) raw = gunzipSync(payload)
  else if (compression === 2) raw = inflateSync(payload)
  else if (compression === 3) raw = payload
  else return null
  return fast ? parseChunkNbt(raw) : parseNbt(raw)
}

/** Determine whether a packed long array uses the 1.16+ padded layout. */
export function isPackedPadded(words: Uint32Array, count: number, bits: number): boolean {
  const longCount = words.length >>> 1
  const unpaddedLongs = Math.ceil((count * bits) / 64)
  return longCount !== unpaddedLongs
}

/** O(1) lookup of a single value from a bit-packed 64-bit long array without unpacking all entries. */
export function readPackedIndex(
  words: Uint32Array,
  index: number,
  bits: number,
  padded: boolean
): number {
  const mask = (1 << bits) - 1
  if (!padded) {
    const bit = index * bits
    const w = bit >>> 5
    const shift = bit & 31
    let val = (words[w] ?? 0) >>> shift
    if (shift + bits > 32) val |= (words[w + 1] ?? 0) << (32 - shift)
    return val & mask
  }
  const perLong = Math.floor(64 / bits)
  const l = Math.floor(index / perLong)
  const k = index - l * perLong
  const shift = k * bits
  const lo = words[l * 2] ?? 0
  const hi = words[l * 2 + 1] ?? 0
  let val: number
  if (shift >= 32) val = hi >>> (shift - 32)
  else if (shift + bits <= 32) val = lo >>> shift
  else val = (lo >>> shift) | (hi << (32 - shift))
  return val & mask
}

/** Unpack bit-packed 64-bit long arrays (both 1.13-1.15 unpadded and 1.16+ padded layouts). */
export function unpackLongs(
  words: Uint32Array,
  count: number,
  bits: number,
  out?: Uint16Array
): Uint16Array {
  const dst = out ?? new Uint16Array(count)
  const mask = (1 << bits) - 1
  const longCount = words.length >>> 1
  const unpaddedLongs = Math.ceil((count * bits) / 64)
  const padded = longCount !== unpaddedLongs

  if (!padded) {
    for (let i = 0, bit = 0; i < count; i++, bit += bits) {
      const w = bit >>> 5
      const shift = bit & 31
      let val = words[w] >>> shift
      if (shift + bits > 32) val |= (words[w + 1] ?? 0) << (32 - shift)
      dst[i] = val & mask
    }
    return dst
  }

  const perLong = Math.floor(64 / bits)
  let outIdx = 0
  for (let l = 0; l < longCount && outIdx < count; l++) {
    const lo = words[l * 2]
    const hi = words[l * 2 + 1]
    for (let k = 0; k < perLong && outIdx < count; k++, outIdx++) {
      const shift = k * bits
      let val: number
      if (shift >= 32) {
        val = hi >>> (shift - 32)
      } else if (shift + bits <= 32) {
        val = lo >>> shift
      } else {
        val = (lo >>> shift) | (hi << (32 - shift))
      }
      dst[outIdx] = val & mask
    }
  }
  return dst
}

/** Extract bare block ID ('minecraft:name') from a palette entry without formatting properties. */
export function formatBlockName(entry: NbtTag): string {
  if (typeof entry === 'string') {
    const i = entry.indexOf('[')
    return i >= 0 ? entry.slice(0, i) : entry
  }
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return 'minecraft:air'
  const c = entry as NbtCompound
  if ('' in c) {
    const s = String(c[''])
    const i = s.indexOf('[')
    return i >= 0 ? s.slice(0, i) : s
  }
  return String(c.id ?? c.Name ?? 'minecraft:air')
}

/** Format a block state NBT entry into 'minecraft:name[k=v,...]' (supports 1.13-26.2 and 26.3+). */
export function formatBlockState(entry: NbtTag): string {
  if (typeof entry === 'string') return entry
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return 'minecraft:air'
  const c = entry as NbtCompound
  if ('' in c) return String(c[''])
  const name = String(c.id ?? c.Name ?? 'minecraft:air')
  const props = (c.properties ?? c.Properties) as NbtCompound | undefined
  if (!props) return name
  const keys = Object.keys(props).sort()
  if (!keys.length) return name
  return `${name}[${keys.map((k) => `${k}=${String(props[k])}`).join(',')}]`
}

export function chunkRoot(chunk: NbtCompound): NbtCompound {
  const level = chunk.Level
  return level && typeof level === 'object' && !Array.isArray(level)
    ? (level as NbtCompound)
    : chunk
}

export function chunkMinY(chunk: NbtCompound): number {
  const root = chunkRoot(chunk)
  const dv = Number(chunk.DataVersion ?? root.DataVersion ?? 0)
  if (!dv && 'sections' in chunk && 'Heightmaps' in chunk) return -64
  if ('yPos' in chunk) return Number(chunk.yPos) * 16
  return dv >= 2860 ? -64 : 0
}

/** Read a chunk heightmap as Int16Array(256) indexed [z * 16 + x] holding top-block Y. */
export function readHeightmap(
  chunk: NbtCompound,
  name: 'WORLD_SURFACE' | 'OCEAN_FLOOR' | 'MOTION_BLOCKING_NO_LEAVES' = 'WORLD_SURFACE'
): Int16Array | null {
  const root = chunkRoot(chunk)
  const minY = chunkMinY(chunk)
  const maps = root.Heightmaps as NbtCompound | undefined
  if (maps && maps[name] instanceof Uint32Array) {
    const raw = unpackLongs(maps[name] as Uint32Array, 256, 9)
    const out = new Int16Array(256)
    for (let i = 0; i < 256; i++) out[i] = raw[i] + minY - 1
    return out
  }
  if (root.HeightMap instanceof Int32Array && root.HeightMap.length >= 256) {
    const hm = root.HeightMap
    const out = new Int16Array(256)
    for (let i = 0; i < 256; i++) out[i] = hm[i] - 1
    return out
  }
  return null
}

// Common Minecraft 1.12 numeric block IDs -> modern block names for legacy saves
const LEGACY_BLOCKS: Record<number, string> = {
  0: 'minecraft:air',
  1: 'minecraft:stone',
  2: 'minecraft:grass_block',
  3: 'minecraft:dirt',
  4: 'minecraft:cobblestone',
  5: 'minecraft:oak_planks',
  7: 'minecraft:bedrock',
  8: 'minecraft:water',
  9: 'minecraft:water',
  10: 'minecraft:lava',
  11: 'minecraft:lava',
  12: 'minecraft:sand',
  13: 'minecraft:gravel',
  14: 'minecraft:gold_ore',
  15: 'minecraft:iron_ore',
  16: 'minecraft:coal_ore',
  17: 'minecraft:oak_log',
  18: 'minecraft:oak_leaves',
  20: 'minecraft:glass',
  24: 'minecraft:sandstone',
  31: 'minecraft:short_grass',
  35: 'minecraft:white_wool',
  43: 'minecraft:smooth_stone',
  44: 'minecraft:stone_slab',
  45: 'minecraft:bricks',
  48: 'minecraft:mossy_cobblestone',
  49: 'minecraft:obsidian',
  58: 'minecraft:crafting_table',
  60: 'minecraft:farmland',
  78: 'minecraft:snow',
  79: 'minecraft:ice',
  80: 'minecraft:snow_block',
  81: 'minecraft:cactus',
  82: 'minecraft:clay',
  87: 'minecraft:netherrack',
  88: 'minecraft:soul_sand',
  89: 'minecraft:glowstone',
  98: 'minecraft:stone_bricks',
  110: 'minecraft:mycelium',
  111: 'minecraft:lily_pad',
  112: 'minecraft:nether_bricks',
  121: 'minecraft:end_stone',
  159: 'minecraft:terracotta',
  161: 'minecraft:acacia_leaves',
  162: 'minecraft:acacia_log',
  172: 'minecraft:terracotta',
  174: 'minecraft:packed_ice',
  179: 'minecraft:red_sandstone',
  208: 'minecraft:dirt_path'
}

export interface DecodedSection {
  sectionY: number
  palette: string[]
  /** 4096 palette indices in ((y * 16 + z) * 16 + x) order, or null when uniform (all index 0). */
  indices: Uint16Array | null
}

/** Lightweight lazy section descriptor that allows O(1) single-block reads without unpacking 4096 blocks. */
export interface LazySection {
  sectionY: number
  rawPalette: NbtTag[] | null
  cachedNames: (string | undefined)[] | null
  rawData: Uint32Array | null
  bits: number
  padded: boolean
  legacyBlocks: Int8Array | null
  legacyAdd: Int8Array | null
}

/** Extract lightweight lazy section descriptors without unpacking bit-packed block arrays. */
export function extractLazySections(chunk: NbtCompound): LazySection[] {
  const root = chunkRoot(chunk)
  const rawSections = (root.sections ?? root.Sections) as NbtTag[] | undefined
  if (!Array.isArray(rawSections)) return []

  const out: LazySection[] = []
  for (const item of rawSections) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const sec = item as NbtCompound
    if (typeof sec.Y !== 'number') continue
    const sectionY = sec.Y

    if (sec.Blocks instanceof Int8Array) {
      out.push({
        sectionY,
        rawPalette: null,
        cachedNames: null,
        rawData: null,
        bits: 0,
        padded: false,
        legacyBlocks: sec.Blocks,
        legacyAdd: sec.Add instanceof Int8Array ? sec.Add : null
      })
      continue
    }

    const bs = (sec.block_states as NbtCompound | undefined) ?? sec
    const rawPal = (bs.palette ?? bs.Palette) as NbtTag[] | undefined
    if (!Array.isArray(rawPal) || rawPal.length === 0) continue
    const rawData = (bs.data ?? bs.BlockStates) as Uint32Array | undefined
    if (!(rawData instanceof Uint32Array) || rawPal.length === 1) {
      out.push({
        sectionY,
        rawPalette: rawPal,
        cachedNames: new Array(rawPal.length),
        rawData: null,
        bits: 0,
        padded: false,
        legacyBlocks: null,
        legacyAdd: null
      })
      continue
    }
    const bits = Math.max(4, Math.ceil(Math.log2(rawPal.length)))
    out.push({
      sectionY,
      rawPalette: rawPal,
      cachedNames: new Array(rawPal.length),
      rawData,
      bits,
      padded: isPackedPadded(rawData, 4096, bits),
      legacyBlocks: null,
      legacyAdd: null
    })
  }
  return out
}

/** O(1) bare block-name lookup at local section coordinates (lx, ly, lz) without unpacking the section. */
export function lazyBlockNameAt(sec: LazySection, lx: number, ly: number, lz: number): string {
  const cell = (ly << 8) | (lz << 4) | lx
  if (sec.legacyBlocks) {
    let id = sec.legacyBlocks[cell] & 0xff
    if (sec.legacyAdd) {
      const byte = sec.legacyAdd[cell >>> 1] & 0xff
      id |= (cell & 1 ? byte >>> 4 : byte & 0x0f) << 8
    }
    return LEGACY_BLOCKS[id] ?? (id === 0 ? 'minecraft:air' : 'minecraft:stone')
  }
  if (!sec.rawPalette || !sec.cachedNames) return 'minecraft:air'
  const idx = sec.rawData ? readPackedIndex(sec.rawData, cell, sec.bits, sec.padded) : 0
  let name = sec.cachedNames[idx]
  if (name === undefined) {
    name = idx < sec.rawPalette.length ? formatBlockName(sec.rawPalette[idx]) : 'minecraft:air'
    sec.cachedNames[idx] = name
  }
  return name
}

/** Fully unpack a single lazy section into palette + 4096 indices (used only for visible hires bands). */
export function unpackLazySection(sec: LazySection): DecodedSection {
  if (sec.legacyBlocks) {
    const rawBlocks = sec.legacyBlocks
    const add = sec.legacyAdd
    const palMap = new Map<string, number>([['minecraft:air', 0]])
    const palette = ['minecraft:air']
    const indices = new Uint16Array(4096)
    for (let i = 0; i < 4096; i++) {
      let id = rawBlocks[i] & 0xff
      if (add) {
        const byte = add[i >>> 1] & 0xff
        id |= (i & 1 ? byte >>> 4 : byte & 0x0f) << 8
      }
      const name = LEGACY_BLOCKS[id] ?? (id === 0 ? 'minecraft:air' : 'minecraft:stone')
      let pid = palMap.get(name)
      if (pid === undefined) {
        pid = palette.length
        palette.push(name)
        palMap.set(name, pid)
      }
      indices[i] = pid
    }
    return { sectionY: sec.sectionY, palette, indices }
  }
  const palette = (sec.rawPalette ?? []).map(formatBlockState)
  if (!sec.rawData || palette.length <= 1) {
    return { sectionY: sec.sectionY, palette, indices: null }
  }
  return {
    sectionY: sec.sectionY,
    palette,
    indices: unpackLongs(sec.rawData, 4096, sec.bits)
  }
}

/** Decode all block sections of a chunk across legacy, flattened, and modern formats. */
export function decodeChunkSections(chunk: NbtCompound): DecodedSection[] {
  return extractLazySections(chunk).map(unpackLazySection)
}

/** Extract the dominant biome preset name from a modern chunk's surface section, if present. */
export function readChunkBiome(chunk: NbtCompound): string | null {
  const root = chunkRoot(chunk)
  const rawSections = (root.sections ?? root.Sections) as NbtTag[] | undefined
  if (!Array.isArray(rawSections)) return null
  // Prefer a surface section (Y = 4 => y=64..79)
  let fallback: string | null = null
  for (const item of rawSections) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const sec = item as NbtCompound
    const biomes = sec.biomes as NbtCompound | undefined
    const pal = biomes?.palette as NbtTag[] | undefined
    if (!Array.isArray(pal) || !pal.length) continue
    const first = String(pal[0])
    if (sec.Y === 4 || sec.Y === 5) return first
    if (!fallback) fallback = first
  }
  return fallback
}
