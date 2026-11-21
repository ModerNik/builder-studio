import { useState, type ReactElement } from 'react'
import { BlockPicker } from '@/entities/block/ui/BlockPicker'
import { BlockStateEditor } from '@/entities/block/ui/BlockStateEditor'
import { BlockTile } from '@/entities/block/ui/BlockTile'
import { useBlockColor } from '@/entities/build/model/blocks'
import type { BlockInfo, BlockProp } from '@/entities/block/model/registry'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Editor', title: 'Block picker' }

const FACING: BlockProp = {
  name: 'facing',
  type: 'enum',
  values: ['north', 'south', 'west', 'east']
}
const WET: BlockProp = { name: 'waterlogged', type: 'bool', values: ['true', 'false'] }
const plain = (id: string, label: string): BlockInfo => ({
  id: `minecraft:${id}`,
  label,
  props: [],
  defaults: {}
})
const STAIRS: BlockInfo = {
  id: 'minecraft:oak_stairs',
  label: 'Oak Stairs',
  props: [
    FACING,
    { name: 'half', type: 'enum', values: ['top', 'bottom'] },
    {
      name: 'shape',
      type: 'enum',
      values: ['straight', 'inner_left', 'inner_right', 'outer_left', 'outer_right']
    },
    WET
  ],
  defaults: { facing: 'north', half: 'bottom', shape: 'straight', waterlogged: 'false' }
}
const WIRE: BlockInfo = {
  id: 'minecraft:redstone_wire',
  label: 'Redstone Wire',
  props: [
    {
      name: 'power',
      type: 'int',
      values: Array.from({ length: 16 }, (_, i) => String(i))
    }
  ],
  defaults: { power: '0' }
}
const BLOCKS: BlockInfo[] = [
  plain('stone', 'Stone'),
  plain('stone_bricks', 'Stone Bricks'),
  plain('oak_planks', 'Oak Planks'),
  plain('spruce_planks', 'Spruce Planks'),
  plain('bricks', 'Bricks'),
  plain('cut_copper', 'Cut Copper'),
  STAIRS,
  {
    ...plain('smooth_stone_slab', 'Smooth Stone Slab'),
    props: [{ name: 'type', type: 'enum', values: ['top', 'bottom', 'double'] }, WET],
    defaults: { type: 'bottom', waterlogged: 'false' }
  },
  plain('cobblestone_wall', 'Cobblestone Wall'),
  plain('oak_fence', 'Oak Fence'),
  plain('oak_door', 'Oak Door'),
  plain('glass', 'Glass'),
  plain('red_wool', 'Red Wool'),
  plain('white_concrete', 'White Concrete'),
  plain('cyan_terracotta', 'Cyan Terracotta'),
  plain('oak_log', 'Oak Log'),
  plain('grass_block', 'Grass Block'),
  plain('oak_leaves', 'Oak Leaves'),
  plain('chest', 'Chest'),
  plain('lantern', 'Lantern'),
  WIRE,
  plain('stone_button', 'Stone Button')
]

export default function BlockPickerSection(): ReactElement {
  const color = useBlockColor()
  const [picked, setPicked] = useState<BlockInfo>(STAIRS)
  const [props, setProps] = useState<Record<string, string>>({ facing: 'east' })
  const [star, setStar] = useState(false)
  const none = (): undefined => undefined
  return (
    <div className="flex flex-col gap-6">
      <Specimens title="Block tile">
        <Specimen label="rest">
          <BlockTile label="Stone Bricks" color={color('stone_bricks')} />
        </Specimen>
        <Specimen label="selected">
          <BlockTile label="Oak Planks" color={color('oak_planks')} selected />
        </Specimen>
        <Specimen label="no colour known">
          <BlockTile label="Structure Void" />
        </Specimen>
      </Specimens>
      <Specimens>
        <Specimen label="Block picker, in a 300px dock" className="w-[18.75rem] max-w-full">
          <BlockPicker
            blocks={BLOCKS}
            recent={['minecraft:oak_stairs', 'minecraft:stone_bricks']}
            value={picked.id}
            onChange={(b) => {
              setPicked(b)
              setProps({})
            }}
            icon={none}
            color={color}
            className="w-full"
          />
        </Specimen>
        <Specimen label="Block state editor" className="w-[18.75rem] max-w-full">
          <BlockStateEditor
            block={picked}
            props={props}
            onChange={setProps}
            color={color(picked.id)}
            favourite={star}
            onFavourite={() => setStar((s) => !s)}
            className="w-full"
          />
        </Specimen>
        <Specimen label="numbers and no states" className="w-[18.75rem] max-w-full">
          <div className="flex w-full flex-col gap-6">
            <BlockStateEditor
              block={WIRE}
              props={{}}
              onChange={() => {}}
              color={color(WIRE.id)}
              favourite
              onFavourite={() => {}}
            />
            <BlockStateEditor
              block={BLOCKS[0]}
              props={{}}
              onChange={() => {}}
              color={color('stone')}
              favourite={false}
              onFavourite={() => {}}
            />
          </div>
        </Specimen>
      </Specimens>
      <Guidance>
        In the app, tiles show each block drawn from the game&apos;s textures; here, without a pack,
        they show the block&apos;s colour. Search looks through every category. Category chips pick
        one at a time, shape chips any number. The grid is one tab stop: arrow keys move through it.
      </Guidance>
    </div>
  )
}
