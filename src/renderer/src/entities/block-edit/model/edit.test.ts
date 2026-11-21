import { describe, expect, it } from 'vitest'
import type { BlockReader } from '@/entities/viewer/ui/BuildViewer'
import { readOf } from './edit'

const STONE = 'minecraft:stone'
const OAK = 'minecraft:oak_planks'

describe('readOf', () => {
  const reader: BlockReader = {
    at: (c) => (c[1] === 0 ? STONE : 'minecraft:air'),
    box: () => null
  }
  it('reads the stroke, then the hand edits in build cells, then the file', () => {
    const layer = new Map([
      ['10,0,0', null], // the file's (0, 0, 0) sits at build (10, 0, 0)
      ['11,1,0', OAK]
    ])
    const read = readOf(layer, reader, [10, 0, 0], new Map([['2,0,0', null]]))
    expect(read([0, 0, 0])).toBeNull()
    expect(read([1, 1, 0])).toBe(OAK)
    expect(read([2, 0, 0])).toBeNull()
    expect(read([3, 0, 0])).toBe(STONE)
    expect(read([3, 1, 0])).toBeNull() // air reads as null
  })

  it('reads air while no file is loaded', () => {
    expect(readOf(new Map(), null, [0, 0, 0])([0, 0, 0])).toBeNull()
  })
})
