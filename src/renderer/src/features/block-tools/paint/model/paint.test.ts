import { describe, expect, it } from 'vitest'
import type { Cell } from '@/entities/viewer/model/inspection'
import type { Block, Read } from '@/entities/block-edit/model/edit'
import { cellKey } from '@/entities/block-edit/model/geometry'
import { paintAt } from './paint'

const STONE = 'minecraft:stone'
const world =
  (blocks: Record<string, string>): Read =>
  (c) =>
    blocks[cellKey(c)] ?? null

describe('paintAt', () => {
  const SPRUCE = 'minecraft:spruce_stairs[facing=north]'
  // a toy swap: the new block's id with the old block's states
  const spruce: Block = {
    state: SPRUCE,
    swap: (from) =>
      `minecraft:spruce_stairs${from.includes('[') ? from.slice(from.indexOf('[')) : '[facing=north]'}`
  }
  const solid = (c: Cell): string | null => (c[1] <= 0 ? STONE : null) // stone up to y = 0
  const opts = { shape: 'cube', size: 3, surface: true, keep: false } as const

  it('paints only blocks with air beside them when Surface only is on', () => {
    const cells = paintAt(opts, [0, 0, 0], solid, spruce)
    expect(cells).toHaveLength(9) // the top layer; y = -1 is buried
    expect(cells.every(([c]) => c[1] === 0)).toBe(true)
    expect(paintAt({ ...opts, surface: false }, [0, 0, 0], solid, spruce)).toHaveLength(18)
  })

  it('keeps the shape and facing of what it paints over', () => {
    const read = world({ '0,0,0': 'minecraft:oak_stairs[facing=east]' })
    expect(paintAt({ ...opts, size: 1, keep: true }, [0, 0, 0], read, spruce)).toEqual([
      [[0, 0, 0], 'minecraft:spruce_stairs[facing=east]']
    ])
    expect(paintAt({ ...opts, size: 1 }, [0, 0, 0], read, spruce)).toEqual([[[0, 0, 0], SPRUCE]])
  })

  it('skips air and blocks already as asked', () => {
    expect(paintAt(opts, [0, 5, 0], solid, spruce)).toEqual([])
    expect(paintAt({ ...opts, size: 1 }, [0, 0, 0], world({ '0,0,0': SPRUCE }), spruce)).toEqual([])
  })
})
