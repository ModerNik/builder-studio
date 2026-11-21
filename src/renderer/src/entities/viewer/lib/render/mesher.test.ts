import { describe, expect, it } from 'vitest'
import { chunksAround } from './mesher'

describe('chunksAround', () => {
  it('re-meshes only the chunk of a cell inside it', () => {
    expect([...chunksAround([40, 20, 40], [[5, 5, 5]])]).toEqual([0])
  })

  it('adds the chunks beside a cell on a chunk face', () => {
    // nx = 3, nz = 3: ids count x fastest, then z, then y. The cell is in chunk 9; east is 10, below is 0
    expect([...chunksAround([40, 20, 40], [[15, 16, 0]])].sort((a, b) => a - b)).toEqual([0, 9, 10])
  })

  it('ignores neighbours outside the grid', () => {
    expect([...chunksAround([16, 16, 16], [[0, 0, 0]])]).toEqual([0])
  })
})
