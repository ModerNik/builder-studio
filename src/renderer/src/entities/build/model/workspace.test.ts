import { describe, expect, it, vi } from 'vitest'

// every window.studio call resolves to [] (lib/studio reads window.studio on import)
vi.hoisted(() => {
  const api: object = new Proxy(() => Promise.resolve([]), { get: () => api })
  Object.assign(globalThis, { window: { studio: api, location: {} } })
})
const { groupMaterials, locatableChecks, partCentre, shiftedChecks, versionName } =
  await import('./workspace')

describe('workspace helpers', () => {
  it('groups block states under their id, biggest first', () => {
    expect(
      groupMaterials([
        ['minecraft:stone', 5],
        ['minecraft:oak_stairs[facing=east,half=top]', 2],
        ['minecraft:oak_stairs[facing=west,half=top]', 4]
      ])
    ).toEqual([
      [
        'oak_stairs',
        {
          n: 6,
          states: [
            ['facing=east, half=top', 2],
            ['facing=west, half=top', 4]
          ]
        }
      ],
      ['stone', { n: 5, states: [] }]
    ])
  })

  it('locates only checks the saved file agrees with', () => {
    const where = { dark: [], gravity: [], palette: [] }
    expect(locatableChecks(where, { dark: 2, gravity: 1 }).map(([k]) => k)).toEqual([
      'dark',
      'gravity'
    ])
    expect(
      locatableChecks(where, { dark: 2, gravity: 1 }, { dark: 2, gravity: 3 }).map(([k]) => k)
    ).toEqual(['dark'])
    expect(shiftedChecks({ dark: 2, gravity: 1 }, { dark: 2, gravity: 3, palette: 9 })).toEqual([
      'gravity'
    ])
  })

  it('names versions and centres parts', () => {
    expect(versionName('builds/a/out/v4_arch.litematic')).toBe('v4_arch')
    expect(
      partCentre({
        name: 'deck',
        blocks: 1,
        box: [
          [0, 0, 0],
          [4, 2, 7]
        ],
        sources: []
      })
    ).toEqual([2, 1, 4])
  })
})
