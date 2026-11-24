// Off-main-thread BlueMap-style dual-LOD mesher Web Worker.
// Builds transferable vertex/index buffers for LOD-1 region tiles (.wlo) and LOD-0 voxel chunks (.whi).
import {
  decodeHiresChunk,
  decodeLowresTile,
  FLAG_FOLIAGE,
  FLAG_GRASS,
  FLAG_LAVA,
  FLAG_WATER,
  NO_HEIGHT
} from '@shared/world-tiles'
import { BIOME_TINTS, FALLBACK_COLORS, type BlockAtlasMap, type Rgb } from '../model/colors'

const OPAQUE = 0
const CUTOUT = 1
const TRANSLUCENT = 2
const LIQUID = 3

const STRIDE = 11 // x, y, z, nx, ny, nz, u, v, r, g, b

export interface MeshBucketBuffer {
  vertices: Float32Array
  indices: Uint32Array
}

export interface LowresMeshResult {
  type: 'lowres'
  id: number
  rx: number
  rz: number
  terrain: MeshBucketBuffer
  water: MeshBucketBuffer
  /** 256x256 surface heightmap copied back for instant main-thread height queries. */
  surfaceY: Int16Array
  grid: number
  step: number
}

export interface HiresMeshResult {
  type: 'hires'
  id: number
  cx: number
  cz: number
  buckets: [MeshBucketBuffer, MeshBucketBuffer, MeshBucketBuffer, MeshBucketBuffer]
  surfaceY: Int16Array
}

type WorkerIn =
  | { type: 'init'; colors: Record<string, Rgb>; atlas: BlockAtlasMap | null }
  | { type: 'lowres'; id: number; buffer: ArrayBuffer }
  | { type: 'hires'; id: number; buffer: ArrayBuffer }

let colors: Record<string, Rgb> = { ...FALLBACK_COLORS }
let atlas: BlockAtlasMap | null = null

class QuadBuf {
  f: Float32Array
  n = 0
  constructor(initialFloats = 4096) {
    this.f = new Float32Array(initialFloats)
  }
  private ensure(extra: number): void {
    if (this.n + extra <= this.f.length) return
    const next = new Float32Array(Math.max(this.f.length * 2, this.n + extra))
    next.set(this.f.subarray(0, this.n))
    this.f = next
  }
  pushQuad(
    v0: [number, number, number],
    v1: [number, number, number],
    v2: [number, number, number],
    v3: [number, number, number],
    nx: number,
    ny: number,
    nz: number,
    u0: number,
    v0t: number,
    u1: number,
    v1t: number,
    r: number,
    g: number,
    b: number,
    ao0 = 1,
    ao1 = 1,
    ao2 = 1,
    ao3 = 1,
    flip = false
  ): void {
    this.ensure(4 * STRIDE)
    const f = this.f
    let p = this.n
    const emit = (v: [number, number, number], u: number, vt: number, ao: number): void => {
      f[p++] = v[0]
      f[p++] = v[1]
      f[p++] = v[2]
      f[p++] = nx
      f[p++] = ny
      f[p++] = nz
      f[p++] = u
      f[p++] = vt
      f[p++] = r * ao
      f[p++] = g * ao
      f[p++] = b * ao
    }
    if (!flip) {
      emit(v0, u0, v0t, ao0)
      emit(v1, u1, v0t, ao1)
      emit(v2, u1, v1t, ao2)
      emit(v3, u0, v1t, ao3)
    } else {
      emit(v1, u1, v0t, ao1)
      emit(v2, u1, v1t, ao2)
      emit(v3, u0, v1t, ao3)
      emit(v0, u0, v0t, ao0)
    }
    this.n = p
  }
  finish(): MeshBucketBuffer {
    const vertices = this.f.slice(0, this.n)
    const quads = this.n / (4 * STRIDE)
    const indices = new Uint32Array(quads * 6)
    for (let q = 0; q < quads; q++) {
      const b = q * 4
      const o = q * 6
      indices[o] = b
      indices[o + 1] = b + 1
      indices[o + 2] = b + 2
      indices[o + 3] = b
      indices[o + 4] = b + 2
      indices[o + 5] = b + 3
    }
    return { vertices, indices }
  }
}

