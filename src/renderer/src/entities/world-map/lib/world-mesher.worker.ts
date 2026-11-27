// Off-main-thread BlueMap-style dual-LOD mesher Web Worker.
// Builds transferable vertex buffers for LOD-1 region tiles (.wlo) and LOD-0 voxel chunks (.whi).
// Uses chunk-aligned greedy 2D meshing for lowres terrain/water and flat-scalar buffers for minimal GC.
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
export const UNTEXTURED = 4

export type LowresLod = 0 | 1 | 2

export interface MeshBucketBuffer {
  /** World-space XYZ positions (3 float32 per vertex = 12 B/v). */
  positions: Float32Array
  /** Quantized signed normals in [-127, 127] (4 int8 per vertex, w = 0; 4-byte aligned for ANGLE/D3D11). */
  normals: Int8Array
  /** Atlas UVs (Float32Array) for hires chunks or chunk-mask UVs (Uint8Array normalized) for lowres regions. */
  uvs: Float32Array | Uint8Array
  /** Quantized RGBA vertex colors in [0, 255] (4 uint8 per vertex, alpha = 255; 4-byte aligned). */
  colors: Uint8Array
  quadCount: number
  /** Precomputed [minX, minY, minZ, maxX, maxY, maxZ] so main-thread mounting needs 0 vertex loops. */
  bounds: [number, number, number, number, number, number] | null
}

export interface LowresMeshResult {
  type: 'lowres'
  id: number
  rx: number
  rz: number
  lod: LowresLod
  terrain: MeshBucketBuffer
  water: MeshBucketBuffer
  /** Surface heightmap at this LOD's resolution for fast main-thread height queries. */
  surfaceY: Int16Array
  grid: number
  step: number
}

export interface HiresMeshResult {
  type: 'hires'
  id: number
  cx: number
  cz: number
  buckets: [
    MeshBucketBuffer,
    MeshBucketBuffer,
    MeshBucketBuffer,
    MeshBucketBuffer,
    MeshBucketBuffer
  ]
  surfaceY: Int16Array
}

export interface WorkerErrorResult {
  type: 'error'
  id: number
  message: string
}

type WorkerIn =
  | { type: 'init'; colors: Record<string, Rgb>; atlas: BlockAtlasMap | null }
  | { type: 'lowres'; id: number; buffer: ArrayBuffer; lod?: LowresLod }
  | { type: 'hires'; id: number; buffer: ArrayBuffer }

let colors: Record<string, Rgb> = { ...FALLBACK_COLORS }
let atlas: BlockAtlasMap | null = null

/** Build the standard repeating quad triangle index buffer [0,1,2, 0,2,3, ...]. */
export function buildQuadIndices(quadCount: number): Uint32Array {
  const indices = new Uint32Array(quadCount * 6)
  for (let q = 0; q < quadCount; q++) {
    const b = q * 4
    const o = q * 6
    indices[o] = b
    indices[o + 1] = b + 1
    indices[o + 2] = b + 2
    indices[o + 3] = b
    indices[o + 4] = b + 2
    indices[o + 5] = b + 3
  }
  return indices
}

function packNorm(v: number): number {
  const n = Math.round(v * 127)
  return n < -127 ? -127 : n > 127 ? 127 : n
}

function packColor(v: number): number {
  const n = Math.round(v * 255)
  return n < 0 ? 0 : n > 255 ? 255 : n
}

class QuadBuf {
  pos: Float32Array
  norm: Int8Array
  uvF: Float32Array | null
  uvU8: Uint8Array | null
  col: Uint8Array
  verts = 0
  cap: number
  private minX = Infinity
  private minY = Infinity
  private minZ = Infinity
  private maxX = -Infinity
  private maxY = -Infinity
  private maxZ = -Infinity

  constructor(
    initialVerts = 1024,
    private byteUv = false
  ) {
    this.cap = Math.max(16, initialVerts)
    this.pos = new Float32Array(this.cap * 3)
    this.norm = new Int8Array(this.cap * 4)
    this.uvF = byteUv ? null : new Float32Array(this.cap * 2)
    this.uvU8 = byteUv ? new Uint8Array(this.cap * 2) : null
    this.col = new Uint8Array(this.cap * 4)
  }

  private ensure(extraVerts: number): void {
    if (this.verts + extraVerts <= this.cap) return
    const nextCap = Math.max(this.cap * 2, this.verts + extraVerts)
    const nextPos = new Float32Array(nextCap * 3)
    nextPos.set(this.pos.subarray(0, this.verts * 3))
    this.pos = nextPos

    const nextNorm = new Int8Array(nextCap * 4)
    nextNorm.set(this.norm.subarray(0, this.verts * 4))
    this.norm = nextNorm

    if (this.byteUv) {
      const nextUv = new Uint8Array(nextCap * 2)
      nextUv.set(this.uvU8!.subarray(0, this.verts * 2))
      this.uvU8 = nextUv
    } else {
      const nextUv = new Float32Array(nextCap * 2)
      nextUv.set(this.uvF!.subarray(0, this.verts * 2))
      this.uvF = nextUv
    }

    const nextCol = new Uint8Array(nextCap * 4)
    nextCol.set(this.col.subarray(0, this.verts * 4))
    this.col = nextCol

    this.cap = nextCap
  }

