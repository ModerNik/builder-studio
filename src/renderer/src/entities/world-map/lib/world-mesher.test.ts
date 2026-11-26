import { describe, expect, it } from 'vitest'
import {
  encodeHiresChunk,
  encodeLowresTile,
  FLAG_GRASS,
  FLAG_WATER,
  LOWRES_CELLS,
  LOWRES_GRID,
  LOWRES_STEP,
  NO_HEIGHT
} from '@shared/world-tiles'
import { meshHires, meshLowres, UNTEXTURED, type MeshBucketBuffer } from './world-mesher.worker'

const STRIDE = 11

function assertOutwardWinding(buf: MeshBucketBuffer, label: string): number {
  const { vertices: v, indices: idx } = buf
  const tris = idx.length / 3
  for (let t = 0; t < tris; t++) {
    const i0 = idx[t * 3] * STRIDE
    const i1 = idx[t * 3 + 1] * STRIDE
    const i2 = idx[t * 3 + 2] * STRIDE

    const e1x = v[i1] - v[i0]
    const e1y = v[i1 + 1] - v[i0 + 1]
    const e1z = v[i1 + 2] - v[i0 + 2]

    const e2x = v[i2] - v[i0]
    const e2y = v[i2 + 1] - v[i0 + 1]
    const e2z = v[i2 + 2] - v[i0 + 2]

    // Geometric normal (e1 x e2) must align with outward vertex normal for CCW FrontSide rendering
    const gx = e1y * e2z - e1z * e2y
    const gy = e1z * e2x - e1x * e2z
    const gz = e1x * e2y - e1y * e2x

    const nx = v[i0 + 3]
    const ny = v[i0 + 4]
    const nz = v[i0 + 5]
    const dot = gx * nx + gy * ny + gz * nz
    expect(
      dot,
      `${label} triangle #${t} inverted winding for normal (${nx},${ny},${nz})`
    ).toBeGreaterThan(0)
  }
  return tris
}

describe('world-mesher winding', () => {
  it('emits CCW outward-facing quads for lowres terrain top, water, and all 4 cliff skirts', () => {
    const surfaceY = new Int16Array(LOWRES_CELLS).fill(NO_HEIGHT)
    const oceanFloorY = new Int16Array(LOWRES_CELLS).fill(NO_HEIGHT)
    const topBlock = new Uint16Array(LOWRES_CELLS)
    const flags = new Uint8Array(LOWRES_CELLS)

    // 3x3 patch with a raised center cell to exercise +X, -X, +Z, -Z skirts and a water cell
    for (let gz = 10; gz <= 12; gz++) {
      for (let gx = 10; gx <= 12; gx++) {
        const i = gz * LOWRES_GRID + gx
        const center = gx === 11 && gz === 11
        surfaceY[i] = center ? 74 : 64
        oceanFloorY[i] = center ? 74 : 64
        topBlock[i] = 1
        flags[i] = FLAG_GRASS
      }
    }
    const wi = 10 * LOWRES_GRID + 10
    surfaceY[wi] = 63
    oceanFloorY[wi] = 58
    flags[wi] = FLAG_WATER

    const encoded = encodeLowresTile({
      rx: 0,
      rz: 0,
      step: LOWRES_STEP,
      grid: LOWRES_GRID,
      palette: ['minecraft:air', 'minecraft:grass_block'],
      surfaceY,
      oceanFloorY,
      topBlock,
      flags
    })

    const res = meshLowres(1, new Uint8Array(encoded).buffer)
    expect(assertOutwardWinding(res.terrain, 'lowres terrain')).toBeGreaterThan(10)
    expect(assertOutwardWinding(res.water, 'lowres water')).toBe(2)
  })

  it('emits CCW outward-facing quads for all 6 faces of hires voxel blocks', () => {
    const height = 4
    const blocks = new Uint16Array(16 * height * 16)
    const surfaceY = new Int16Array(256).fill(NO_HEIGHT)
    // Isolated stone block at (5, ly=1, 5) so all 6 faces (+Y, -Y, +Z, -Z, +X, -X) are exposed
    blocks[(1 << 8) | (5 << 4) | 5] = 1
    surfaceY[5 * 16 + 5] = 65

    const encoded = encodeHiresChunk({
      cx: 0,
      cz: 0,
      minY: 64,
      height,
      palette: ['minecraft:air', 'minecraft:stone'],
      surfaceY,
      blocks
    })

    const res = meshHires(2, new Uint8Array(encoded).buffer)
    // 6 faces * 2 triangles = 12 triangles
    expect(assertOutwardWinding(res.buckets[0], 'hires opaque')).toBe(12)
  })

  it('routes unmapped blocks to the untextured bucket when a texture atlas is active', () => {
    const height = 4
    const blocks = new Uint16Array(16 * height * 16)
    const surfaceY = new Int16Array(256).fill(NO_HEIGHT)
    blocks[(1 << 8) | (4 << 4) | 4] = 1 // mapped stone
    blocks[(1 << 8) | (6 << 4) | 6] = 2 // unmapped custom block
    surfaceY[4 * 16 + 4] = 65
    surfaceY[6 * 16 + 6] = 65

    const encoded = encodeHiresChunk({
      cx: 0,
      cz: 0,
      minY: 64,
      height,
      palette: ['minecraft:air', 'minecraft:stone', 'minecraft:unmapped_block'],
      surfaceY,
      blocks
    })

    const atlas = {
      stone: {
        top: [0.1, 0.1, 0.2, 0.2] as [number, number, number, number],
        side: [0.1, 0.1, 0.2, 0.2] as [number, number, number, number],
        bottom: [0.1, 0.1, 0.2, 0.2] as [number, number, number, number],
        bucket: 0
      }
    }
    const res = meshHires(3, new Uint8Array(encoded).buffer, atlas)
    expect(assertOutwardWinding(res.buckets[0], 'mapped stone')).toBe(12)
    expect(assertOutwardWinding(res.buckets[UNTEXTURED], 'unmapped fallback')).toBe(12)
  })

  it('omits water side faces on chunk boundaries to avoid chunk-seam aquarium walls', () => {
    const height = 2
    const blocks = new Uint16Array(16 * height * 16)
    const surfaceY = new Int16Array(256).fill(NO_HEIGHT)
    // Fill an entire 16x16 sheet of water at ly=1
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        blocks[(1 << 8) | (z << 4) | x] = 1
        surfaceY[z * 16 + x] = 63
      }
    }
    const encoded = encodeHiresChunk({
      cx: 0,
      cz: 0,
      minY: 62,
      height,
      palette: ['minecraft:air', 'minecraft:water'],
      surfaceY,
      blocks
    })
    const res = meshHires(4, new Uint8Array(encoded).buffer)
    // Only top (+Y) and bottom (-Y) faces for 256 water blocks -> 256 * 2 faces * 2 tris = 1024 tris,
    // with zero vertical chunk-border walls on lx=0/15 or lz=0/15.
    expect(assertOutwardWinding(res.buckets[3], 'hires water')).toBe(1024)
  })
})
