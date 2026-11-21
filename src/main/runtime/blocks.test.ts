import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { deflateSync } from 'zlib'
import { describe, expect, it } from 'vitest'
import { blocksOf, catalogPath, readCatalog, type Catalog } from './blocks'

// definitions as the engine's catalog holds them (1.21.4)
const catalog: Catalog = {
  versions: { '1.21.4': { registry: 'r' } },
  registries: { r: [0, 1, 2, 3] },
  definitions: [
    { name: 'stone', displayName: 'Stone', defaultState: 1, minStateId: 1, states: [] },
    {
      name: 'oak_stairs',
      displayName: 'Oak Stairs',
      defaultState: 2940,
      minStateId: 2929,
      states: [
        { name: 'facing', type: 'enum', values: ['north', 'south', 'west', 'east'] },
        { name: 'half', type: 'enum', values: ['top', 'bottom'] },
        {
          name: 'shape',
          type: 'enum',
          values: ['straight', 'inner_left', 'inner_right', 'outer_left', 'outer_right']
        },
        { name: 'waterlogged', type: 'bool', num_values: 2 }
      ]
    },
    {
      name: 'water',
      displayName: 'Water',
      defaultState: 86,
      minStateId: 86,
      states: [{ name: 'level', type: 'int', num_values: 16 }]
    },
    {
      name: 'oak_leaves',
      displayName: 'Oak Leaves',
      defaultState: 279,
      minStateId: 252,
      states: [
        { name: 'distance', type: 'int', values: ['1', '2', '3', '4', '5', '6', '7'] },
        { name: 'persistent', type: 'bool', num_values: 2 },
        { name: 'waterlogged', type: 'bool', num_values: 2 }
      ]
    }
  ]
}

describe('blocksOf', () => {
  it('reads default states as the game numbers them', () => {
    const blocks = blocksOf(catalog, '1.21.4')!
    const stairs = blocks.find((b) => b.id === 'minecraft:oak_stairs')!
    expect(stairs.defaults).toEqual({
      facing: 'north',
      half: 'bottom',
      shape: 'straight',
      waterlogged: 'false'
    })
    expect(stairs.props.map((p) => p.type)).toEqual(['enum', 'enum', 'enum', 'bool'])
    expect(blocks[0]).toEqual({ id: 'minecraft:stone', label: 'Stone', props: [], defaults: {} })
    const water = blocks.find((b) => b.id === 'minecraft:water')!
    expect(water.props[0].values).toHaveLength(16)
    expect(water.defaults).toEqual({ level: '0' })
    // distance=7 persistent=false waterlogged=false by number; the engine keeps leaves persistent
    expect(blocks.find((b) => b.id === 'minecraft:oak_leaves')!.defaults).toEqual({
      distance: '7',
      persistent: 'true',
      waterlogged: 'false'
    })
  })

  it('knows only the versions in the catalog', () => {
    expect(blocksOf(catalog, '1.7.10')).toBeNull()
  })

  it('finds and reads the catalog beside an installed runtime or a venv', () => {
    const root = mkdtempSync(join(tmpdir(), 'bs-blocks-'))
    const data = join(root, 'Lib/site-packages/schematica/blocks/data')
    mkdirSync(data, { recursive: true })
    writeFileSync(join(data, 'release_catalog.json.z'), deflateSync(JSON.stringify(catalog)))
    const path = catalogPath(join(root, 'python.exe'))!
    expect(catalogPath(join(root, 'Scripts', 'python.exe'))).toBe(path)
    expect(readCatalog(path).versions['1.21.4']).toBeTruthy()
    expect(catalogPath(join(tmpdir(), 'nowhere', 'python.exe'))).toBeNull()
  })
})
