import { useState, type ReactElement } from 'react'
import { DEFAULT_OPTIONS, type ToolOptions as Options } from '@/widgets/block-editor/model/options'
import {
  STILL,
  flipped,
  type Moves,
  type TransformState
} from '@/features/block-tools/transform/model/transform'
import type { Cell } from '@/entities/viewer/model/inspection'
import { RulerReadout } from '@/features/block-tools/ruler/ui/RulerReadout'
import { ToolOptions, type OptionsChange } from '@/widgets/block-editor/ui/ToolOptions'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Editor', title: 'Tool options' }

function useOptions(start: Partial<Options> = {}): [Options, OptionsChange] {
  const [o, setO] = useState<Options>({ ...DEFAULT_OPTIONS, ...start })
  return [o, (tool, patch) => setO((all) => ({ ...all, [tool]: { ...all[tool], ...patch } }))]
}

/** Transform's controls on a made-up selection: Turn, Flip and Cancel work, Apply starts over. */
function useTransform(size: Cell | null, blocks: number | null, start = STILL): TransformState {
  const [moves, setMoves] = useState<Moves>(start)
  return {
    size,
    blocks,
    moves,
    onTurn: (by) => setMoves((m) => ({ ...m, turns: m.turns + by })),
    onFlip: (axis) => setMoves((m) => flipped(m, axis)),
    onCancel: () => setMoves(STILL),
    onApply: () => setMoves(STILL)
  }
}

export default function ToolOptionsSection(): ReactElement {
  const [brush, setBrush] = useOptions()
  const [line, setLine] = useOptions({
    shape: { ...DEFAULT_OPTIONS.shape, kind: 'line', width: 3 }
  })
  const [narrow, setNarrow] = useOptions({
    brush: { shape: 'cylinder', size: 12, mode: 'erase' },
    paint: { shape: 'cube', size: 8, surface: false, keep: false },
    fill: { mode: 'air', limit: 'layer', keep: true },
    shape: { kind: 'cylinder', size: [7, 12, 7], hollow: true, wall: 2, spacing: 10, width: 1 },
    terrain: { mode: 'flatten', size: 20, strength: 3 },
    transform: { mode: 'copy' }
  })
  const none = useTransform(null, null)
  const fresh = useTransform([9, 6, 7], 214)
  const moved = useTransform([9, 6, 7], 214, {
    offset: [4, 0, -2],
    turns: 1,
    flip: [false, false, false]
  })
  const huge = useTransform([64, 40, 64], null)
  return (
    <div className="flex flex-col gap-6">
      <Specimens title="Brush">
        <Specimen label="Wide dock: labels beside their controls" className="w-[26rem] max-w-full">
          <ToolOptions tool="brush" options={brush} onChange={setBrush} />
        </Specimen>
        <Specimen label="Under 22rem: labels above, Erase on" className="w-[18.75rem] max-w-full">
          <ToolOptions tool="brush" options={narrow} onChange={setNarrow} />
        </Specimen>
      </Specimens>
      <Specimens title="Paint">
        <Specimen label="Defaults: surface only, keeping shape" className="w-[26rem] max-w-full">
          <ToolOptions tool="paint" options={brush} onChange={setBrush} />
        </Specimen>
        <Specimen label="Under 22rem, both switches off" className="w-[18.75rem] max-w-full">
          <ToolOptions tool="paint" options={narrow} onChange={setNarrow} />
        </Specimen>
      </Specimens>
      <Specimens title="Fill">
        <Specimen label="Defaults: Connected, in the selection" className="w-[26rem] max-w-full">
          <ToolOptions tool="fill" options={brush} onChange={setBrush} />
        </Specimen>
        <Specimen
          label="Under 22rem, Air by layer: no Keep shape"
          className="w-[18.75rem] max-w-full"
        >
          <ToolOptions tool="fill" options={narrow} onChange={setNarrow} />
        </Specimen>
      </Specimens>
      <Specimens title="Shape">
        <Specimen label="Defaults: a 5 × 5 × 5 box" className="w-[26rem] max-w-full">
          <ToolOptions tool="shape" options={brush} onChange={setBrush} />
        </Specimen>
        <Specimen label="Under 22rem, a hollow cylinder" className="w-[18.75rem] max-w-full">
          <ToolOptions tool="shape" options={narrow} onChange={setNarrow} />
        </Specimen>
        <Specimen label="Line: only its width" className="w-[18.75rem] max-w-full">
          <ToolOptions tool="shape" options={line} onChange={setLine} />
        </Specimen>
      </Specimens>
      <Specimens title="Terrain">
        <Specimen label="Defaults: raise, size 8" className="w-[26rem] max-w-full">
          <ToolOptions tool="terrain" options={brush} onChange={setBrush} />
        </Specimen>
        <Specimen label="Under 22rem, flatten at strength 3" className="w-[18.75rem] max-w-full">
          <ToolOptions tool="terrain" options={narrow} onChange={setNarrow} />
        </Specimen>
      </Specimens>
      <Specimens title="Transform">
        <Specimen label="No selection" className="w-[18.75rem] max-w-full">
          <ToolOptions tool="transform" options={brush} onChange={setBrush} transform={none} />
        </Specimen>
        <Specimen label="Selected, not moved yet" className="w-[26rem] max-w-full">
          <ToolOptions tool="transform" options={brush} onChange={setBrush} transform={fresh} />
        </Specimen>
        <Specimen label="Under 22rem, moved and turned, Copy" className="w-[18.75rem] max-w-full">
          <ToolOptions tool="transform" options={narrow} onChange={setNarrow} transform={moved} />
        </Specimen>
        <Specimen label="Too big to transform" className="w-[18.75rem] max-w-full">
          <ToolOptions tool="transform" options={brush} onChange={setBrush} transform={huge} />
        </Specimen>
      </Specimens>
      <Specimens title="Ruler">
        <Specimen label="Before the first click" className="w-[18.75rem] max-w-full">
          <RulerReadout measure={null} onClear={() => {}} />
        </Specimen>
        <Specimen label="Measured, in build coordinates" className="w-[18.75rem] max-w-full">
          <RulerReadout measure={{ from: [12, 64, -40], to: [27, 71, -33] }} onClear={() => {}} />
        </Specimen>
      </Specimens>
      <Guidance>
        Options sit under the tool&apos;s name and hint in the Edit tab and last for the session.
        The viewer&apos;s tool HUD repeats their summary, and - and = change a brush&apos;s size
        from the keyboard.
      </Guidance>
    </div>
  )
}