function shortName(state: string): string {
  const noNs = state.startsWith('minecraft:') ? state.slice(10) : state
  const bracket = noNs.indexOf('[')
  return bracket >= 0 ? noNs.slice(0, bracket) : noNs
}

function colorForBlock(short: string, flags: number): Rgb {
  const biome = BIOME_TINTS[(flags >>> 4) & 0x0f] ?? BIOME_TINTS[0]
  if (flags & FLAG_LAVA) return [0.95, 0.42, 0.12]
  if (flags & FLAG_GRASS) return biome.grass
  if (flags & FLAG_FOLIAGE) {
    if (short.includes('cherry')) return [0.94, 0.66, 0.78]
    if (short.includes('spruce')) return [0.27, 0.44, 0.29]
    if (short.includes('birch')) return [0.43, 0.63, 0.26]
    return biome.foliage
  }
  return colors[short] ?? [0.55, 0.56, 0.58]
}

/** Build a crisp volumetric 3D lowres terrain + translucent water mesh from a 256x256 region tile. */
function meshLowres(id: number, buffer: ArrayBuffer): LowresMeshResult {
  const tile = decodeLowresTile(buffer)
  const { rx, rz, grid, step, palette, surfaceY, oceanFloorY, topBlock, flags } = tile
  const terrainBuf = new QuadBuf(65536)
  const waterBuf = new QuadBuf(16384)
  const ox = rx * 512
  const oz = rz * 512
  const invGrid = 1 / grid

  // Pre-resolve palette short names
  const shorts = palette.map(shortName)

  for (let gz = 0; gz < grid; gz++) {
    const rowOff = gz * grid
    const wz0 = oz + gz * step
    const wz1 = wz0 + step
    const v0 = gz * invGrid
    const v1 = (gz + 1) * invGrid

    for (let gx = 0; gx < grid; gx++) {
      const idx = rowOff + gx
      const sy = surfaceY[idx]
      if (sy === NO_HEIGHT) continue

      const fl = flags[idx]
      const isWater = (fl & FLAG_WATER) !== 0
      const groundY = isWater ? oceanFloorY[idx] : sy
      const wx0 = ox + gx * step
      const wx1 = wx0 + step
      const u0 = gx * invGrid
      const u1 = (gx + 1) * invGrid

      const short = shorts[topBlock[idx]] ?? 'stone'
      let [r, g, b] = colorForBlock(short, isWater ? fl & ~FLAG_WATER : fl)

      // Subtle neighbor slope shading (NW sun key)
      const hW = gx > 0 && surfaceY[idx - 1] !== NO_HEIGHT ? surfaceY[idx - 1] : sy
      const hN = gz > 0 && surfaceY[idx - grid] !== NO_HEIGHT ? surfaceY[idx - grid] : sy
      const slope = Math.max(-0.18, Math.min(0.16, (sy - hW + (sy - hN)) * 0.03))

      if (isWater) {
        const depth = Math.max(1, sy - groundY)
        const dim = Math.max(0.45, 0.92 - depth * 0.035)
        r *= dim
        g *= dim
        b *= dim
        // Water surface quad (slightly recessed)
        const biome = BIOME_TINTS[(fl >>> 4) & 0x0f] ?? BIOME_TINTS[0]
        const [wr, wg, wb] = biome.water
        const wy = sy + 0.85
        const depthTint = Math.max(0.72, 1.04 - depth * 0.015)
        waterBuf.pushQuad(
          [wx0, wy, wz0],
          [wx0, wy, wz1],
          [wx1, wy, wz1],
          [wx1, wy, wz0],
          0,
          1,
          0,
          u0,
          v0,
          u1,
          v1,
          wr * depthTint,
          wg * depthTint,
          wb * depthTint
        )
      }

      const shade = Math.max(0.68, Math.min(1.16, 1 + slope))
      const topY = groundY + 1
      terrainBuf.pushQuad(
        [wx0, topY, wz0],
        [wx0, topY, wz1],
        [wx1, topY, wz1],
        [wx1, topY, wz0],
        0,
        1,
        0,
        u0,
        v0,
        u1,
        v1,
        Math.min(1, r * shade),
        Math.min(1, g * shade),
        Math.min(1, b * shade)
      )

      // Vertical cliff skirts only where neighbor is strictly lower (volumetric voxel silhouette)
      const skirtColor = (mul: number): [number, number, number] => [
        Math.min(1, r * mul),
        Math.min(1, g * mul),
        Math.min(1, b * mul)
      ]

      // +X neighbor (east)
      const nE =
        gx + 1 < grid
          ? flags[idx + 1] & FLAG_WATER
            ? oceanFloorY[idx + 1]
            : surfaceY[idx + 1]
          : NO_HEIGHT
      const yE = nE === NO_HEIGHT ? groundY - 4 : nE
      if (yE < groundY) {
        const bot = Math.max(yE + 1, groundY - 24)
        const [sr, sg, sb] = skirtColor(0.74)
        terrainBuf.pushQuad(
          [wx1, topY, wz0],
          [wx1, topY, wz1],
          [wx1, bot, wz1],
          [wx1, bot, wz0],
          1,
          0,
          0,
          u0,
          v0,
          u1,
          v1,
          sr,
          sg,
          sb
        )
      }
      // -X neighbor (west)
      const nW =
        gx > 0
          ? flags[idx - 1] & FLAG_WATER
            ? oceanFloorY[idx - 1]
            : surfaceY[idx - 1]
          : NO_HEIGHT
      const yW = nW === NO_HEIGHT ? groundY - 4 : nW
      if (yW < groundY) {
        const bot = Math.max(yW + 1, groundY - 24)
        const [sr, sg, sb] = skirtColor(0.8)
        terrainBuf.pushQuad(
          [wx0, topY, wz1],
          [wx0, topY, wz0],
          [wx0, bot, wz0],
          [wx0, bot, wz1],
          -1,
          0,
          0,
          u0,
          v0,
          u1,
          v1,
          sr,
          sg,
          sb
        )
      }
      // +Z neighbor (south)
      const nS =
        gz + 1 < grid
          ? flags[idx + grid] & FLAG_WATER
            ? oceanFloorY[idx + grid]
            : surfaceY[idx + grid]
          : NO_HEIGHT
      const yS = nS === NO_HEIGHT ? groundY - 4 : nS
      if (yS < groundY) {
        const bot = Math.max(yS + 1, groundY - 24)
        const [sr, sg, sb] = skirtColor(0.84)
        terrainBuf.pushQuad(
          [wx0, topY, wz1],
          [wx1, topY, wz1],
          [wx1, bot, wz1],
          [wx0, bot, wz1],
          0,
          0,
          1,
          u0,
          v0,
          u1,
          v1,
          sr,
          sg,
          sb
        )
      }
      // -Z neighbor (north)
      const nN =
        gz > 0
          ? flags[idx - grid] & FLAG_WATER
            ? oceanFloorY[idx - grid]
            : surfaceY[idx - grid]
          : NO_HEIGHT
      const yN = nN === NO_HEIGHT ? groundY - 4 : nN
      if (yN < groundY) {
        const bot = Math.max(yN + 1, groundY - 24)
        const [sr, sg, sb] = skirtColor(0.76)
        terrainBuf.pushQuad(
          [wx1, topY, wz0],
          [wx0, topY, wz0],
          [wx0, bot, wz0],
          [wx1, bot, wz0],
          0,
          0,
          -1,
          u0,
          v0,
          u1,
          v1,
          sr,
          sg,
          sb
        )
      }
    }
  }

  return {
    type: 'lowres',
    id,
    rx,
    rz,
    terrain: terrainBuf.finish(),
    water: waterBuf.finish(),
    surfaceY: new Int16Array(surfaceY),
    grid,
    step
  }
}

