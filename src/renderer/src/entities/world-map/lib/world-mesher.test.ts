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
import {
  buildQuadIndices,
  meshHires,
  meshLowres,
  UNTEXTURED,
  type MeshBucketBuffer
} from './world-mesher.worker'

function assertOutwardWinding(buf: MeshBucketBuffer, label: string): number {
  const pos = buf.positions
  const norm = buf.normals
  const vertCount = buf.quadCount * 4
  const idx = buildQuadIndices(buf.quadCount)
  expect(pos.length).toBe(vertCount * 3)
  expect(norm.length).toBe(vertCount * 4)
  expect(buf.uvs.length).toBe(vertCount * 2)
  expect(buf.colors.length).toBe(vertCount * 4)
  for (let i = 0; i < vertCount; i++) expect(buf.colors[i * 4 + 3]).toBe(255)

  if (buf.quadCount > 0) {
    expect(buf.bounds).not.toBeNull()
    const [minX, minY, minZ, maxX, maxY, maxZ] = buf.bounds!
    for (let i = 0; i < vertCount; i++) {
      const x = pos[i * 3]
      const y = pos[i * 3 + 1]
      const z = pos[i * 3 + 2]
      expect(x).toBeGreaterThanOrEqual(minX)
      expect(x).toBeLessThanOrEqual(maxX)
      expect(y).toBeGreaterThanOrEqual(minY)
      expect(y).toBeLessThanOrEqual(maxY)
      expect(z).toBeGreaterThanOrEqual(minZ)
      expect(z).toBeLessThanOrEqual(maxZ)
    }
  }

  const tris = idx.length / 3
  for (let t = 0; t < tris; t++) {
    const i0 = idx[t * 3] * 3
    const i1 = idx[t * 3 + 1] * 3
    const i2 = idx[t * 3 + 2] * 3

    const e1x = pos[i1] - pos[i0]
    const e1y = pos[i1 + 1] - pos[i0 + 1]
    const e1z = pos[i1 + 2] - pos[i0 + 2]

    const e2x = pos[i2] - pos[i0]
    const e2y = pos[i2 + 1] - pos[i0 + 1]
    const e2z = pos[i2 + 2] - pos[i0 + 2]

    // Geometric normal (e1 x e2) must align with outward packed vertex normal for CCW FrontSide rendering
    const gx = e1y * e2z - e1z * e2y
    const gy = e1z * e2x - e1x * e2z
    const gz = e1x * e2y - e1y * e2x

    const n0 = idx[t * 3] * 4
    const nx = norm[n0] / 127
    const ny = norm[n0 + 1] / 127
    const nz = norm[n0 + 2] / 127
    const dot = gx * nx + gy * ny + gz * nz
    expect(
      dot,
      `${label} triangle #${t} inverted winding for normal (${nx},${ny},${nz})`
    ).toBeGreaterThan(0)
  }
  return tris
}

