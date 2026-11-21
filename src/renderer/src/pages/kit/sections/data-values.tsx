import type { ReactElement } from 'react'
import {
  BlockChip,
  CoordinateReadout,
  FileRef,
  KeyValueList,
  Stat,
  Swatch
} from '@/shared/ui/data/values'
import { Cell, Grid, Narrow, Sub } from '../composites-demo'

export const meta = { group: 'Data display', title: 'Values and read-outs' }

// measured block colours as the app reads them from block_colors.json (sample values)
const BLOCKS: [string, string | null, number][] = [
  ['minecraft:stone_bricks', 'rgb(122,121,122)', 4210],
  ['minecraft:spruce_planks', 'rgb(115,85,49)', 1876],
  ['minecraft:oak_stairs[facing=east,half=top,shape=straight]', 'rgb(162,131,79)', 412],
  ['minecraft:dark_oak_log[axis=y]', 'rgb(60,46,26)', 288],
  ['minecraft:cobblestone_wall', 'rgb(128,127,128)', 96],
  ['minecraft:lantern[hanging=true]', 'rgb(106,91,67)', 12],
  ['mymod:mystery_block', null, 3]
]

export default function DataValues(): ReactElement {
  return (
    <div>
      <Sub
        title="KeyValueList"
        note="A description list; terms and values stack when the container is narrow."
      >
        <Grid min="20rem">
          <Cell label="Picked block">
            <KeyValueList
              items={[
                {
                  label: 'Block',
                  value: (
                    <BlockChip
                      state="minecraft:oak_stairs[facing=east,half=top]"
                      color="rgb(162,131,79)"
                      showProps
                    />
                  )
                },
                { label: 'Cell', value: '12 4 -7', mono: true, copy: '12 4 -7' },
                { label: 'Part', value: 'keep/roof' },
                { label: 'Opened at', value: 'build.py:88', mono: true }
              ]}
            />
          </Cell>
          <Cell label="Narrow: stacks">
            <Narrow width={13.75}>
              <KeyValueList
                items={[
                  { label: 'Version', value: 'stone_watchtower_v3.litematic', mono: true },
                  { label: 'Size', value: '48 × 31 × 52 blocks', mono: true },
                  { label: 'Paste at', value: '-212 64 1408', mono: true, copy: '-212 64 1408' }
                ]}
              />
            </Narrow>
          </Cell>
        </Grid>
      </Sub>
      <Sub title="Stat" note="A number and what it counts, tabular so columns of them line up.">
        <Cell label="Export results">
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <Stat label="Blocks" value={6897} />
            <Stat label="Hollowed" value={2314} detail="interior blocks removed" />
            <Stat label="Lint" value={0} unit="problems" tone="success" />
            <Stat label="Lint" value={3} unit="problems" tone="danger" />
            <Stat label="Full build" value="1m 12s" />
          </div>
        </Cell>
      </Sub>
      <Sub
        title="BlockChip and Swatch"
        note="A block's measured colour beside its short id; the full state is the tooltip. An unknown colour shows a dashed outline."
      >
        <Grid min="18rem">
          <Cell label="Material list rows">
            <ul className="flex flex-col gap-1.5">
              {BLOCKS.map(([s, c, n]) => (
                <li key={s} className="flex">
                  <BlockChip state={s} color={c} count={n} className="w-full" />
                </li>
              ))}
            </ul>
          </Cell>
          <Cell label="With properties, and swatch sizes">
            <div className="flex flex-col gap-3">
              <BlockChip
                state="minecraft:oak_stairs[facing=east,half=top,shape=straight]"
                color="rgb(162,131,79)"
                showProps
              />
              <div className="flex items-center gap-2">
                <Swatch color="rgb(122,121,122)" />
                <Swatch color="rgb(122,121,122)" size="md" />
                <Swatch />
                <Swatch size="md" />
              </div>
            </div>
          </Cell>
        </Grid>
      </Sub>
      <Sub
        title="CoordinateReadout"
        note="x / y / z with the axis colours; copy puts “x y z” on the clipboard in game order."
      >
        <Cell label="Paste position and a picked cell">
          <div className="flex flex-col gap-2">
            <CoordinateReadout
              label="Paste at"
              value={[-212, 64, 1408]}
              copyLabel="Copy paste position"
            />
            <CoordinateReadout label="Cell" value={[12, 4, -7]} />
          </div>
        </Cell>
      </Sub>
      <Sub
        title="FileRef"
        note="The folder truncates before the file name; copy, and Show in folder where the app can reveal it."
      >
        <Grid min="18rem">
          <Cell label="Reveal and open">
            <FileRef
              path="builds/stone_watchtower/out/stone_watchtower_v3.litematic"
              onReveal={() => undefined}
              onOpen={() => undefined}
            />
          </Cell>
          <Cell label="Narrow, Windows path">
            <Narrow width={15}>
              <FileRef
                path="C:\Users\you\AppData\Roaming\.minecraft\schematics\stone_watchtower.litematic"
                onReveal={() => undefined}
              />
            </Narrow>
          </Cell>
        </Grid>
      </Sub>
    </div>
  )
}
