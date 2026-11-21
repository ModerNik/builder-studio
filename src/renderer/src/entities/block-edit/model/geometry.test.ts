import { describe, expect, it } from 'vitest'
import { along, every, solid, stamp } from './geometry'

describe('stamp', () => {
  it('is one cell at size 1 for every shape', () => {
    for (const shape of ['sphere', 'cube', 'cylinder'] as const)
      expect(stamp(shape, 1, [4, 64, -2])).toEqual([[4, 64, -2]])
  })

  it('centres odd sizes on the cell and rounds spheres and cylinders', () => {
    const cube = stamp('cube', 3, [0, 0, 0])
    expect(cube).toHaveLength(27)
    expect(cube).toContainEqual([-1, -1, -1])
    const sphere = stamp('sphere', 3, [0, 0, 0])
    expect(sphere).toHaveLength(19) // the cube without its 8 corners
    expect(sphere).not.toContainEqual([1, 1, 1])
    expect(stamp('cylinder', 5, [0, 0, 0])).toHaveLength(105) // 21 per layer: no corners
  })

  it('leans even sizes toward plus', () => {
    const cells = stamp('cube', 2, [10, 10, 10])
    expect(cells).toHaveLength(8)
    expect(cells).toContainEqual([11, 11, 11])
    expect(cells).not.toContainEqual([9, 10, 10])
  })
})

describe('along', () => {
  it('steps from a to b without a, ending on b', () => {
    expect(along([0, 0, 0], [4, 0, 0], 1)).toEqual([
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
      [4, 0, 0]
    ])
    expect(along([0, 0, 0], [6, 0, 0], 3)).toEqual([
      [3, 0, 0],
      [6, 0, 0]
    ])
  })

  it('is empty when the points are the same', () => {
    expect(along([1, 2, 3], [1, 2, 3], 1)).toEqual([])
  })
})

describe('every', () => {
  it('steps exactly the spacing toward the pointer, never past it', () => {
    expect(every([0, 0, 0], [13, 0, 0], 4)).toEqual([
      [4, 0, 0],
      [8, 0, 0],
      [12, 0, 0]
    ])
    expect(every([0, 0, 0], [3, 0, 0], 4)).toEqual([])
  })
})

describe('solid', () => {
  it('fills a box from its min corner', () => {
    const box = solid('box', [2, 3, 4], [10, 0, -5])
    expect(box).toHaveLength(24)
    expect(box[0]).toEqual([10, 0, -5])
    expect(box.at(-1)).toEqual([11, 2, -2])
  })

  it('rounds spheres and stands cylinders upright', () => {
    expect(solid('sphere', [3, 3, 3], [0, 0, 0])).toHaveLength(19) // no corners
    expect(solid('cylinder', [5, 2, 5], [0, 0, 0])).toHaveLength(42) // 21 per layer
    expect(solid('sphere', [1, 1, 1], [0, 0, 0])).toEqual([[0, 0, 0]])
  })

  it('keeps a shell when hollow, and fills what is too thin to hollow', () => {
    expect(solid('box', [5, 5, 5], [0, 0, 0], 1)).toHaveLength(125 - 27)
    expect(solid('box', [5, 5, 5], [0, 0, 0], 2)).toHaveLength(124) // only the centre is inside
    expect(solid('box', [2, 2, 2], [0, 0, 0], 1)).toHaveLength(8)
  })
})
