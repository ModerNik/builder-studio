// Terrain's settings in the Edit tab (DESIGN › Tool options).
import type { ReactElement } from 'react'
import { Choice, Hint, Row, Rows, Size } from '@/entities/block-edit/ui/OptionRows'
import type { TerrainOptions } from '../model/terrain'

export function TerrainPanel({
  options: o,
  onChange
}: {
  options: TerrainOptions
  onChange: (patch: Partial<TerrainOptions>) => void
}): ReactElement {
  return (
    <Rows>
      <Row label="Mode">
        {(id) => (
          <Choice
            id={id}
            value={o.mode}
            items={[
              ['raise', 'Raise'],
              ['lower', 'Lower'],
              ['smooth', 'Smooth'],
              ['flatten', 'Flatten']
            ]}
            onChange={(mode) => onChange({ mode })}
          />
        )}
      </Row>
      <Row label="Size">
        {() => <Size value={o.size} label="Terrain size" onChange={(size) => onChange({ size })} />}
      </Row>
      <Row label="Strength">
        {(id) => (
          <Choice
            id={id}
            value={String(o.strength)}
            items={[
              ['1', '1'],
              ['2', '2'],
              ['3', '3'],
              ['4', '4']
            ]}
            onChange={(v) => onChange({ strength: Number(v) })}
          />
        )}
      </Row>
      <Hint>
        One drag moves the ground up to Strength blocks, less toward the edge; drag again for more.
        Raised ground copies each column&apos;s top block. Shift-drag lowers while Raise is on, and
        raises while Lower is on. Flatten works toward the height where the drag started.
      </Hint>
    </Rows>
  )
}
