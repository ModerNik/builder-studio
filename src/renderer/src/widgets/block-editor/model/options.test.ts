import { describe, expect, it } from 'vitest'
import { MAX_SIZE } from '@/entities/block-edit/model/edit'
import { DEFAULT_OPTIONS, resize, summary } from './options'

describe('tool options', () => {
  it('sums up a tool with options for the HUD, and nothing for one without', () => {
    expect(summary('brush', DEFAULT_OPTIONS)).toBe('Sphere 5 · Add')
    expect(summary('paint', DEFAULT_OPTIONS)).toBe('Sphere 3 · surface · keep shape')
    const bare = { ...DEFAULT_OPTIONS.paint, surface: false, keep: false }
    expect(summary('paint', { ...DEFAULT_OPTIONS, paint: bare })).toBe('Sphere 3')
    expect(summary('fill', DEFAULT_OPTIONS)).toBe('Connected · Selection · keep shape')
    const air = { ...DEFAULT_OPTIONS.fill, mode: 'air', limit: 'layer' } as const
    expect(summary('fill', { ...DEFAULT_OPTIONS, fill: air })).toBe('Air · Layer') // nothing to keep in air
    expect(summary('shape', DEFAULT_OPTIONS)).toBe('Box 5×5×5 · spacing 6')
    const ring = { ...DEFAULT_OPTIONS.shape, kind: 'cylinder', hollow: true } as const
    expect(summary('shape', { ...DEFAULT_OPTIONS, shape: ring })).toBe(
      'Cylinder 5×5×5 · hollow 1 · spacing 6'
    )
    const line = { ...DEFAULT_OPTIONS.shape, kind: 'line', width: 3 } as const
    expect(summary('shape', { ...DEFAULT_OPTIONS, shape: line })).toBe('Line · width 3')
    expect(summary('terrain', DEFAULT_OPTIONS)).toBe('Raise 8 · strength 1')
    expect(summary('place', DEFAULT_OPTIONS)).toBeNull()
  })

  it('keeps sizes in range', () => {
    expect(resize(DEFAULT_OPTIONS, 'brush', 1).brush.size).toBe(6)
    expect(resize(DEFAULT_OPTIONS, 'brush', -10).brush.size).toBe(1)
    expect(resize(DEFAULT_OPTIONS, 'brush', 100).brush.size).toBe(MAX_SIZE)
    expect(resize(DEFAULT_OPTIONS, 'brush', 1).brush.shape).toBe('sphere')
  })
})
