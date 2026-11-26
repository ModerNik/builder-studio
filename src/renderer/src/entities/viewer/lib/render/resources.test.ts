import { describe, expect, it } from 'vitest'
import { ATLAS_CELL, ATLAS_MAX_MIP_LEVEL, buildAtlasMipmaps } from './resources'

describe('buildAtlasMipmaps', () => {
  it('caps mip levels so adjacent 16x16 sprites never bleed into each other', () => {
    const W = 64
    const H = 64
    const base = new Uint8Array(W * H * 4)
    // Fill tile (0, 0) with bright red and adjacent tile (16, 0) with neutral gray
    for (let y = 0; y < ATLAS_CELL; y++) {
      for (let x = 0; x < ATLAS_CELL; x++) {
        const red = (y * W + x) * 4
        base[red] = 255
        base[red + 1] = 0
        base[red + 2] = 0
        base[red + 3] = 255

        const gray = (y * W + (x + ATLAS_CELL)) * 4
        base[gray] = 128
        base[gray + 1] = 128
        base[gray + 2] = 128
        base[gray + 3] = 255
      }
    }

    const mips = buildAtlasMipmaps(base, W, H)
    expect(mips).toHaveLength(ATLAS_MAX_MIP_LEVEL + 1)

    const deepest = mips[ATLAS_MAX_MIP_LEVEL]
    expect(deepest.width).toBe(W / ATLAS_CELL)
    expect(deepest.height).toBe(H / ATLAS_CELL)

    // Tile (0, 0) stays pure red; tile (1, 0) stays pure neutral gray with zero red tint
    expect([...deepest.data.slice(0, 4)]).toEqual([255, 0, 0, 255])
    expect([...deepest.data.slice(4, 8)]).toEqual([128, 128, 128, 255])
  })

  it('weights RGB by alpha so transparent cutout pixels do not darken foliage or bars', () => {
    const base = new Uint8Array([
      // 2x2 block: two opaque green texels and two transparent black texels
      80, 200, 60, 255, 0, 0, 0, 0,
      0, 0, 0, 0, 80, 200, 60, 255
    ])
    const mips = buildAtlasMipmaps(base, 2, 2)
    expect(mips).toHaveLength(2)
    expect([...mips[1].data]).toEqual([80, 200, 60, 128])
  })
})
