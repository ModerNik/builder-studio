import { describe, expect, it } from 'vitest'
import { distanceOf, legs, spanOf, type Measure } from './ruler'

describe('ruler', () => {
  const m: Measure = { from: [0, 0, 0], to: [3, 4, -2] }

  it('walks X, then Z, then Y, counting both ends of each leg', () => {
    expect(legs(m)).toEqual([
      { axis: 'x', from: [0, 0, 0], to: [3, 0, 0], blocks: 4 },
      { axis: 'z', from: [3, 0, 0], to: [3, 0, -2], blocks: 3 },
      { axis: 'y', from: [3, 0, -2], to: [3, 4, -2], blocks: 5 }
    ])
  })

  it('leaves out legs one block long', () => {
    expect(legs({ from: [5, 1, 5], to: [5, 9, 5] }).map((l) => l.axis)).toEqual(['y'])
    expect(legs({ from: [5, 1, 5], to: [5, 1, 5] })).toEqual([])
  })

  it('gives the box and the straight distance between centres', () => {
    expect(spanOf(m)).toEqual([4, 5, 3])
    expect(distanceOf(m)).toBeCloseTo(Math.sqrt(29))
  })
})