  private expandBounds(x: number, y: number, z: number): void {
    if (x < this.minX) this.minX = x
    if (x > this.maxX) this.maxX = x
    if (y < this.minY) this.minY = y
    if (y > this.maxY) this.maxY = y
    if (z < this.minZ) this.minZ = z
    if (z > this.maxZ) this.maxZ = z
  }

  pushQuad(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    x3: number,
    y3: number,
    z3: number,
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
    this.ensure(4)
    this.expandBounds(x0, y0, z0)
    this.expandBounds(x1, y1, z1)
    this.expandBounds(x2, y2, z2)
    this.expandBounds(x3, y3, z3)

    const pnx = packNorm(nx)
    const pny = packNorm(ny)
    const pnz = packNorm(nz)

    const c0r = packColor(r * ao0)
    const c0g = packColor(g * ao0)
    const c0b = packColor(b * ao0)
    const c1r = packColor(r * ao1)
    const c1g = packColor(g * ao1)
    const c1b = packColor(b * ao1)
    const c2r = packColor(r * ao2)
    const c2g = packColor(g * ao2)
    const c2b = packColor(b * ao2)
    const c3r = packColor(r * ao3)
    const c3g = packColor(g * ao3)
    const c3b = packColor(b * ao3)

    const pos = this.pos
    const norm = this.norm
    const col = this.col
    let p3 = this.verts * 3
    let p2 = this.verts * 2
    let p4 = this.verts * 4

    // Fill shared face normal for all 4 vertices (w stays 0)
    for (let i = p4; i < p4 + 16; i += 4) {
      norm[i] = pnx
      norm[i + 1] = pny
      norm[i + 2] = pnz
    }

    if (!flip) {
      pos[p3] = x0
      pos[p3 + 1] = y0
      pos[p3 + 2] = z0
      col[p4] = c0r
      col[p4 + 1] = c0g
      col[p4 + 2] = c0b
      col[p4 + 3] = 255
      p4 += 4
      p3 += 3

      pos[p3] = x1
      pos[p3 + 1] = y1
      pos[p3 + 2] = z1
      col[p4] = c1r
      col[p4 + 1] = c1g
      col[p4 + 2] = c1b
      col[p4 + 3] = 255
      p4 += 4
      p3 += 3

      pos[p3] = x2
      pos[p3 + 1] = y2
      pos[p3 + 2] = z2
      col[p4] = c2r
      col[p4 + 1] = c2g
      col[p4 + 2] = c2b
      col[p4 + 3] = 255
      p4 += 4
      p3 += 3

      pos[p3] = x3
      pos[p3 + 1] = y3
      pos[p3 + 2] = z3
      col[p4] = c3r
      col[p4 + 1] = c3g
      col[p4 + 2] = c3b
      col[p4 + 3] = 255

      if (this.byteUv) {
        const uv = this.uvU8!
        const bu0 = packColor(u0)
        const bv0 = packColor(v0t)
        const bu1 = packColor(u1)
        const bv1 = packColor(v1t)
        uv[p2++] = bu0
        uv[p2++] = bv0
        uv[p2++] = bu1
        uv[p2++] = bv0
        uv[p2++] = bu1
        uv[p2++] = bv1
        uv[p2++] = bu0
        uv[p2] = bv1
      } else {
        const uv = this.uvF!
        uv[p2++] = u0
        uv[p2++] = v0t
        uv[p2++] = u1
        uv[p2++] = v0t
        uv[p2++] = u1
        uv[p2++] = v1t
        uv[p2++] = u0
        uv[p2] = v1t
      }
    } else {
      pos[p3] = x1
      pos[p3 + 1] = y1
      pos[p3 + 2] = z1
      col[p4] = c1r
      col[p4 + 1] = c1g
      col[p4 + 2] = c1b
      col[p4 + 3] = 255
      p4 += 4
      p3 += 3

      pos[p3] = x2
      pos[p3 + 1] = y2
      pos[p3 + 2] = z2
      col[p4] = c2r
      col[p4 + 1] = c2g
      col[p4 + 2] = c2b
      col[p4 + 3] = 255
      p4 += 4
      p3 += 3

      pos[p3] = x3
      pos[p3 + 1] = y3
      pos[p3 + 2] = z3
      col[p4] = c3r
      col[p4 + 1] = c3g
      col[p4 + 2] = c3b
      col[p4 + 3] = 255
      p4 += 4
      p3 += 3

      pos[p3] = x0
      pos[p3 + 1] = y0
      pos[p3 + 2] = z0
      col[p4] = c0r
      col[p4 + 1] = c0g
      col[p4 + 2] = c0b
      col[p4 + 3] = 255

      if (this.byteUv) {
        const uv = this.uvU8!
        const bu0 = packColor(u0)
        const bv0 = packColor(v0t)
        const bu1 = packColor(u1)
        const bv1 = packColor(v1t)
        uv[p2++] = bu1
        uv[p2++] = bv0
        uv[p2++] = bu1
        uv[p2++] = bv1
        uv[p2++] = bu0
        uv[p2++] = bv1
        uv[p2++] = bu0
        uv[p2] = bv0
      } else {
        const uv = this.uvF!
        uv[p2++] = u1
        uv[p2++] = v0t
        uv[p2++] = u1
        uv[p2++] = v1t
        uv[p2++] = u0
        uv[p2++] = v1t
        uv[p2++] = u0
        uv[p2] = v0t
      }
    }

    this.verts += 4
  }

