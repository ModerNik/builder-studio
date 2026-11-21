import { expect, test, vi } from 'vitest'
import { readBlock, type Cell } from './inspection'

const bounds = { min: [0, 0, 0], max: [3, 5, 7] }

test('inspection accepts each inclusive boundary and keeps block properties', () => {
  const read = vi.fn(() => 'minecraft:oak_stairs[facing=north]')
  expect(readBlock([0, 0, 0], bounds, read)).toEqual({
    cell: [0, 0, 0],
    state: 'minecraft:oak_stairs[facing=north]'
  })
  expect(readBlock([3, 5, 7], bounds, read)?.cell).toEqual([3, 5, 7])
  expect(read).toHaveBeenLastCalledWith(3, 5, 7)
})

test('invalid coordinates never read the schematic', () => {
  const read = vi.fn(() => 'minecraft:stone')
  for (const cell of [
    [-1, 0, 0],
    [4, 0, 0],
    [0, 6, 0],
    [0, 0, 8],
    [0.5, 0, 0],
    [NaN, 0, 0],
    [0, Infinity, 0]
  ] as Cell[])
    expect(readBlock(cell, bounds, read)).toBeNull()
  expect(read).not.toHaveBeenCalled()
})

test('air and empty cells have no selected block state', () => {
  for (const state of ['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air', undefined])
    expect(readBlock([1, 2, 3], bounds, () => state)).toEqual({
      cell: [1, 2, 3],
      state: undefined
    })
})

test('bounds use schematic coordinates, including a nonzero minimum', () => {
  const offset = { min: [-2, 4, 6], max: [0, 7, 9] }
  expect(readBlock([-2, 4, 6], offset, () => 'minecraft:stone')?.state).toBe('minecraft:stone')
  expect(readBlock([0, 0, 0], offset, () => 'minecraft:stone')).toBeNull()
})
