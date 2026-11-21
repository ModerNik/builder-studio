import { describe, expect, it } from 'vitest'
import type { Cell } from '@/entities/viewer/model/inspection'
import type { Block, Box, Read } from '@/entities/block-edit/model/edit'
import { cellKey } from '@/entities/block-edit/model/geometry'
import { MAX_SCAN, fillAt } from './fill'

const STONE = 'minecraft:stone'
const DIRT = 'minecraft:dirt'
const GLASS = 'minecraft:glass'
const glass: Block = { state: GLASS, swap: () => GLASS }
const box = (min: Cell, max: Cell): Box => ({ min, max })
const world =
  (blocks: Record<string, string>): Read =>
  (c) =>
    blocks[cellKey(c)] ?? null
const opts = { mode: 'connected', limit: 'build', keep: false } as const

describe('fillAt', () => {
  // a row of stone, dirt, stone, stone along x
  const row = world({ '0,0,0': STONE, '1,0,0': DIRT, '2,0,0': STONE, '3,0,0': STONE })
  const all = box([0, 0, 0], [3, 0, 0])

  it('Connected spreads through touching blocks of the clicked kind only', () => {
    expect(fillAt(opts, [2, 0, 0], row, glass, all, 100)).toEqual([
      [[2, 0, 0], GLASS],
      [[3, 0, 0], GLASS]
    ])
  })

  it('Replace takes every block of the kind inside the limit, keeping states', () => {
    const read = world({
      '0,0,0': 'minecraft:oak_stairs[facing=east]',
      '5,0,0': 'minecraft:oak_stairs'
    })
    const spruce: Block = {
      state: 'minecraft:spruce_stairs',
      swap: (s) => s.replace('oak', 'spruce')
    }
    expect(
      fillAt(
        { ...opts, mode: 'replace', keep: true },
        [0, 0, 0],
        read,
        spruce,
        box([0, 0, 0], [9, 0, 0]),
        100
      )
    ).toEqual([
      [[0, 0, 0], 'minecraft:spruce_stairs[facing=east]'],
      [[5, 0, 0], 'minecraft:spruce_stairs']
    ])
  })

  it('Air fills the air reached from the clicked face, inside the limit', () => {
    // a cup: stone floor at y = 0 and walls at x = 0 and x = 3, open on top
    const cup: Read = (c) => (c[1] === 0 || c[0] === 0 || c[0] === 3 ? STONE : null)
    const cells = fillAt(
      { ...opts, mode: 'air' },
      [1, 1, 0],
      cup,
      glass,
      box([0, 0, 0], [3, 2, 0]),
      100
    )
    expect(cells?.map(([c]) => c)).toEqual([
      [1, 1, 0],
      [2, 1, 0],
      [1, 2, 0],
      [2, 2, 0]
    ])
  })

  it('changes nothing when the click is outside the limit or on the wrong kind of cell', () => {
    expect(fillAt(opts, [5, 0, 0], row, glass, all, 100)).toEqual([])
    expect(fillAt({ ...opts, mode: 'air' }, [0, 0, 0], row, glass, all, 100)).toEqual([])
    expect(fillAt(opts, [0, 1, 0], row, glass, box([0, 0, 0], [3, 1, 0]), 100)).toEqual([])
  })

  it('gives up past the cap and on a limit too big to scan', () => {
    const solid: Read = () => STONE
    expect(fillAt(opts, [0, 0, 0], solid, glass, box([0, 0, 0], [9, 9, 9]), 100)).toBeNull()
    const huge = box([0, 0, 0], [MAX_SCAN, 0, 0])
    expect(fillAt({ ...opts, mode: 'replace' }, [0, 0, 0], solid, glass, huge, 100)).toBeNull()
  })
})
