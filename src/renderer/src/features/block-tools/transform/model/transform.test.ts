import { describe, expect, it } from 'vitest'
import type { Cell } from '@/entities/viewer/model/inspection'
import type { Read } from '@/entities/block-edit/model/edit'
import {
  STILL,
  flipped,
  landing,
  moved,
  transformEdit,
  transformSummary,
  transformed,
  type Moves
} from './transform'

// a 3 × 1 × 2 box: a stair at its north-west corner, stone at its south-east corner, air between
const box = { min: [10, 5, 20] as Cell, max: [12, 5, 21] as Cell }
const world = new Map<string, string>([
  ['10,5,20', 'minecraft:oak_stairs[facing=north,half=bottom,shape=straight]'],
  ['12,5,21', 'minecraft:stone']
])
const read: Read = (c) => world.get(c.join(',')) ?? null
const at = (m: Partial<Moves>): Moves => ({ ...STILL, ...m })

describe('transform', () => {
  it('knows when the selection was moved, turned or flipped', () => {
    expect(moved(STILL)).toBe(false)
    expect(moved(at({ turns: 4 }))).toBe(false)
    expect(moved(at({ turns: -1 }))).toBe(true)
    expect(moved(at({ flip: [false, true, false] }))).toBe(true)
  })

  it('turns the box about its centre and moves it by the offset', () => {
    expect(landing(box, at({ turns: 1 }))).toEqual({ min: [10, 5, 19], max: [11, 5, 21] })
    expect(landing(box, at({ offset: [1, 2, 3] }))).toEqual({ min: [11, 7, 23], max: [13, 7, 24] })
  })

  it('moves blocks and leaves air out', () => {
    expect(transformed(box, at({ offset: [0, 1, 0] }), read)).toEqual([
      [[10, 6, 20], 'minecraft:oak_stairs[facing=north,half=bottom,shape=straight]'],
      [[12, 6, 21], 'minecraft:stone']
    ])
  })

  it('turns cells and states clockwise seen from above', () => {
    // the north-west corner goes north-east, the south-east corner south-west
    expect(transformed(box, at({ turns: 1 }), read)).toEqual([
      [[11, 5, 19], 'minecraft:oak_stairs[facing=east,half=bottom,shape=straight]'],
      [[10, 5, 21], 'minecraft:stone']
    ])
  })

  it('flips cells and states', () => {
    expect(transformed(box, at({ flip: [false, false, true] }), read)).toEqual([
      [[10, 5, 21], 'minecraft:oak_stairs[facing=south,half=bottom,shape=straight]'],
      [[12, 5, 20], 'minecraft:stone']
    ])
  })

  it('clears what Move leaves behind, and Copy does not', () => {
    const m = at({ offset: [1, 0, 0] })
    expect(transformEdit(box, m, read, false)).toEqual([
      [[10, 5, 20], null],
      [[12, 5, 21], null],
      ...transformed(box, m, read)
    ])
    // the stair lands where the stone was: that cell is not cleared
    const over = transformEdit(box, at({ offset: [2, 0, 1] }), read, false)
    expect(over).toContainEqual([
      [12, 5, 21],
      'minecraft:oak_stairs[facing=north,half=bottom,shape=straight]'
    ])
    expect(over).not.toContainEqual([[12, 5, 21], null])
    expect(transformEdit(box, m, read, true)).toEqual(transformed(box, m, read))
  })

  it('flips across the axes of the view after a turn', () => {
    expect(flipped(STILL, 0).flip).toEqual([true, false, false])
    // a quarter turn puts the box's Z along the view's X
    expect(flipped(at({ turns: 1 }), 0).flip).toEqual([false, false, true])
    expect(flipped(at({ turns: 1 }), 1).flip).toEqual([false, true, false])
  })

  it('sums it up for the HUD', () => {
    expect(transformSummary('move', null, STILL)).toBe('Select a box first')
    expect(transformSummary('move', [3, 1, 2], STILL)).toBe('Move 3×1×2')
    expect(
      transformSummary(
        'copy',
        [3, 1, 2],
        at({ offset: [2, 0, -1], turns: -1, flip: [true, false, false] })
      )
    ).toBe('Copy 3×1×2 · offset 2 0 -1 · 270° · flipped')
  })
})