  finish(): MeshBucketBuffer {
    const v = this.verts
    const quadCount = v / 4
    return {
      positions: this.pos.slice(0, v * 3),
      normals: this.norm.slice(0, v * 4),
      uvs: this.byteUv ? this.uvU8!.slice(0, v * 2) : this.uvF!.slice(0, v * 2),
      colors: this.col.slice(0, v * 4),
      quadCount,
      bounds:
        quadCount > 0
          ? [
              Math.fround(this.minX),
              Math.fround(this.minY),
              Math.fround(this.minZ),
              Math.fround(this.maxX),
              Math.fround(this.maxY),
              Math.fround(this.maxZ)
            ]
          : null
    }
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

const INV_63 = 1 / 63

function packRgb6(r: number, g: number, b: number): number {
  const rq = Math.max(0, Math.min(63, Math.round(r * 63)))
  const gq = Math.max(0, Math.min(63, Math.round(g * 63)))
  const bq = Math.max(0, Math.min(63, Math.round(b * 63)))
  return (rq << 12) | (gq << 6) | bq
}

function packSurfaceKey(y: number, rgb6: number): number {
  return (((y + 256) & 0x3ff) << 18) | rgb6
}

/** Build a greedy-merged volumetric 3D lowres terrain + translucent water mesh from a 256x256 region tile,
 *  optionally downsampled in-memory to Voxy-style coarser distance LODs (lod 0=step 2, lod 1=step 4, lod 2=step 8). */
export function meshLowres(id: number, buffer: ArrayBuffer, lod: LowresLod = 0): LowresMeshResult {
  const tile = decodeLowresTile(buffer)
  const { rx, rz, palette } = tile
  const factor =
    lod > 0 && tile.grid >= 32 * (1 << lod) && tile.grid % (1 << lod) === 0 ? 1 << lod : 1
  const effectiveLod: LowresLod = factor === 4 ? 2 : factor === 2 ? 1 : 0
  const grid = tile.grid / factor
  const step = tile.step * factor
  const cells = grid * grid

  let surfaceY: Int16Array
  let oceanFloorY: Int16Array
  let topBlock: Uint16Array
  let flags: Uint8Array

  if (factor === 1) {
    surfaceY = tile.surfaceY
    oceanFloorY = tile.oceanFloorY
    topBlock = tile.topBlock
    flags = tile.flags
  } else {
    surfaceY = new Int16Array(cells).fill(NO_HEIGHT)
    oceanFloorY = new Int16Array(cells).fill(NO_HEIGHT)
    topBlock = new Uint16Array(cells)
    flags = new Uint8Array(cells)
    const srcGrid = tile.grid
    const srcSy = tile.surfaceY
    const srcOf = tile.oceanFloorY
    const srcTop = tile.topBlock
    const srcFl = tile.flags

    // Pick the highest valid surface sample in each factor x factor block so peaks/coastlines stay crisp
    for (let gz = 0; gz < grid; gz++) {
      const sz0 = gz * factor
      const dstRow = gz * grid
      for (let gx = 0; gx < grid; gx++) {
        const sx0 = gx * factor
        let bestY = NO_HEIGHT
        let bestIdx = -1
        for (let dz = 0; dz < factor; dz++) {
          const sRow = (sz0 + dz) * srcGrid + sx0
          for (let dx = 0; dx < factor; dx++) {
            const si = sRow + dx
            const y = srcSy[si]
            if (y !== NO_HEIGHT && (bestIdx < 0 || y > bestY)) {
              bestY = y
              bestIdx = si
            }
          }
        }
        if (bestIdx >= 0) {
          const di = dstRow + gx
          surfaceY[di] = bestY
          oceanFloorY[di] = srcOf[bestIdx]
          topBlock[di] = srcTop[bestIdx]
          flags[di] = srcFl[bestIdx]
        }
      }
    }
  }

  const terrainBuf = new QuadBuf(Math.max(1024, cells >> 2), true)
  const waterBuf = new QuadBuf(Math.max(256, cells >> 4), true)
  const ox = rx * 512
  const oz = rz * 512

  // Pre-resolve palette short names
  const shorts = palette.map(shortName)

  // Precompute per-cell ground height, packed base colour, terrain top key, and water key
  const groundYArr = new Int16Array(cells).fill(NO_HEIGHT)
  const baseRgbArr = new Int32Array(cells)
  const terrainKeyArr = new Int32Array(cells).fill(-1)
  const waterKeyArr = new Int32Array(cells).fill(-1)

  for (let gz = 0; gz < grid; gz++) {
    const rowOff = gz * grid
    for (let gx = 0; gx < grid; gx++) {
      const idx = rowOff + gx
      const sy = surfaceY[idx]
      if (sy === NO_HEIGHT) continue

      const fl = flags[idx]
      const isWater = (fl & FLAG_WATER) !== 0
      const groundY = isWater ? oceanFloorY[idx] : sy
      groundYArr[idx] = groundY

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
        const biome = BIOME_TINTS[(fl >>> 4) & 0x0f] ?? BIOME_TINTS[0]
        const [wr, wg, wb] = biome.water
        const depthTint = Math.max(0.72, 1.04 - depth * 0.015)
        waterKeyArr[idx] = packSurfaceKey(
          sy,
          packRgb6(wr * depthTint, wg * depthTint, wb * depthTint)
        )
      }

      baseRgbArr[idx] = packRgb6(r, g, b)
      const shade = Math.max(0.68, Math.min(1.16, 1 + slope))
      terrainKeyArr[idx] = packSurfaceKey(groundY, packRgb6(r * shade, g * shade, b * shade))
    }
  }

  // Greedy-merge within each 8x8 Minecraft chunk sub-grid so every quad stays strictly inside
  // one 32x32 hires-mask texel (exact chunk-center UV prevents boundary bleed or Z-fighting).
  const chunksPerSide = grid >= 32 && grid % 32 === 0 ? 32 : 1
  const chunkCells = grid / chunksPerSide
  const visited = new Uint8Array(chunkCells * chunkCells)

  for (let lcz = 0; lcz < chunksPerSide; lcz++) {
    const gzBase = lcz * chunkCells
    const vc = (lcz + 0.5) / chunksPerSide

    for (let lcx = 0; lcx < chunksPerSide; lcx++) {
      const gxBase = lcx * chunkCells
      const uc = (lcx + 0.5) / chunksPerSide

      // 1. Greedy 2D terrain top quads inside chunk (lcx, lcz)
      visited.fill(0)
      for (let lz = 0; lz < chunkCells; lz++) {
        const gz = gzBase + lz
        const rowOff = gz * grid + gxBase
        const vRow = lz * chunkCells
        for (let lx = 0; lx < chunkCells; lx++) {
          if (visited[vRow + lx]) continue
          const key = terrainKeyArr[rowOff + lx]
          if (key < 0) continue

          let w = 1
          while (
            lx + w < chunkCells &&
            !visited[vRow + lx + w] &&
            terrainKeyArr[rowOff + lx + w] === key
          ) {
            w++
          }

          let h = 1
          outerTerrain: while (lz + h < chunkCells) {
            const nextRow = (gz + h) * grid + gxBase + lx
            const nextVRow = (lz + h) * chunkCells + lx
            for (let dx = 0; dx < w; dx++) {
              if (visited[nextVRow + dx] || terrainKeyArr[nextRow + dx] !== key) break outerTerrain
            }
            h++
          }

          for (let dz = 0; dz < h; dz++) {
            const vr = (lz + dz) * chunkCells + lx
            for (let dx = 0; dx < w; dx++) visited[vr + dx] = 1
          }

          const topY = groundYArr[rowOff + lx] + 1
          const wx0 = ox + (gxBase + lx) * step
          const wx1 = wx0 + w * step
          const wz0 = oz + gz * step
          const wz1 = wz0 + h * step
          const r = ((key >>> 12) & 63) * INV_63
          const g = ((key >>> 6) & 63) * INV_63
          const b = (key & 63) * INV_63
          terrainBuf.pushQuad(
            wx0,
            topY,
            wz0,
            wx0,
            topY,
            wz1,
            wx1,
            topY,
            wz1,
            wx1,
            topY,
            wz0,
            0,
            1,
            0,
            uc,
            vc,
            uc,
            vc,
            r,
            g,
            b
          )
        }
      }

      // 2. Greedy 2D water surface quads inside chunk (lcx, lcz)
      visited.fill(0)
      for (let lz = 0; lz < chunkCells; lz++) {
        const gz = gzBase + lz
        const rowOff = gz * grid + gxBase
        const vRow = lz * chunkCells
        for (let lx = 0; lx < chunkCells; lx++) {
          if (visited[vRow + lx]) continue
          const key = waterKeyArr[rowOff + lx]
          if (key < 0) continue

          let w = 1
          while (
            lx + w < chunkCells &&
            !visited[vRow + lx + w] &&
            waterKeyArr[rowOff + lx + w] === key
          ) {
            w++
          }

          let h = 1
          outerWater: while (lz + h < chunkCells) {
            const nextRow = (gz + h) * grid + gxBase + lx
            const nextVRow = (lz + h) * chunkCells + lx
            for (let dx = 0; dx < w; dx++) {
              if (visited[nextVRow + dx] || waterKeyArr[nextRow + dx] !== key) break outerWater
            }
            h++
          }

          for (let dz = 0; dz < h; dz++) {
            const vr = (lz + dz) * chunkCells + lx
            for (let dx = 0; dx < w; dx++) visited[vr + dx] = 1
          }

          const wy = surfaceY[rowOff + lx] + 0.85
          const wx0 = ox + (gxBase + lx) * step
          const wx1 = wx0 + w * step
          const wz0 = oz + gz * step
          const wz1 = wz0 + h * step
          const r = ((key >>> 12) & 63) * INV_63
          const g = ((key >>> 6) & 63) * INV_63
          const b = (key & 63) * INV_63
          waterBuf.pushQuad(
            wx0,
            wy,
            wz0,
            wx0,
            wy,
            wz1,
            wx1,
            wy,
            wz1,
            wx1,
            wy,
            wz0,
            0,
            1,
            0,
            uc,
            vc,
            uc,
            vc,
            r,
            g,
            b
          )
        }
      }

      // 3. Cliff skirts with 1D run-length merging along each face direction
      // +Z (south) and -Z (north) skirts merge horizontally along X
      for (let lz = 0; lz < chunkCells; lz++) {
        const gz = gzBase + lz
        const wz0 = oz + gz * step
        const wz1 = wz0 + step
        const rowOff = gz * grid + gxBase

        // +Z (south)
        for (let lx = 0; lx < chunkCells;) {
          const idx = rowOff + lx
          const gY = groundYArr[idx]
          if (gY === NO_HEIGHT) {
            lx++
            continue
          }
          const nS = gz + 1 < grid ? groundYArr[idx + grid] : NO_HEIGHT
          const yS = nS === NO_HEIGHT ? gY - 4 : nS
          if (yS >= gY) {
            lx++
            continue
          }
          const bot = Math.max(yS + 1, gY - 24)
          const rgb = baseRgbArr[idx]
          let w = 1
          while (lx + w < chunkCells) {
            const nIdx = rowOff + lx + w
            if (groundYArr[nIdx] !== gY || baseRgbArr[nIdx] !== rgb) break
            const nnS = gz + 1 < grid ? groundYArr[nIdx + grid] : NO_HEIGHT
            const nyS = nnS === NO_HEIGHT ? gY - 4 : nnS
            if (nyS >= gY || Math.max(nyS + 1, gY - 24) !== bot) break
            w++
          }
          const wx0 = ox + (gxBase + lx) * step
          const wx1 = wx0 + w * step
          const topY = gY + 1
          const r = Math.min(1, ((rgb >>> 12) & 63) * INV_63 * 0.84)
          const g = Math.min(1, ((rgb >>> 6) & 63) * INV_63 * 0.84)
          const b = Math.min(1, (rgb & 63) * INV_63 * 0.84)
          terrainBuf.pushQuad(
            wx1,
            topY,
            wz1,
            wx0,
            topY,
            wz1,
            wx0,
            bot,
            wz1,
            wx1,
            bot,
            wz1,
            0,
            0,
            1,
            uc,
            vc,
            uc,
            vc,
            r,
            g,
            b
          )
          lx += w
        }

        // -Z (north)
        for (let lx = 0; lx < chunkCells;) {
          const idx = rowOff + lx
          const gY = groundYArr[idx]
          if (gY === NO_HEIGHT) {
            lx++
            continue
          }
          const nN = gz > 0 ? groundYArr[idx - grid] : NO_HEIGHT
          const yN = nN === NO_HEIGHT ? gY - 4 : nN
          if (yN >= gY) {
            lx++
            continue
          }
          const bot = Math.max(yN + 1, gY - 24)
          const rgb = baseRgbArr[idx]
          let w = 1
          while (lx + w < chunkCells) {
            const nIdx = rowOff + lx + w
            if (groundYArr[nIdx] !== gY || baseRgbArr[nIdx] !== rgb) break
            const nnN = gz > 0 ? groundYArr[nIdx - grid] : NO_HEIGHT
            const nyN = nnN === NO_HEIGHT ? gY - 4 : nnN
            if (nyN >= gY || Math.max(nyN + 1, gY - 24) !== bot) break
            w++
          }
          const wx0 = ox + (gxBase + lx) * step
          const wx1 = wx0 + w * step
          const topY = gY + 1
          const r = Math.min(1, ((rgb >>> 12) & 63) * INV_63 * 0.76)
          const g = Math.min(1, ((rgb >>> 6) & 63) * INV_63 * 0.76)
          const b = Math.min(1, (rgb & 63) * INV_63 * 0.76)
          terrainBuf.pushQuad(
            wx0,
            topY,
            wz0,
            wx1,
            topY,
            wz0,
            wx1,
            bot,
            wz0,
            wx0,
            bot,
            wz0,
            0,
            0,
            -1,
            uc,
            vc,
            uc,
            vc,
            r,
            g,
            b
          )
          lx += w
        }
      }

      // +X (east) and -X (west) skirts merge along Z
      for (let lx = 0; lx < chunkCells; lx++) {
        const gx = gxBase + lx
        const wx0 = ox + gx * step
        const wx1 = wx0 + step

        // +X (east)
        for (let lz = 0; lz < chunkCells;) {
          const gz = gzBase + lz
          const idx = gz * grid + gx
          const gY = groundYArr[idx]
          if (gY === NO_HEIGHT) {
            lz++
            continue
          }
          const nE = gx + 1 < grid ? groundYArr[idx + 1] : NO_HEIGHT
          const yE = nE === NO_HEIGHT ? gY - 4 : nE
          if (yE >= gY) {
            lz++
            continue
          }
          const bot = Math.max(yE + 1, gY - 24)
          const rgb = baseRgbArr[idx]
          let h = 1
          while (lz + h < chunkCells) {
            const nIdx = (gz + h) * grid + gx
            if (groundYArr[nIdx] !== gY || baseRgbArr[nIdx] !== rgb) break
            const nnE = gx + 1 < grid ? groundYArr[nIdx + 1] : NO_HEIGHT
            const nyE = nnE === NO_HEIGHT ? gY - 4 : nnE
            if (nyE >= gY || Math.max(nyE + 1, gY - 24) !== bot) break
            h++
          }
          const wz0 = oz + gz * step
          const wz1 = wz0 + h * step
          const topY = gY + 1
          const r = Math.min(1, ((rgb >>> 12) & 63) * INV_63 * 0.74)
          const g = Math.min(1, ((rgb >>> 6) & 63) * INV_63 * 0.74)
          const b = Math.min(1, (rgb & 63) * INV_63 * 0.74)
          terrainBuf.pushQuad(
            wx1,
            topY,
            wz0,
            wx1,
            topY,
            wz1,
            wx1,
            bot,
            wz1,
            wx1,
            bot,
            wz0,
            1,
            0,
            0,
            uc,
            vc,
            uc,
            vc,
            r,
            g,
            b
          )
          lz += h
        }

        // -X (west)
        for (let lz = 0; lz < chunkCells;) {
          const gz = gzBase + lz
          const idx = gz * grid + gx
          const gY = groundYArr[idx]
          if (gY === NO_HEIGHT) {
            lz++
            continue
          }
          const nW = gx > 0 ? groundYArr[idx - 1] : NO_HEIGHT
          const yW = nW === NO_HEIGHT ? gY - 4 : nW
          if (yW >= gY) {
            lz++
            continue
          }
          const bot = Math.max(yW + 1, gY - 24)
          const rgb = baseRgbArr[idx]
          let h = 1
          while (lz + h < chunkCells) {
            const nIdx = (gz + h) * grid + gx
            if (groundYArr[nIdx] !== gY || baseRgbArr[nIdx] !== rgb) break
            const nnW = gx > 0 ? groundYArr[nIdx - 1] : NO_HEIGHT
            const nyW = nnW === NO_HEIGHT ? gY - 4 : nnW
            if (nyW >= gY || Math.max(nyW + 1, gY - 24) !== bot) break
            h++
          }
          const wz0 = oz + gz * step
          const wz1 = wz0 + h * step
          const topY = gY + 1
          const r = Math.min(1, ((rgb >>> 12) & 63) * INV_63 * 0.8)
          const g = Math.min(1, ((rgb >>> 6) & 63) * INV_63 * 0.8)
          const b = Math.min(1, (rgb & 63) * INV_63 * 0.8)
          terrainBuf.pushQuad(
            wx0,
            topY,
            wz1,
            wx0,
            topY,
            wz0,
            wx0,
            bot,
            wz0,
            wx0,
            bot,
            wz1,
            -1,
            0,
            0,
            uc,
            vc,
            uc,
            vc,
            r,
            g,
            b
          )
          lz += h
        }
      }
    }
  }

  return {
    type: 'lowres',
    id,
    rx,
    rz,
    lod: effectiveLod,
    terrain: terrainBuf.finish(),
    water: waterBuf.finish(),
    surfaceY: factor === 1 ? new Int16Array(surfaceY) : surfaceY,
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
  leaves: boolean
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

function aoFactor(side1: number, side2: number, corner: number): number {
  if (side1 && side2) return AO_CURVE[3]
  return AO_CURVE[side1 + side2 + corner]
}

/** Build full 3D face-culled, AO-shaded, textured voxel geometry for a 16x16 hires chunk. */
export function meshHires(
  id: number,
  buffer: ArrayBuffer,
  atlasOverride?: BlockAtlasMap | null
): HiresMeshResult {
  const chunk = decodeHiresChunk(buffer)
  const { cx, cz, minY, height, palette, surfaceY, blocks } = chunk
  const activeAtlas = atlasOverride !== undefined ? atlasOverride : atlas
  const bufs: [QuadBuf, QuadBuf, QuadBuf, QuadBuf, QuadBuf] = [
    new QuadBuf(2048, false),
    new QuadBuf(512, false),
    new QuadBuf(128, false),
    new QuadBuf(512, false),
    new QuadBuf(128, false)
  ]

  const meta: PaletteMeta[] = palette.map((raw, i) => {
    if (i === 0) {
      return {
        short: 'air',
        air: true,
        opaque: false,
        water: false,
        leaves: false,
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
    const uv = isWater ? (activeAtlas?.[short] ?? activeAtlas?.['water']) : activeAtlas?.[short]
    const fallbackRgb = colors[short] ?? [0.58, 0.59, 0.61]

    const baseBucket = isWater
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

    // When a texture atlas is active, route blocks without a sprite to the untextured solid-color
    // bucket instead of sampling the missing-texture tile at UV (0, 0).
    const bucket = activeAtlas && !uv ? UNTEXTURED : baseBucket
    const opaque = baseBucket === OPAQUE && !isCross && !isThin && !isSlab
    const selfCull = isWater || isIce || isGlass
    const blockH = isThin ? 0.14 : isSlab ? 0.5 : 1

    const topColor: Rgb = uv ? (uv.tintTop ?? [1, 1, 1]) : fallbackRgb
    const sideColor: Rgb = uv
      ? (uv.tintSide ?? [1, 1, 1])
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
      leaves: isLeaves,
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

  // Flat opacity lookup grid for fast 6-neighbor early-out and O(1) AO sampling
  const metaOpaque = new Uint8Array(meta.length)
  for (let i = 0; i < meta.length; i++) metaOpaque[i] = meta[i].opaque ? 1 : 0
  const opaqueGrid = new Uint8Array(blocks.length)
  for (let i = 0; i < blocks.length; i++) opaqueGrid[i] = metaOpaque[blocks[i]]

  const ox = cx * 16
  const oz = cz * 16

  const at = (lx: number, ly: number, lz: number): PaletteMeta => {
    if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || ly < 0 || ly >= height) return meta[0]
    return meta[blocks[(ly << 8) | (lz << 4) | lx]]
  }
  const occ = (lx: number, ly: number, lz: number): number => {
    if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || ly < 0 || ly >= height) return 0
    return opaqueGrid[(ly << 8) | (lz << 4) | lx]
  }

  const hiddenBy = (cur: PaletteMeta, neighbor: PaletteMeta): boolean => {
    if (neighbor.opaque) return true
    if (cur.selfCull && neighbor.short === cur.short) return true
    if (cur.water && neighbor.water) return true
    // Fast leaves (as in Minecraft's "Fast" graphics): faces between any two leaf blocks are never seen from outside
    if (cur.leaves && neighbor.leaves) return true
    return false
  }

  const maxLy = height - 1
  for (let ly = 0; ly < height; ly++) {
    const wy = minY + ly
    const yOff = ly << 8
    const innerY = ly > 0 && ly < maxLy
    for (let lz = 0; lz < 16; lz++) {
      const wz = oz + lz
      const zOff = yOff | (lz << 4)
      const innerYZ = innerY && lz > 0 && lz < 15
      for (let lx = 0; lx < 16; lx++) {
        const idx = zOff | lx
        const pid = blocks[idx]
        if (pid === 0) continue

        // Skip completely enclosed interior full-cube blocks in one fast typed-array check
        if (
          innerYZ &&
          lx > 0 &&
          lx < 15 &&
          opaqueGrid[idx] &&
          opaqueGrid[idx + 256] &&
          opaqueGrid[idx - 256] &&
          opaqueGrid[idx + 16] &&
          opaqueGrid[idx - 16] &&
          opaqueGrid[idx + 1] &&
          opaqueGrid[idx - 1]
        ) {
          continue
        }

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
          const xA = wx + pad
          const xB = wx + 1 - pad
          const zA = wz + pad
          const zB = wz + 1 - pad
          dst.pushQuad(
            xA,
            y1,
            zA,
            xB,
            y1,
            zB,
            xB,
            wy,
            zB,
            xA,
            wy,
            zA,
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
            xB,
            y1,
            zB,
            xA,
            y1,
            zA,
            xA,
            wy,
            zA,
            xB,
            wy,
            zB,
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
            xA,
            y1,
            zB,
            xB,
            y1,
            zA,
            xB,
            wy,
            zA,
            xA,
            wy,
            zB,
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
            xB,
            y1,
            zA,
            xA,
            y1,
            zB,
            xA,
            wy,
            zB,
            xB,
            wy,
            zA,
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

        const nUp = ly < maxLy ? meta[blocks[idx + 256]] : meta[0]
        const topY = m.water && !nUp.water ? wy + 0.875 : wy + m.height

        // +Y (top)
        if (!hiddenBy(m, nUp) || m.height < 1) {
          const [u0, v0, u1, v1] = m.topUv
          const [r, g, b] = m.topColor
          const ay = ly + 1
          const a0 = aoFactor(occ(lx - 1, ay, lz), occ(lx, ay, lz - 1), occ(lx - 1, ay, lz - 1))
          const a1 = aoFactor(occ(lx - 1, ay, lz), occ(lx, ay, lz + 1), occ(lx - 1, ay, lz + 1))
          const a2 = aoFactor(occ(lx + 1, ay, lz), occ(lx, ay, lz + 1), occ(lx + 1, ay, lz + 1))
          const a3 = aoFactor(occ(lx + 1, ay, lz), occ(lx, ay, lz - 1), occ(lx + 1, ay, lz - 1))
          dst.pushQuad(
            wx,
            topY,
            wz,
            wx,
            topY,
            wz + 1,
            wx + 1,
            topY,
            wz + 1,
            wx + 1,
            topY,
            wz,
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
        if (ly > 0 && !hiddenBy(m, meta[blocks[idx - 256]])) {
          const [u0, v0, u1, v1] = m.bottomUv
          const [r, g, b] = m.bottomColor
          dst.pushQuad(
            wx,
            wy,
            wz + 1,
            wx,
            wy,
            wz,
            wx + 1,
            wy,
            wz,
            wx + 1,
            wy,
            wz + 1,
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
        if (!(m.water && lz === 15) && !hiddenBy(m, at(lx, ly, lz + 1))) {
          const [u0, v0, u1, v1] = m.sideUv
          const [r, g, b] = m.sideColor
          const az = lz + 1
          const a0 = aoFactor(occ(lx + 1, ly, az), occ(lx, ly + 1, az), occ(lx + 1, ly + 1, az))
          const a1 = aoFactor(occ(lx - 1, ly, az), occ(lx, ly + 1, az), occ(lx - 1, ly + 1, az))
          const a2 = aoFactor(occ(lx - 1, ly, az), occ(lx, ly - 1, az), occ(lx - 1, ly - 1, az))
          const a3 = aoFactor(occ(lx + 1, ly, az), occ(lx, ly - 1, az), occ(lx + 1, ly - 1, az))
          dst.pushQuad(
            wx + 1,
            topY,
            wz + 1,
            wx,
            topY,
            wz + 1,
            wx,
            wy,
            wz + 1,
            wx + 1,
            wy,
            wz + 1,
            0,
            0,
            1,
            u1,
            v0,
            u0,
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
        if (!(m.water && lz === 0) && !hiddenBy(m, at(lx, ly, lz - 1))) {
          const [u0, v0, u1, v1] = m.sideUv
          const [r, g, b] = m.sideColor
          const az = lz - 1
          const a0 = aoFactor(occ(lx - 1, ly, az), occ(lx, ly + 1, az), occ(lx - 1, ly + 1, az))
          const a1 = aoFactor(occ(lx + 1, ly, az), occ(lx, ly + 1, az), occ(lx + 1, ly + 1, az))
          const a2 = aoFactor(occ(lx + 1, ly, az), occ(lx, ly - 1, az), occ(lx + 1, ly - 1, az))
          const a3 = aoFactor(occ(lx - 1, ly, az), occ(lx, ly - 1, az), occ(lx - 1, ly - 1, az))
          dst.pushQuad(
            wx,
            topY,
            wz,
            wx + 1,
            topY,
            wz,
            wx + 1,
            wy,
            wz,
            wx,
            wy,
            wz,
            0,
            0,
            -1,
            u1,
            v0,
            u0,
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
        if (!(m.water && lx === 15) && !hiddenBy(m, at(lx + 1, ly, lz))) {
          const [u0, v0, u1, v1] = m.sideUv
          const [r, g, b] = m.sideColor
          const ax = lx + 1
          const a0 = aoFactor(occ(ax, ly, lz - 1), occ(ax, ly + 1, lz), occ(ax, ly + 1, lz - 1))
          const a1 = aoFactor(occ(ax, ly, lz + 1), occ(ax, ly + 1, lz), occ(ax, ly + 1, lz + 1))
          const a2 = aoFactor(occ(ax, ly, lz + 1), occ(ax, ly - 1, lz), occ(ax, ly - 1, lz + 1))
          const a3 = aoFactor(occ(ax, ly, lz - 1), occ(ax, ly - 1, lz), occ(ax, ly - 1, lz - 1))
          dst.pushQuad(
            wx + 1,
            topY,
            wz,
            wx + 1,
            topY,
            wz + 1,
            wx + 1,
            wy,
            wz + 1,
            wx + 1,
            wy,
            wz,
            1,
            0,
            0,
            u1,
            v0,
            u0,
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
        if (!(m.water && lx === 0) && !hiddenBy(m, at(lx - 1, ly, lz))) {
          const [u0, v0, u1, v1] = m.sideUv
          const [r, g, b] = m.sideColor
          const ax = lx - 1
          const a0 = aoFactor(occ(ax, ly, lz + 1), occ(ax, ly + 1, lz), occ(ax, ly + 1, lz + 1))
          const a1 = aoFactor(occ(ax, ly, lz - 1), occ(ax, ly + 1, lz), occ(ax, ly + 1, lz - 1))
          const a2 = aoFactor(occ(ax, ly, lz - 1), occ(ax, ly - 1, lz), occ(ax, ly - 1, lz - 1))
          const a3 = aoFactor(occ(ax, ly, lz + 1), occ(ax, ly - 1, lz), occ(ax, ly - 1, lz + 1))
          dst.pushQuad(
            wx,
            topY,
            wz + 1,
            wx,
            topY,
            wz,
            wx,
            wy,
            wz,
            wx,
            wy,
            wz + 1,
            -1,
            0,
            0,
            u1,
            v0,
            u0,
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
    buckets: [
      bufs[0].finish(),
      bufs[1].finish(),
      bufs[2].finish(),
      bufs[3].finish(),
      bufs[4].finish()
    ],
    surfaceY: new Int16Array(surfaceY)
  }
}

function pushBucketTransfers(transfers: Transferable[], b: MeshBucketBuffer): void {
  transfers.push(b.positions.buffer, b.normals.buffer, b.uvs.buffer, b.colors.buffer)
}

if (typeof self !== 'undefined') {
  const workerScope = self as unknown as {
    onmessage: ((e: MessageEvent<WorkerIn>) => void) | null
    postMessage(message: unknown, transfer?: Transferable[]): void
  }

  workerScope.onmessage = (e: MessageEvent<WorkerIn>) => {
    const msg = e.data
    if (msg.type === 'init') {
      colors = { ...FALLBACK_COLORS, ...msg.colors }
      atlas = msg.atlas
      return
    }
    try {
      if (msg.type === 'lowres') {
        const res = meshLowres(msg.id, msg.buffer, msg.lod ?? 0)
        const transfers: Transferable[] = [res.surfaceY.buffer]
        pushBucketTransfers(transfers, res.terrain)
        pushBucketTransfers(transfers, res.water)
        workerScope.postMessage(res, transfers)
        return
      }
      if (msg.type === 'hires') {
        const res = meshHires(msg.id, msg.buffer)
        const transfers: Transferable[] = [res.surfaceY.buffer]
        for (const b of res.buckets) {
          pushBucketTransfers(transfers, b)
        }
        workerScope.postMessage(res, transfers)
      }
    } catch (err) {
      const errorMsg: WorkerErrorResult = {
        type: 'error',
        id: msg.id,
        message: err instanceof Error ? err.message : String(err)
      }
      workerScope.postMessage(errorMsg)
    }
  }
}