// Block classification for fast hires voxel meshing
const CROSS_RE =
  /^(?:short_grass|tall_grass|fern|large_fern|dead_bush|dandelion|poppy|blue_orchid|allium|azure_bluet|red_tulip|orange_tulip|white_tulip|pink_tulip|oxeye_daisy|cornflower|lily_of_the_valley|wither_rose|sunflower|lilac|rose_bush|peony|sugar_cane|sweet_berry_bush|pink_petals|brown_mushroom|red_mushroom|crimson_fungus|warped_fungus|crimson_roots|warped_roots|nether_sprouts|bamboo|seagrass|tall_seagrass|kelp|kelp_plant|.*_sapling)$/
const THIN_RE = /^(?:snow|lily_pad|.*_carpet|.*_pressure_plate|moss_carpet)$/
const SLAB_RE = /_slab$/

interface PaletteMeta {
  short: string
  air: boolean
  opaque: boolean
  water: boolean
  selfCull: boolean
  cross: boolean
  height: number
  bucket: number
  topUv: [number, number, number, number]
  sideUv: [number, number, number, number]
  bottomUv: [number, number, number, number]
  topColor: Rgb
  sideColor: Rgb
  bottomColor: Rgb
}

const ZERO_UV: [number, number, number, number] = [0, 0, 0, 0]
const AO_CURVE = [1.0, 0.84, 0.69, 0.55]

