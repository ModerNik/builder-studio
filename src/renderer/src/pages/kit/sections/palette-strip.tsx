import { useState, type ReactElement } from 'react'
import { PaletteStrip, PaletteTile, type PaletteBlock } from '@/shared/ui/data/PaletteStrip'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Data display', title: 'Palette strip' }

// the canvas board's ramp: deepslate to calcite, with a cluster of close steps and one jump
const RAMP: PaletteBlock[] = [
  { id: 'deepslate_tiles', color: '#3b3b40', l: 0.36 },
  { id: 'deepslate_bricks', color: '#4f4f54', l: 0.47 },
  { id: 'polished_deepslate', color: '#57575c', l: 0.52 },
  { id: 'cobbled_deepslate', color: '#5c5c61', l: 0.55 },
  { id: 'tuff', color: '#626660', l: 0.57 },
  { id: 'polished_tuff', color: '#646862', l: 0.58 },
  { id: 'calcite', color: '#dfe0dc', l: 0.89 }
]
const COPPER: PaletteBlock[] = [
  { id: 'copper_block', color: '#c0704f', l: 0.62 },
  { id: 'exposed_copper', color: '#a17e68', l: 0.61 },
  { id: 'weathered_copper', color: '#6c9f72', l: 0.63 },
  { id: 'oxidized_copper', color: '#52a387', l: 0.64 },
  { id: 'modded_block_without_texture', color: null, l: 0.5 }
]

export default function PaletteStripSection(): ReactElement {
  const [picked, setPicked] = useState('weathered_copper')
  return (
    <div className="flex flex-col gap-6">
      <Specimens title="Tile sizes: sm 72 (no L), md 96, lg 120">
        {(['sm', 'md', 'lg'] as const).map((s) => (
          <Specimen key={s} label={s}>
            <div className="rounded-lg bg-surface-viewer p-2">
              <PaletteTile block={RAMP[1]} size={s} />
            </div>
          </Specimen>
        ))}
        <Specimen label="selected">
          <div className="rounded-lg bg-surface-viewer p-2">
            <PaletteTile block={RAMP[1]} selected />
          </div>
        </Specimen>
        <Specimen label="no texture">
          <div className="rounded-lg bg-surface-viewer p-2">
            <PaletteTile block={COPPER[4]} />
          </div>
        </Specimen>
      </Specimens>
      <Specimens title="Tool result: click a tile to copy its id">
        <Specimen label="selectable" className="w-full max-w-3xl">
          <PaletteStrip
            label="Copper ageing"
            blocks={COPPER}
            selected={picked}
            onSelect={setPicked}
          />
        </Specimen>
      </Specimens>
      <Specimens title="Ramp with the shade check">
        <Specimen label="check" className="w-full max-w-3xl">
          <PaletteStrip
            label="Ramp from deepslate tiles to calcite"
            blocks={RAMP}
            check
            summary="L 0.36 → 0.89. Three steps under 0.04 read as one shade; the last step jumps 0.31."
          />
        </Specimen>
        <Specimen label="sm, wraps at 390" className="w-90">
          <PaletteStrip label="Ramp, small" blocks={RAMP} size="sm" />
        </Specimen>
      </Specimens>
      <Guidance>
        Tiles sit on viewer gray so block colors read the same in both themes. The swatch has a 1px
        inner ring; a block with no texture is a dashed outline. With the check on, a step under
        0.04 or over 0.20 turns amber and says why to screen readers; the check line comes from the
        screen.
      </Guidance>
    </div>
  )
}
