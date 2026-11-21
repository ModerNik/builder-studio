// Fixtures are written by the engine (fixtures/make_fixtures.py) with the cells it reads back.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { blockAt, grow, readSchematic, setBlock, type Schematic } from './schematic'

const dir = join(__dirname, 'fixtures')
const air = (s: string): string => (/^minecraft:(cave_|void_)?air$/.test(s) ? 'minecraft:air' : s)

describe('readSchematic', () => {
  it.each(['mixed.litematic', 'wide.litematic', 'negative.litematic', 'mixed.schem'])(
    'reads %s as the engine does',
    async (name) => {
      const want = JSON.parse(readFileSync(join(dir, name.replace(/\.\w+$/, '.json')), 'utf8')) as {
        min: number[]
        size: number[]
        cells: string[]
      }
      const s = await readSchematic(readFileSync(join(dir, name)))
      expect(s.min).toEqual(want.min)
      expect(s.size).toEqual(want.size)
      const got: string[] = []
      for (let y = 0; y < s.size[1]; y++)
        for (let z = 0; z < s.size[2]; z++)
          for (let x = 0; x < s.size[0]; x++)
            got.push(blockAt(s, x + s.min[0], y + s.min[1], z + s.min[2])!)
      expect(got).toEqual(want.cells.map(air))
    }
  )

  it('returns null outside the grid', async () => {
    const s = await readSchematic(readFileSync(join(dir, 'mixed.litematic')))
    expect(blockAt(s, -1, 0, 0)).toBeNull()
    expect(blockAt(s, 0, s.size[1], 0)).toBeNull()
  })
})

describe('setBlock and grow', () => {
  const box = (): Schematic => ({
    min: [10, 60, -5],
    size: [2, 1, 2],
    palette: ['minecraft:air', 'minecraft:stone'],
    data: new Uint16Array([1, 0, 0, 1])
  })

  it('sets cells, adds new states to the palette and keeps air at 0', () => {
    const s = box()
    expect(setBlock(s, 11, 60, -5, 'minecraft:oak_stairs[facing=east]')).toBe(true)
    expect(s.palette).toEqual([
      'minecraft:air',
      'minecraft:stone',
      'minecraft:oak_stairs[facing=east]'
    ])
    expect(setBlock(s, 10, 60, -4, 'minecraft:stone')).toBe(true)
    expect(setBlock(s, 10, 60, -5, 'minecraft:cave_air')).toBe(true)
    expect([...s.data]).toEqual([0, 2, 1, 1])
    expect(s.palette).toHaveLength(3)
    expect(setBlock(s, 12, 60, -5, 'minecraft:stone')).toBe(false)
  })

  it('grows around new cells with a margin and keeps every old cell where it was', () => {
    const s = box()
    const g = grow(s, [[13, 59, -5]], 1)
    expect(g.min).toEqual([10, 58, -6])
    expect(g.size).toEqual([5, 3, 3])
    expect(g.palette).toBe(s.palette)
    for (const [x, z] of [
      [10, -5],
      [11, -5],
      [10, -4],
      [11, -4]
    ])
      expect(blockAt(g, x, 60, z)).toBe(blockAt(s, x, 60, z))
    expect(blockAt(g, 13, 59, -5)).toBe('minecraft:air')
    expect(setBlock(g, 13, 59, -5, 'minecraft:stone')).toBe(true)
  })
})