function aoFactor(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return AO_CURVE[3]
  return AO_CURVE[(side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0)]
}

/** Build full 3D face-culled, AO-shaded, textured voxel geometry for a 16x16 hires chunk. */
function meshHires(id: number, buffer: ArrayBuffer): HiresMeshResult {
  const chunk = decodeHiresChunk(buffer)
  const { cx, cz, minY, height, palette, surfaceY, blocks } = chunk
  const bufs: [QuadBuf, QuadBuf, QuadBuf, QuadBuf] = [
    new QuadBuf(16384),
    new QuadBuf(4096),
    new QuadBuf(1024),
    new QuadBuf(4096)
  ]

  const meta: PaletteMeta[] = palette.map((raw, i) => {
    if (i === 0) {
      return {
        short: 'air',
        air: true,
        opaque: false,
        water: false,
        selfCull: false,
        cross: false,
        height: 1,
        bucket: OPAQUE,
        topUv: ZERO_UV,
        sideUv: ZERO_UV,
        bottomUv: ZERO_UV,
        topColor: [1, 1, 1],
        sideColor: [1, 1, 1],
        bottomColor: [1, 1, 1]
      }
    }
    const short = shortName(raw)
    const isWater = short === 'water' || short === 'bubble_column'
    const isCross = CROSS_RE.test(short)
    const isThin = THIN_RE.test(short)
    const isSlab = SLAB_RE.test(short)
    const isLeaves = short.endsWith('_leaves')
    const isGlass = short.includes('glass')
    const isIce = short === 'ice'
    const uv = atlas?.[short]
    const fallbackRgb = colors[short] ?? [0.58, 0.59, 0.61]

    const bucket = isWater
      ? LIQUID
      : isCross || isLeaves
        ? CUTOUT
        : uv
          ? uv.bucket
          : isIce || (isGlass && short.includes('stained'))
            ? TRANSLUCENT
            : isGlass
              ? CUTOUT
              : OPAQUE

    const opaque = bucket === OPAQUE && !isCross && !isThin && !isSlab
    const selfCull = isWater || isIce || isGlass
    const blockH = isThin ? 0.14 : isSlab ? 0.5 : 1

    const topColor: Rgb = uv ? (uv.tintTop ?? [1, 1, 1]) : fallbackRgb
    const sideColor: Rgb = uv
      ? (uv.tintSide ?? (short === 'grass_block' ? [1, 1, 1] : [1, 1, 1]))
      : short === 'grass_block'
        ? [0.53, 0.38, 0.26]
        : fallbackRgb
    const bottomColor: Rgb = uv
      ? [1, 1, 1]
      : short === 'grass_block'
        ? [0.53, 0.38, 0.26]
        : fallbackRgb

    return {
      short,
      air: false,
      opaque,
      water: isWater,
      selfCull,
      cross: isCross,
      height: blockH,
      bucket,
      topUv: uv?.top ?? ZERO_UV,
      sideUv: uv?.side ?? ZERO_UV,
      bottomUv: uv?.bottom ?? ZERO_UV,
      topColor,
      sideColor,
      bottomColor
    }
  })

  const ox = cx * 16
  const oz = cz * 16

  const at = (lx: number, ly: number, lz: number): PaletteMeta => {
    if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || ly < 0 || ly >= height) return meta[0]
    return meta[blocks[(ly << 8) | (lz << 4) | lx]]
  }
  const occludes = (lx: number, ly: number, lz: number): boolean => at(lx, ly, lz).opaque

  const hiddenBy = (cur: PaletteMeta, neighbor: PaletteMeta): boolean => {
    if (neighbor.opaque) return true
    if (cur.selfCull && neighbor.short === cur.short) return true
    if (cur.water && neighbor.water) return true
    return false
  }

  for (let ly = 0; ly < height; ly++) {
    const wy = minY + ly
    const yOff = ly << 8
    for (let lz = 0; lz < 16; lz++) {
      const wz = oz + lz
      const zOff = yOff | (lz << 4)
      for (let lx = 0; lx < 16; lx++) {
        const pid = blocks[zOff | lx]
        if (pid === 0) continue
        const m = meta[pid]
        if (m.air) continue
        const wx = ox + lx
        const dst = bufs[m.bucket]

        // Cross-quad plants (flowers, short grass, ferns, saplings)
        if (m.cross) {
          const [u0, v0, u1, v1] = m.sideUv
          const [r, g, b] = m.topColor
          const y1 = wy + 0.9
          const pad = 0.14
          // Two crossed double-sided quads
          dst.pushQuad(
            [wx + pad, y1, wz + pad],
            [wx + 1 - pad, y1, wz + 1 - pad],
            [wx + 1 - pad, wy, wz + 1 - pad],
            [wx + pad, wy, wz + pad],
            0.7,
            0.3,
            -0.7,
            u0,
            v0,
            u1,
            v1,
            r * 0.92,
            g * 0.92,
            b * 0.92
          )
          dst.pushQuad(
            [wx + 1 - pad, y1, wz + 1 - pad],
            [wx + pad, y1, wz + pad],
            [wx + pad, wy, wz + pad],
            [wx + 1 - pad, wy, wz + 1 - pad],
            -0.7,
            0.3,
            0.7,
            u0,
            v0,
            u1,
            v1,
            r * 0.92,
            g * 0.92,
            b * 0.92
          )
          dst.pushQuad(
            [wx + pad, y1, wz + 1 - pad],
            [wx + 1 - pad, y1, wz + pad],
            [wx + 1 - pad, wy, wz + pad],
            [wx + pad, wy, wz + 1 - pad],
            -0.7,
            0.3,
            -0.7,
            u0,
            v0,
            u1,
            v1,
            r * 0.88,
            g * 0.88,
            b * 0.88
          )
          dst.pushQuad(
            [wx + 1 - pad, y1, wz + pad],
            [wx + pad, y1, wz + 1 - pad],
            [wx + pad, wy, wz + 1 - pad],
            [wx + 1 - pad, wy, wz + pad],
            0.7,
            0.3,
            0.7,
            u0,
            v0,
            u1,
            v1,
            r * 0.88,
            g * 0.88,
            b * 0.88
          )
          continue
        }

        const nUp = at(lx, ly + 1, lz)
        const topY = m.water && !nUp.water ? wy + 0.875 : wy + m.height

        // +Y (top)
        if (!hiddenBy(m, nUp) || m.height < 1) {
          const [u0, v0, u1, v1] = m.topUv
          const [r, g, b] = m.topColor
          const ay = ly + 1
          const a0 = aoFactor(
            occludes(lx - 1, ay, lz),
            occludes(lx, ay, lz - 1),
            occludes(lx - 1, ay, lz - 1)
          )
          const a1 = aoFactor(
            occludes(lx - 1, ay, lz),
            occludes(lx, ay, lz + 1),
            occludes(lx - 1, ay, lz + 1)
          )
          const a2 = aoFactor(
            occludes(lx + 1, ay, lz),
            occludes(lx, ay, lz + 1),
            occludes(lx + 1, ay, lz + 1)
          )
          const a3 = aoFactor(
            occludes(lx + 1, ay, lz),
            occludes(lx, ay, lz - 1),
            occludes(lx + 1, ay, lz - 1)
          )
          dst.pushQuad(
            [wx, topY, wz],
            [wx, topY, wz + 1],
            [wx + 1, topY, wz + 1],
            [wx + 1, topY, wz],
            0,
            1,
            0,
            u0,
            v0,
            u1,
            v1,
            r,
            g,
            b,
            a0,
            a1,
            a2,
            a3,
            a0 + a2 < a1 + a3
          )
        }

        // -Y (bottom)
        if (ly > 0 && !hiddenBy(m, at(lx, ly - 1, lz))) {
          const [u0, v0, u1, v1] = m.bottomUv
          const [r, g, b] = m.bottomColor
          dst.pushQuad(
            [wx, wy, wz + 1],
            [wx, wy, wz],
            [wx + 1, wy, wz],
            [wx + 1, wy, wz + 1],
            0,
            -1,
            0,
            u0,
            v0,
            u1,
            v1,
            r * 0.58,
            g * 0.58,
            b * 0.58
          )
        }

        // +Z (south)
        if (!hiddenBy(m, at(lx, ly, lz + 1))) {
          const [u0, v0, u1, v1] = m.sideUv
          const [r, g, b] = m.sideColor
          const az = lz + 1
          const a0 = aoFactor(
            occludes(lx - 1, ly, az),
            occludes(lx, ly + 1, az),
            occludes(lx - 1, ly + 1, az)
          )
          const a1 = aoFactor(
            occludes(lx + 1, ly, az),
            occludes(lx, ly + 1, az),
            occludes(lx + 1, ly + 1, az)
          )
          const a2 = aoFactor(
            occludes(lx + 1, ly, az),
            occludes(lx, ly - 1, az),
            occludes(lx + 1, ly - 1, az)
          )
          const a3 = aoFactor(
            occludes(lx - 1, ly, az),
            occludes(lx, ly - 1, az),
            occludes(lx - 1, ly - 1, az)
          )
          dst.pushQuad(
            [wx, topY, wz + 1],
            [wx + 1, topY, wz + 1],
            [wx + 1, wy, wz + 1],
            [wx, wy, wz + 1],
            0,
            0,
            1,
            u0,
            v0,
            u1,
            v1,
            r * 0.88,
            g * 0.88,
            b * 0.88,
            a0,
            a1,
            a2,
            a3,
            a0 + a2 < a1 + a3
          )
        }

        // -Z (north)
        if (!hiddenBy(m, at(lx, ly, lz - 1))) {
          const [u0, v0, u1, v1] = m.sideUv
          const [r, g, b] = m.sideColor
          const az = lz - 1
          const a0 = aoFactor(
            occludes(lx + 1, ly, az),
            occludes(lx, ly + 1, az),
            occludes(lx + 1, ly + 1, az)
          )
          const a1 = aoFactor(
            occludes(lx - 1, ly, az),
            occludes(lx, ly + 1, az),
            occludes(lx - 1, ly + 1, az)
          )
          const a2 = aoFactor(
            occludes(lx - 1, ly, az),
            occludes(lx, ly - 1, az),
            occludes(lx - 1, ly - 1, az)
          )
          const a3 = aoFactor(
            occludes(lx + 1, ly, az),
            occludes(lx, ly - 1, az),
            occludes(lx + 1, ly - 1, az)
          )
          dst.pushQuad(
            [wx + 1, topY, wz],
            [wx, topY, wz],
            [wx, wy, wz],
            [wx + 1, wy, wz],
            0,
            0,
            -1,
            u0,
            v0,
            u1,
            v1,
            r * 0.84,
            g * 0.84,
            b * 0.84,
            a0,
            a1,
            a2,
            a3,
            a0 + a2 < a1 + a3
          )
        }

        // +X (east)
        if (!hiddenBy(m, at(lx + 1, ly, lz))) {
          const [u0, v0, u1, v1] = m.sideUv
          const [r, g, b] = m.sideColor
          const ax = lx + 1
          const a0 = aoFactor(
            occludes(ax, ly, lz + 1),
            occludes(ax, ly + 1, lz),
            occludes(ax, ly + 1, lz + 1)
          )
          const a1 = aoFactor(
            occludes(ax, ly, lz - 1),
            occludes(ax, ly + 1, lz),
            occludes(ax, ly + 1, lz - 1)
          )
          const a2 = aoFactor(
            occludes(ax, ly, lz - 1),
            occludes(ax, ly - 1, lz),
            occludes(ax, ly - 1, lz - 1)
          )
          const a3 = aoFactor(
            occludes(ax, ly, lz + 1),
            occludes(ax, ly - 1, lz),
            occludes(ax, ly - 1, lz + 1)
          )
          dst.pushQuad(
            [wx + 1, topY, wz + 1],
            [wx + 1, topY, wz],
            [wx + 1, wy, wz],
            [wx + 1, wy, wz + 1],
            1,
            0,
            0,
            u0,
            v0,
            u1,
            v1,
            r * 0.78,
            g * 0.78,
            b * 0.78,
            a0,
            a1,
            a2,
            a3,
            a0 + a2 < a1 + a3
          )
        }

        // -X (west)
        if (!hiddenBy(m, at(lx - 1, ly, lz))) {
          const [u0, v0, u1, v1] = m.sideUv
          const [r, g, b] = m.sideColor
          const ax = lx - 1
          const a0 = aoFactor(
            occludes(ax, ly, lz - 1),
            occludes(ax, ly + 1, lz),
            occludes(ax, ly + 1, lz - 1)
          )
          const a1 = aoFactor(
            occludes(ax, ly, lz + 1),
            occludes(ax, ly + 1, lz),
            occludes(ax, ly + 1, lz + 1)
          )
          const a2 = aoFactor(
            occludes(ax, ly, lz + 1),
            occludes(ax, ly - 1, lz),
            occludes(ax, ly - 1, lz + 1)
          )
          const a3 = aoFactor(
            occludes(ax, ly, lz - 1),
            occludes(ax, ly - 1, lz),
            occludes(ax, ly - 1, lz - 1)
          )
          dst.pushQuad(
            [wx, topY, wz],
            [wx, topY, wz + 1],
            [wx, wy, wz + 1],
            [wx, wy, wz],
            -1,
            0,
            0,
            u0,
            v0,
            u1,
            v1,
            r * 0.76,
            g * 0.76,
            b * 0.76,
            a0,
            a1,
            a2,
            a3,
            a0 + a2 < a1 + a3
          )
        }
      }
    }
  }

  return {
    type: 'hires',
    id,
    cx,
    cz,
    buckets: [bufs[0].finish(), bufs[1].finish(), bufs[2].finish(), bufs[3].finish()],
    surfaceY: new Int16Array(surfaceY)
  }
}

const workerScope = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerIn>) => void) | null
  postMessage(message: unknown, transfer: Transferable[]): void
}

workerScope.onmessage = (e: MessageEvent<WorkerIn>) => {
  const msg = e.data
  if (msg.type === 'init') {
    colors = { ...FALLBACK_COLORS, ...msg.colors }
    atlas = msg.atlas
    return
  }
  if (msg.type === 'lowres') {
    const res = meshLowres(msg.id, msg.buffer)
    const transfers: Transferable[] = [
      res.terrain.vertices.buffer,
      res.terrain.indices.buffer,
      res.water.vertices.buffer,
      res.water.indices.buffer,
      res.surfaceY.buffer
    ]
    workerScope.postMessage(res, transfers)
    return
  }
  if (msg.type === 'hires') {
    const res = meshHires(msg.id, msg.buffer)
    const transfers: Transferable[] = [res.surfaceY.buffer]
    for (const b of res.buckets) {
      transfers.push(b.vertices.buffer, b.indices.buffer)
    }
    workerScope.postMessage(res, transfers)
  }
}
