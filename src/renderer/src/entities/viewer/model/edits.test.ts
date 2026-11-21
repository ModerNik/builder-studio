import { expect, test } from 'vitest'
import { AIR, cellKey, layerCells, type EditLayer } from './edits'
import type { Cell } from './inspection'

const STONE = 'minecraft:stone'
const OAK = 'minecraft:oak_planks'

test('a layer sets its cells and puts back the file blocks it no longer holds', () => {
  const grid = new Map<string, string>([[cellKey([0, 0, 0]), STONE]])
  const at = (c: Cell): string => grid.get(cellKey(c)) ?? AIR
  const apply = (layer: EditLayer, originals: Map<string, string>): void => {
    for (const [x, y, z, s] of layerCells(layer, originals, at)) grid.set(cellKey([x, y, z]), s)
  }
  const originals = new Map<string, string>()
  apply(
    new Map([
      ['0,0,0', null],
      ['1,0,0', OAK]
    ]),
    originals
  )
  expect(at([0, 0, 0])).toBe(AIR)
  expect(at([1, 0, 0])).toBe(OAK)
  // undo the removal: the stone comes back, the plank stays
  apply(new Map([['1,0,0', OAK]]), originals)
  expect(at([0, 0, 0])).toBe(STONE)
  expect(at([1, 0, 0])).toBe(OAK)
  // nothing left to change
  expect(layerCells(new Map([['1,0,0', OAK]]), originals, at)).toEqual([])
  apply(new Map(), originals)
  expect(at([1, 0, 0])).toBe(AIR)
})
