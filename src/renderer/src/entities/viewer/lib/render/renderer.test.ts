import { describe, expect, it } from 'vitest'
import { computeClipPlanes } from './renderer'

describe('computeClipPlanes', () => {
  it('keeps depth precision tight and never clips builds of any size when zoomed out', () => {
    for (const [radius, dist] of [
      [10, 40],
      [150, 500],
      [400, 1500],
      [2000, 8000]
    ]) {
      const { near, far } = computeClipPlanes('perspective', dist, dist, radius)
      expect(near).toBeGreaterThan(0.05)
      expect(near).toBeLessThan(dist - radius)
      expect(far).toBeGreaterThan(dist + radius)
      expect(far / near).toBeLessThan(500)
    }
  })

  it('shrinks near cleanly for close-up interior inspection', () => {
    const { near, far } = computeClipPlanes('perspective', 40, 8, 200)
    expect(near).toBeLessThanOrEqual(0.1)
    expect(near).toBeGreaterThanOrEqual(0.05)
    expect(far).toBeGreaterThan(200)
  })

  it('keeps isometric near positive for SSAO and expands far for huge builds', () => {
    const { near, far } = computeClipPlanes('isometric', 1500, 1500, 600)
    expect(near).toBeGreaterThan(0)
    expect(far).toBeGreaterThan(1500 + 600)
  })
})
