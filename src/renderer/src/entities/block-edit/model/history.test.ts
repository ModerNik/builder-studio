import { describe, expect, it } from 'vitest'
import { EMPTY, commit, decodeLayer, encodeLayer, moveTo, viewLayer } from './history'

const OAK = 'minecraft:oak_planks'
const STONE = 'minecraft:stone'

describe('edit history', () => {
  const placed = commit(EMPTY, 'Place oak_planks', 'place', [['0,64,0', OAK]])
  const erased = commit(placed, 'Erase stone', 'erase', [
    ['1,64,0', null],
    ['0,64,0', STONE]
  ])

  it('applies edits and skips cells already as asked', () => {
    expect([...erased.layer]).toEqual([
      ['0,64,0', STONE],
      ['1,64,0', null]
    ])
    expect(erased.cursor).toBe(2)
    expect(commit(erased, 'again', 'place', [['0,64,0', STONE]])).toBe(erased)
  })

  it('undoes and redoes exactly, and a new edit drops what was undone', () => {
    const undone = moveTo(erased, 1)
    expect([...undone.layer]).toEqual([['0,64,0', OAK]])
    expect([...moveTo(undone, 0).layer]).toEqual([])
    expect(moveTo(moveTo(erased, 0), 2).layer).toEqual(erased.layer)
    const branched = commit(undone, 'Place stone', 'place', [['5,64,5', STONE]])
    expect(branched.edits.map((e) => e.label)).toEqual(['Place oak_planks', 'Place stone'])
    expect(branched.cursor).toBe(2)
  })

  it('removes a cell from the layer when undo brings it back to the file', () => {
    expect(moveTo(placed, 0).layer.has('0,64,0')).toBe(false)
  })
})

describe('layer files', () => {
  it('round-trips through the edits.json form, states listed once', () => {
    const layer = new Map([
      ['0,64,0', OAK],
      ['1,64,0', null],
      ['-3,70,2', OAK]
    ])
    const file = encodeLayer(layer)
    expect(file).toEqual({
      version: 1,
      states: [OAK],
      cells: [0, 64, 0, 1, 1, 64, 0, 0, -3, 70, 2, 1]
    })
    expect(decodeLayer(file)).toEqual(layer)
    expect(decodeLayer(null).size).toBe(0)
  })

  it('moves the layer into a file whose (0, 0, 0) sits elsewhere in the build', () => {
    expect([...viewLayer(new Map([['10,64,-2', OAK]]), [8, 60, -4])]).toEqual([['2,4,2', OAK]])
  })
})
