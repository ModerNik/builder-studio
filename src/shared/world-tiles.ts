// Compact binary formats shared between Electron main's world reader and the renderer's Web Workers.
// Everything is little-endian and designed for zero-copy ArrayBuffer transfer.

export const WLO_MAGIC = 0x314f4c57 // 'WLO1'
export const WHI_MAGIC = 0x31494857 // 'WHI1'

export const LOWRES_GRID = 256 // 256x256 cells per 512x512 region (2 blocks per cell)
export const LOWRES_STEP = 2
export const LOWRES_CELLS = LOWRES_GRID * LOWRES_GRID

export const NO_HEIGHT = -32768

// Biome tint presets stored in upper 4 bits of lowres flags (0..15)
export const BIOME_PLAINS = 0
export const BIOME_FOREST = 1
export const BIOME_TAIGA = 2
export const BIOME_SWAMP = 3
export const BIOME_DESERT = 4
export const BIOME_JUNGLE = 5
export const BIOME_SNOW = 6
export const BIOME_BADLANDS = 7
export const BIOME_DARK_FOREST = 8
export const BIOME_CHERRY = 9

export const FLAG_WATER = 0x01
export const FLAG_FOLIAGE = 0x02
export const FLAG_GRASS = 0x04
export const FLAG_LAVA = 0x08

export interface LowresTileData {
  rx: number
  rz: number
  step: number
  grid: number
  palette: string[]
  /** Top surface Y [gz * grid + gx]; NO_HEIGHT where no chunk exists. */
  surfaceY: Int16Array
  /** Solid ground Y beneath water [gz * grid + gx]; equals surfaceY on dry land. */
  oceanFloorY: Int16Array
  /** Surface block palette index (for land) or underwater floor block (for water) [gz * grid + gx]. */
  topBlock: Uint16Array
  /** Bit flags (FLAG_*) + upper nibble biome preset [gz * grid + gx]. */
  flags: Uint8Array
}

export interface HiresChunkData {
  cx: number
  cz: number
  minY: number
  height: number
  palette: string[]
  /** Top block Y per column [lz * 16 + lx]; NO_HEIGHT where void. */
  surfaceY: Int16Array
  /** Block palette indices in ((ly * 16 + lz) * 16 + lx) order; 0 is air. */
  blocks: Uint16Array
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function align4(n: number): number {
  return (n + 3) & ~3
}

/** Encode a LOD-1 region tile into a single contiguous binary buffer. */
export function encodeLowresTile(tile: LowresTileData): Uint8Array {
  const palBytes = textEncoder.encode(JSON.stringify(tile.palette))
  const palPadded = align4(palBytes.byteLength)
  const cells = tile.grid * tile.grid
  const headerSize = 20
  const total = headerSize + palPadded + cells * 2 + cells * 2 + cells * 2 + cells
  const buf = new ArrayBuffer(total)
  const view = new DataView(buf)
  const out = new Uint8Array(buf)

  view.setUint32(0, WLO_MAGIC, true)
  view.setInt32(4, tile.rx, true)
  view.setInt32(8, tile.rz, true)
  view.setUint16(12, tile.step, true)
  view.setUint16(14, tile.grid, true)
  view.setUint32(16, palBytes.byteLength, true)
  out.set(palBytes, headerSize)

  let off = headerSize + palPadded
  new Int16Array(buf, off, cells).set(tile.surfaceY)
  off += cells * 2
  new Int16Array(buf, off, cells).set(tile.oceanFloorY)
  off += cells * 2
  new Uint16Array(buf, off, cells).set(tile.topBlock)
  off += cells * 2
  new Uint8Array(buf, off, cells).set(tile.flags)
  return out
}

/** Decode a LOD-1 region tile buffer without copying typed arrays. */
export function decodeLowresTile(buf: ArrayBuffer): LowresTileData {
  const view = new DataView(buf)
  if (buf.byteLength < 20 || view.getUint32(0, true) !== WLO_MAGIC) {
    throw new Error('Invalid lowres world tile header')
  }
  const rx = view.getInt32(4, true)
  const rz = view.getInt32(8, true)
  const step = view.getUint16(12, true)
  const grid = view.getUint16(14, true)
  const palLen = view.getUint32(16, true)
  const palPadded = align4(palLen)
  const cells = grid * grid
  const palette = JSON.parse(textDecoder.decode(new Uint8Array(buf, 20, palLen))) as string[]

  let off = 20 + palPadded
  const surfaceY = new Int16Array(buf, off, cells)
  off += cells * 2
  const oceanFloorY = new Int16Array(buf, off, cells)
  off += cells * 2
  const topBlock = new Uint16Array(buf, off, cells)
  off += cells * 2
  const flags = new Uint8Array(buf, off, cells)
  return { rx, rz, step, grid, palette, surfaceY, oceanFloorY, topBlock, flags }
}

/** Encode a LOD-0 hires chunk into a single contiguous binary buffer. */
export function encodeHiresChunk(chunk: HiresChunkData): Uint8Array {
  const palBytes = textEncoder.encode(JSON.stringify(chunk.palette))
  const palPadded = align4(palBytes.byteLength)
  const headerSize = 20
  const blockCount = 16 * chunk.height * 16
  const total = headerSize + palPadded + 256 * 2 + blockCount * 2
  const buf = new ArrayBuffer(total)
  const view = new DataView(buf)
  const out = new Uint8Array(buf)

  view.setUint32(0, WHI_MAGIC, true)
  view.setInt32(4, chunk.cx, true)
  view.setInt32(8, chunk.cz, true)
  view.setInt16(12, chunk.minY, true)
  view.setUint16(14, chunk.height, true)
  view.setUint32(16, palBytes.byteLength, true)
  out.set(palBytes, headerSize)

  let off = headerSize + palPadded
  new Int16Array(buf, off, 256).set(chunk.surfaceY)
  off += 256 * 2
  new Uint16Array(buf, off, blockCount).set(chunk.blocks)
  return out
}

/** Decode a LOD-0 hires chunk buffer without copying typed arrays. */
export function decodeHiresChunk(buf: ArrayBuffer): HiresChunkData {
  const view = new DataView(buf)
  if (buf.byteLength < 20 || view.getUint32(0, true) !== WHI_MAGIC) {
    throw new Error('Invalid hires world chunk header')
  }
  const cx = view.getInt32(4, true)
  const cz = view.getInt32(8, true)
  const minY = view.getInt16(12, true)
  const height = view.getUint16(14, true)
  const palLen = view.getUint32(16, true)
  const palPadded = align4(palLen)
  const palette = JSON.parse(textDecoder.decode(new Uint8Array(buf, 20, palLen))) as string[]

  let off = 20 + palPadded
  const surfaceY = new Int16Array(buf, off, 256)
  off += 256 * 2
  const blocks = new Uint16Array(buf, off, 16 * height * 16)
  return { cx, cz, minY, height, palette, surfaceY, blocks }
}
