import { describe, expect, it } from 'vitest'
import type { Cell } from '@/entities/viewer/model/inspection'
import type { Read } from '@/entities/block-edit/model/edit'
import { cellKey } from '@/entities/block-edit/model/geometry'
import { terrainAt } from './terrain'

const GRASS = 'minecraft:grass_block'
/** Ground whose top is at `heights[x]` (y = 0 where unset), grass all the way down to y = -4. */
const ground =
  (heights: Record<number, number> = {}): Read =>
  (c: Cell) =>
    c[1] >= -4 && c[1] <= (heights[c[0]] ?? 0) ? GRASS : null
const one = { size: 1, strength: 2 } as const
const cells = (changes: [Cell, string | null][]): string[] =>
  changes.map(([c, s]) => `${cellKey(c)}=${s ? 'grass' : 'air'}`)

describe('terrainAt', () => {
  it('raises a column by the strength with its top block, and lowers it', () => {
    expect(cells(terrainAt({ ...one, mode: 'raise' }, [0, 0, 0], ground()))).toEqual([
      '0,1,0=grass',
      '0,2,0=grass'
    ])
    expect(cells(terrainAt({ ...one, mode: 'lower' }, [0, 0, 0], ground()))).toEqual([
      '0,-1,0=air',
      '0,0,0=air'
    ])
  })

  it('raises less toward the edge of the footprint, but at least one block', () => {
    const changes = terrainAt({ mode: 'raise', size: 7, strength: 4 }, [0, 0, 0], ground())
    const raised = (x: number, z: number): number =>
      changes.filter(([c]) => c[0] === x && c[2] === z).length
    expect(raised(0, 0)).toBe(4)
    expect(raised(3, 0)).toBe(2)
    expect(raised(0, -3)).toBe(2)
    expect(raised(3, 3)).toBe(0) // outside the round footprint
  })

  it('flattens toward the height where the stroke started, by up to the strength', () => {
    const hill = ground({ 0: 5 })
    expect(cells(terrainAt({ ...one, mode: 'flatten' }, [0, 5, 0], hill, [0, 0, 0]))).toEqual([
      '0,4,0=air',
      '0,5,0=air'
    ])
  })

  it('smooths a spike toward its neighbours', () => {
    const spike = ground({ 0: 3 })
    // the mean of the 3×3 tops around it is 3/9 ≈ 0, so it comes down by the strength
    expect(terrainAt({ ...one, mode: 'smooth' }, [0, 3, 0], spike)).toHaveLength(2)
    expect(terrainAt({ ...one, mode: 'smooth' }, [5, 0, 0], spike)).toEqual([]) // already level
  })

  it('skips columns with no ground within reach', () => {
    expect(terrainAt({ ...one, mode: 'raise' }, [0, 40, 0], ground())).toEqual([])
  })
})
