import { describe, expect, it } from 'vitest'
import {
  categoryOf,
  filterBlocks,
  formatState,
  fullState,
  parseState,
  shapeOf,
  type BlockInfo
} from './registry'
import { recentIds } from './recent'

const block = (id: string, label: string, props: BlockInfo['props'] = []): BlockInfo => ({
  id: `minecraft:${id}`,
  label,
  props,
  defaults: Object.fromEntries(props.map((p) => [p.name, p.values[0]]))
})
const STAIRS = block('oak_stairs', 'Oak Stairs', [
  { name: 'facing', type: 'enum', values: ['north', 'south', 'west', 'east'] },
  { name: 'waterlogged', type: 'bool', values: ['true', 'false'] }
])
STAIRS.defaults.waterlogged = 'false'

describe('categories and shapes', () => {
  it.each([
    ['stone_bricks', 'building'],
    ['oak_planks', 'building'],
    ['oak_stairs', 'building'],
    ['red_wool', 'colored'],
    ['light_blue_stained_glass', 'colored'],
    ['glass', 'building'],
    ['oak_log', 'natural'],
    ['iron_ore', 'natural'],
    ['short_grass', 'natural'],
    ['chest', 'functional'],
    ['oak_sign', 'functional'],
    ['lantern', 'functional'],
    ['redstone_wire', 'redstone'],
    ['stone_button', 'redstone'],
    ['sticky_piston', 'redstone'],
    ['rail', 'redstone']
  ])('%s is %s', (id, category) => expect(categoryOf(`minecraft:${id}`)).toBe(category))

  it.each([
    ['stone', 'full'],
    ['oak_leaves', 'full'],
    ['oak_stairs', 'stairs'],
    ['smooth_stone_slab', 'slab'],
    ['cobblestone_wall', 'wall'],
    ['oak_fence_gate', 'fence'],
    ['iron_trapdoor', 'door'],
    ['white_carpet', 'other'],
    ['torch', 'other'],
    ['oak_wall_sign', 'other']
  ])('%s is %s', (id, shape) => expect(shapeOf(`minecraft:${id}`)).toBe(shape))
})

describe('block states', () => {
  it('parses and formats states with sorted properties', () => {
    expect(parseState('oak_stairs[half=top,facing=east]')).toEqual({
      id: 'minecraft:oak_stairs',
      props: { half: 'top', facing: 'east' }
    })
    expect(parseState('minecraft:stone')).toEqual({ id: 'minecraft:stone', props: {} })
    expect(formatState('minecraft:oak_stairs', { half: 'top', facing: 'east' })).toBe(
      'minecraft:oak_stairs[facing=east,half=top]'
    )
  })

  it('fills every property, keeping only the values the block has', () => {
    expect(fullState(STAIRS, { facing: 'east', shape: 'inner_left' })).toBe(
      'minecraft:oak_stairs[facing=east,waterlogged=false]'
    )
    expect(fullState(STAIRS, { facing: 'up' })).toBe(
      'minecraft:oak_stairs[facing=north,waterlogged=false]'
    )
  })
})

describe('filterBlocks', () => {
  const blocks = [
    block('stone', 'Stone'),
    STAIRS,
    block('red_wool', 'Red Wool'),
    block('torch', 'Torch')
  ]
  const none = { category: 'building', shapes: [], search: '', recent: [] }

  it('shows a category, narrowed to the shapes picked', () => {
    expect(filterBlocks(blocks, none).map((b) => b.label)).toEqual(['Stone', 'Oak Stairs'])
    expect(filterBlocks(blocks, { ...none, shapes: ['stairs'] }).map((b) => b.label)).toEqual([
      'Oak Stairs'
    ])
  })

  it('searches every category by id and name words', () => {
    expect(filterBlocks(blocks, { ...none, search: 'red w' }).map((b) => b.label)).toEqual([
      'Red Wool'
    ])
    expect(filterBlocks(blocks, { ...none, search: 'oak stairs' })).toEqual([STAIRS])
  })

  it('lists Recent with starred blocks first', () => {
    const recent = recentIds({
      recent: ['minecraft:torch', 'minecraft:stone'],
      favourites: ['minecraft:stone']
    })
    expect(
      filterBlocks(blocks, { ...none, category: 'recent', recent }).map((b) => b.label)
    ).toEqual(['Stone', 'Torch'])
  })
})
