import { describe, expect, it } from 'vitest'
import { flipState, turnState } from './turn'

const props = (state: string): string => state.slice(state.indexOf('[') + 1, -1)

describe('turnState', () => {
  it('turns facing, axis and rotation clockwise seen from above', () => {
    expect(turnState('minecraft:oak_stairs[facing=north,half=bottom,shape=straight]', 1)).toBe(
      'minecraft:oak_stairs[facing=east,half=bottom,shape=straight]'
    )
    expect(turnState('minecraft:oak_log[axis=x]', 1)).toBe('minecraft:oak_log[axis=z]')
    expect(turnState('minecraft:oak_log[axis=x]', 2)).toBe('minecraft:oak_log[axis=x]')
    expect(turnState('minecraft:oak_sign[rotation=0]', 1)).toBe('minecraft:oak_sign[rotation=4]')
    expect(turnState('minecraft:oak_sign[rotation=14]', -1)).toBe('minecraft:oak_sign[rotation=10]')
    expect(turnState('minecraft:hopper[facing=down]', 1)).toBe('minecraft:hopper[facing=down]')
  })

  it('moves side connections round', () => {
    expect(
      props(turnState('minecraft:oak_fence[east=false,north=true,south=false,west=true]', 1))
    ).toBe('east=true,north=true,south=false,west=false')
  })

  it('turns rails and spells their shapes as the game does', () => {
    const shape = (s: string, k: number): string =>
      turnState(`minecraft:rail[shape=${s}]`, k).split('=')[1].slice(0, -1)
    expect(shape('north_south', 1)).toBe('east_west')
    expect(shape('east_west', 1)).toBe('north_south')
    expect(shape('south_east', 1)).toBe('south_west')
    expect(shape('north_east', 1)).toBe('south_east')
    expect(shape('ascending_north', 1)).toBe('ascending_east')
  })

  it('leaves blocks without states alone', () => {
    expect(turnState('minecraft:stone', 3)).toBe('minecraft:stone')
  })
})

describe('flipState', () => {
  it('mirrors facing, sides and rotation across X and Z', () => {
    expect(flipState('minecraft:furnace[facing=east,lit=false]', 0)).toBe(
      'minecraft:furnace[facing=west,lit=false]'
    )
    expect(flipState('minecraft:furnace[facing=north,lit=false]', 0)).toBe(
      'minecraft:furnace[facing=north,lit=false]'
    )
    expect(
      props(flipState('minecraft:oak_fence[east=true,north=true,south=false,west=false]', 2))
    ).toBe('east=true,north=false,south=true,west=false')
    expect(flipState('minecraft:oak_sign[rotation=4]', 0)).toBe('minecraft:oak_sign[rotation=12]')
    expect(flipState('minecraft:oak_sign[rotation=0]', 2)).toBe('minecraft:oak_sign[rotation=8]')
  })

  it('swaps handedness: stair corners, hinges and chest halves', () => {
    expect(flipState('minecraft:oak_stairs[facing=north,half=bottom,shape=outer_left]', 0)).toBe(
      'minecraft:oak_stairs[facing=north,half=bottom,shape=outer_right]'
    )
    expect(flipState('minecraft:oak_door[facing=east,half=lower,hinge=left]', 0)).toBe(
      'minecraft:oak_door[facing=west,half=lower,hinge=right]'
    )
    expect(flipState('minecraft:chest[facing=north,type=left]', 2)).toBe(
      'minecraft:chest[facing=south,type=right]'
    )
    expect(flipState('minecraft:rail[shape=south_east]', 0)).toBe(
      'minecraft:rail[shape=south_west]'
    )
  })

  it('turns blocks upside down across Y', () => {
    expect(flipState('minecraft:oak_stairs[facing=north,half=top,shape=inner_left]', 1)).toBe(
      'minecraft:oak_stairs[facing=north,half=bottom,shape=inner_left]'
    )
    expect(flipState('minecraft:oak_slab[type=bottom]', 1)).toBe('minecraft:oak_slab[type=top]')
    expect(flipState('minecraft:oak_door[half=upper,hinge=left]', 1)).toBe(
      'minecraft:oak_door[half=lower,hinge=left]'
    )
    expect(flipState('minecraft:cobblestone_wall[north=low,up=true]', 1)).toBe(
      'minecraft:cobblestone_wall[north=low,up=true]'
    )
    expect(flipState('minecraft:glow_lichen[down=false,up=true]', 1)).toBe(
      'minecraft:glow_lichen[down=true,up=false]'
    )
  })
})
