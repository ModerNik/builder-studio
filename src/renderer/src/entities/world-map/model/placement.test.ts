import { describe, expect, it } from 'vitest'
import {
  boxDimensions,
  boxWithMargin,
  buildBoxFromOrigin,
  centeredBox,
  computeGroundStats,
  formatOriginLine,
  nextRotation,
  normalizeBox,
  originFromArea,
  rotatedFootprint
} from './placement'

describe('world-map placement math', () => {
  it('normalizes boxes, computes dimensions and applies margins', () => {
    expect(normalizeBox([10, 20, -4, 5])).toEqual([-4, 5, 10, 20])
    expect(boxDimensions([-4, 5, 10, 20])).toEqual([15, 16])
    expect(boxWithMargin([-4, 5, 10, 20], 12)).toEqual([-16, -7, 22, 32])
    expect(centeredBox(100, -50, 32, 16)).toEqual([84, -58, 115, -43])
  })

  it('computes rotated build footprints and origin lines', () => {
    expect(rotatedFootprint([20, 12, 30], 0)).toEqual([20, 30])
    expect(rotatedFootprint([20, 12, 30], 90)).toEqual([30, 20])
    expect(rotatedFootprint([20, 12, 30], 180)).toEqual([20, 30])
    expect(rotatedFootprint([20, 12, 30], 270)).toEqual([30, 20])

    expect(buildBoxFromOrigin([10, 65, -20], [20, 12, 30], 90)).toEqual([10, -20, 39, -1])
    expect(originFromArea([10, -20, 30, 0], 64)).toEqual([10, 65, -20])
    expect(formatOriginLine([10, 65, -20])).toBe('ORIGIN = (10, 65, -20)')
    expect(nextRotation(0, -90)).toBe(270)
    expect(nextRotation(270, 90)).toBe(0)
  })

  it('computes ground elevation stats while ignoring void columns', () => {
    const stats = computeGroundStats([0, 0, 3, 3], (x, z) =>
      x === 0 && z === 0 ? null : 60 + x + z
    )
    expect(stats).toEqual({ min: 61, max: 66, median: 63 })
    expect(computeGroundStats([0, 0, 2, 2], () => null)).toBeNull()
  })
})
