import { describe, expect, it } from 'vitest'
import type { Cell } from '@/entities/viewer/model/inspection'
import type { Block, Read } from '@/entities/block-edit/model/edit'
import { cellKey } from '@/entities/block-edit/model/geometry'
import { brushAt } from './brush'

const STONE = 'minecraft:stone'
const OAK = 'minecraft:oak_planks'
/** A world with a stone floor at y = 0. */
const floor: Read = (c: Cell) => (c[1] === 0 ? STONE : null)
const world =
  (blocks: Record<string, string>): Read =>
  (c) =>
    blocks[cellKey(c)] ?? null
const oak: Block = { state: OAK, swap: () => OAK }

describe('brushAt', () => {
  it('adds the block only where there is air', () => {
    const cells = brushAt({ shape: 'cube', size: 3, mode: 'add' }, [0, 1, 0], floor, oak)
    expect(cells).toHaveLength(18) // the 9 floor cells are skipped
    expect(cells.every(([c, s]) => c[1] > 0 && s === OAK)).toBe(true)
  })

  it('adds nothing without a block to place', () => {
    expect(brushAt({ shape: 'cube', size: 3, mode: 'add' }, [0, 1, 0], floor, null)).toEqual([])
  })

  it('erases only the blocks in the stamp', () => {
    const read = world({ '0,0,0': STONE, '5,0,0': STONE })
    expect(brushAt({ shape: 'sphere', size: 3, mode: 'erase' }, [0, 0, 0], read, oak)).toEqual([
      [[0, 0, 0], null]
    ])
  })
})
