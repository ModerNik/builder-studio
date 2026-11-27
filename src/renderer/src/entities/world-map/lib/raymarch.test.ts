import { describe, expect, it } from 'vitest'
import { raymarchHeightfield } from './raymarch'

describe('raymarchHeightfield', () => {
  it('resolves vertical top-down rays in O(1)', () => {
    const hit = raymarchHeightfield([12.4, 600, -8.2], [0, -1, 0], (x, z) =>
      x === 12 && z === -9 ? 72 : null
    )
    expect(hit).toEqual({ x: 12, y: 72, z: -9 })
  })

  it('intersects flat terrain accurately at an angled 3D view ray', () => {
    // Camera at (0, 165, 0) looking along (1, -1, 0) hits y=65 (top of block y=64) at x=100
    const hit = raymarchHeightfield([0, 165, 0], [1, -1, 0], () => 64)
    expect(hit).not.toBeNull()
    expect(hit!.y).toBe(64)
    expect(Math.abs(hit!.x - 100)).toBeLessThanOrEqual(1)
    expect(hit!.z).toBe(0)
  })

  it('hits a raised hill before the lower ground behind it', () => {
    const heightAt = (x: number): number => (x >= 20 && x <= 30 ? 90 : 64)
    // Ray from (0, 111, 0) along (1, -1, 0) passes y=91 at x=20 (the hill top)
    const hit = raymarchHeightfield([0, 111, 0], [1, -1, 0], (x) => heightAt(x))
    expect(hit).not.toBeNull()
    expect(hit!.y).toBe(90)
    expect(hit!.x).toBeGreaterThanOrEqual(20)
    expect(hit!.x).toBeLessThanOrEqual(21)
  })

  it('returns null when pointing into unloaded void or skyward above terrain', () => {
    expect(raymarchHeightfield([0, 100, 0], [0, 1, 0], () => 64)).toBeNull()
    expect(raymarchHeightfield([0, 100, 0], [1, -1, 0], () => null)).toBeNull()
  })
})
