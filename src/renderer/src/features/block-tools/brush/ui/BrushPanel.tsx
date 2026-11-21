// Brush's settings in the Edit tab (DESIGN › Tool options).
import type { ReactElement } from 'react'
import { Choice, Hint, Row, Rows, Size } from '@/entities/block-edit/ui/OptionRows'
import type { BrushOptions } from '../model/brush'

export function BrushPanel({
  options: o,
  onChange
}: {
  options: BrushOptions
  onChange: (patch: Partial<BrushOptions>) => void
}): ReactElement {
  return (
    <Rows>
      <Row label="Shape">
        {(id) => (
          <Choice
            id={id}
            value={o.shape}
            items={[
              ['sphere', 'Sphere'],
              ['cube', 'Cube'],
              ['cylinder', 'Cylinder']
            ]}
            onChange={(shape) => onChange({ shape })}
          />
        )}
      </Row>
      <Row label="Size">
        {() => <Size value={o.size} label="Brush size" onChange={(size) => onChange({ size })} />}
      </Row>
      <Row label="Mode">
        {(id) => (
          <Choice
            id={id}
            value={o.mode}
            items={[
              ['add', 'Add'],
              ['erase', 'Erase']
            ]}
            onChange={(mode) => onChange({ mode })}
          />
        )}
      </Row>
      <Hint>Add fills only air; Erase removes only blocks.</Hint>
    </Rows>
  )
}