describe('world-mesher winding and greedy optimization', () => {
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

  it('greedily merges flat 8x8 lowres chunk surfaces and water into single quads with valid winding', () => {
    const surfaceY = new Int16Array(LOWRES_CELLS).fill(NO_HEIGHT)
    const oceanFloorY = new Int16Array(LOWRES_CELLS).fill(NO_HEIGHT)
    const topBlock = new Uint16Array(LOWRES_CELLS)
    const flags = new Uint8Array(LOWRES_CELLS)

    // Fill one complete 8x8 lowres chunk (gx=0..7, gz=0..7) with uniform water over flat sand
    for (let gz = 0; gz < 8; gz++) {
      for (let gx = 0; gx < 8; gx++) {
        const i = gz * LOWRES_GRID + gx
        surfaceY[i] = 63
        oceanFloorY[i] = 58
        topBlock[i] = 1
        flags[i] = FLAG_WATER
      }
    }

    const encoded = encodeLowresTile({
      rx: 0,
      rz: 0,
      step: LOWRES_STEP,
      grid: LOWRES_GRID,
      palette: ['minecraft:air', 'minecraft:sand'],
      surfaceY,
      oceanFloorY,
      topBlock,
      flags
    })

    const res = meshLowres(10, new Uint8Array(encoded).buffer)
    // 64 water cells collapse into 1 water quad (2 tris), and 64 flat floor cells + 4 merged skirts -> 5 terrain quads (10 tris)
    expect(res.water.quadCount).toBe(1)
    expect(res.terrain.quadCount).toBe(5)
    expect(assertOutwardWinding(res.water, 'greedy water')).toBe(2)
    expect(assertOutwardWinding(res.terrain, 'greedy terrain + skirts')).toBe(10)
  })

  it('emits CCW outward-facing quads for all 6 faces of hires voxel blocks and skips enclosed interior blocks', () => {
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

    // Solid 3x3x3 cube at x=2..4, y=1..3, z=2..4: center block (3,2,3) is fully enclosed -> 6 * 9 = 54 faces = 108 tris
    const cubeBlocks = new Uint16Array(16 * 5 * 16)
    for (let y = 1; y <= 3; y++) {
      for (let z = 2; z <= 4; z++) {
        for (let x = 2; x <= 4; x++) {
          cubeBlocks[(y << 8) | (z << 4) | x] = 1
        }
      }
    }
    const cubeEnc = encodeHiresChunk({
      cx: 0,
      cz: 0,
      minY: 64,
      height: 5,
      palette: ['minecraft:air', 'minecraft:stone'],
      surfaceY,
      blocks: cubeBlocks
    })
    const cubeRes = meshHires(20, new Uint8Array(cubeEnc).buffer)
    expect(assertOutwardWinding(cubeRes.buckets[0], 'hires 3x3x3 cube')).toBe(108)
  })

  it('culls faces between neighbouring leaf blocks of any kind (fast leaves)', () => {
    // 3x3x3 leaves mixing two leaf types: only the 54 outer faces remain, inner shared faces are culled
    const blocks = new Uint16Array(16 * 5 * 16)
    for (let y = 1; y <= 3; y++) {
      for (let z = 2; z <= 4; z++) {
        for (let x = 2; x <= 4; x++) {
          blocks[(y << 8) | (z << 4) | x] = (x + y + z) % 2 ? 1 : 2
        }
      }
    }
    const enc = encodeHiresChunk({
      cx: 0,
      cz: 0,
      minY: 64,
      height: 5,
      palette: ['minecraft:air', 'minecraft:oak_leaves', 'minecraft:birch_leaves'],
      surfaceY: new Int16Array(256).fill(NO_HEIGHT),
      blocks
    })
    const res = meshHires(21, new Uint8Array(enc).buffer)
    const quads = res.buckets.reduce((sum, b) => sum + b.quadCount, 0)
    expect(quads).toBe(54)
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

  it('downsamples lowres tiles cleanly into Voxy-style step 2/4/8 LODs with packed byte UVs', () => {
    const surfaceY = new Int16Array(LOWRES_CELLS).fill(NO_HEIGHT)
    const oceanFloorY = new Int16Array(LOWRES_CELLS).fill(NO_HEIGHT)
    const topBlock = new Uint16Array(LOWRES_CELLS)
    const flags = new Uint8Array(LOWRES_CELLS)

    // Varying wavy terrain across a 32x32 cell patch so coarser LODs collapse geometry aggressively
    for (let gz = 0; gz < 32; gz++) {
      for (let gx = 0; gx < 32; gx++) {
        const i = gz * LOWRES_GRID + gx
        const y = 64 + ((gx + gz) % 4) + (gx & 1)
        surfaceY[i] = y
        oceanFloorY[i] = y
        topBlock[i] = 1
        flags[i] = FLAG_GRASS
      }
    }

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
    const makeBuf = (): ArrayBuffer => new Uint8Array(encoded).buffer

    const lod0 = meshLowres(100, makeBuf(), 0)
    const lod1 = meshLowres(101, makeBuf(), 1)
    const lod2 = meshLowres(102, makeBuf(), 2)

    expect(lod0.lod).toBe(0)
    expect(lod0.grid).toBe(256)
    expect(lod0.step).toBe(2)
    expect(lod0.terrain.uvs).toBeInstanceOf(Uint8Array)

    expect(lod1.lod).toBe(1)
    expect(lod1.grid).toBe(128)
    expect(lod1.step).toBe(4)

    expect(lod2.lod).toBe(2)
    expect(lod2.grid).toBe(64)
    expect(lod2.step).toBe(8)

    expect(assertOutwardWinding(lod0.terrain, 'lod0')).toBeGreaterThan(0)
    expect(assertOutwardWinding(lod1.terrain, 'lod1')).toBeGreaterThan(0)
    expect(assertOutwardWinding(lod2.terrain, 'lod2')).toBeGreaterThan(0)
    expect(lod1.terrain.quadCount).toBeLessThan(lod0.terrain.quadCount)
    expect(lod2.terrain.quadCount).toBeLessThan(lod1.terrain.quadCount)
  })
})
