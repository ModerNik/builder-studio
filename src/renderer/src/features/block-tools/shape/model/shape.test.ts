import { describe, expect, it } from 'vitest'
import type { Cell } from '@/entities/viewer/model/inspection'
import type { ViewerHit } from '@/entities/viewer/ui/BuildViewer'
import type { Block, Read } from '@/entities/block-edit/model/edit'
import { cornerOf, shapeAt, type ShapeOptions } from './shape'

const STONE = 'minecraft:stone'
const OAK = 'minecraft:oak_planks'
/** A world with a stone floor at y = 0. */
const floor: Read = (c: Cell) => (c[1] === 0 ? STONE : null)
const oak: Block = { state: OAK, swap: () => OAK }

describe('shapes', () => {
  const hit = (cell: Cell, normal: Cell): ViewerHit => ({
    cell,
    normal,
    adjacent: cell.map((v, i) => v + normal[i]) as Cell,
    state: STONE
  })

  it('stands a shape on a top face, centred across it', () => {
    expect(cornerOf([5, 3, 4], hit([10, 0, 10], [0, 1, 0]))).toEqual([8, 1, 9])
  })

  it('grows out from a side face and hangs under a block', () => {
    expect(cornerOf([3, 3, 3], hit([0, 5, 0], [-1, 0, 0]))).toEqual([-3, 5, -1])
    expect(cornerOf([3, 3, 3], hit([0, 5, 0], [0, -1, 0]))).toEqual([-1, 2, -1])
  })

  it('fills only air, as a hollow shell or a line', () => {
    const o: ShapeOptions = {
      kind: 'box',
      size: [3, 3, 3],
      hollow: true,
      wall: 1,
      spacing: 4,
      width: 1
    }
    const cells = shapeAt(o, [0, 0, 0], floor, oak) // its bottom layer is in the floor
    expect(cells).toHaveLength(26 - 9)
    expect(shapeAt({ ...o, kind: 'line', width: 2 }, [0, 1, 0], floor, oak)).toHaveLength(8) // a 2-block cube
    expect(shapeAt(o, [0, 1, 0], floor, null)).toEqual([])
  })
})
