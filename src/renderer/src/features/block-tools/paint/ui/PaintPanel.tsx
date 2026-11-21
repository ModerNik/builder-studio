// Paint's settings in the Edit tab (DESIGN › Tool options).
import type { ReactElement } from 'react'
import { Choice, Hint, Row, Rows, Size, Toggle } from '@/entities/block-edit/ui/OptionRows'
import type { PaintOptions } from '../model/paint'

export function PaintPanel({
  options: o,
  onChange
}: {
  options: PaintOptions
  onChange: (patch: Partial<PaintOptions>) => void
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
              ['cube', 'Cube']
            ]}
            onChange={(shape) => onChange({ shape })}
          />
        )}
      </Row>
      <Row label="Size">
        {() => <Size value={o.size} label="Paint size" onChange={(size) => onChange({ size })} />}
      </Row>
      <Row label="Surface only">
        {(id) => (
          <Toggle id={id} checked={o.surface} onChange={(surface) => onChange({ surface })} />
        )}
      </Row>
      <Row label="Keep shape and facing">
        {(id) => <Toggle id={id} checked={o.keep} onChange={(keep) => onChange({ keep })} />}
      </Row>
      <Hint>
        Surface only skips blocks with no air beside them. Keep shape turns oak stairs into spruce
        stairs facing the same way.
      </Hint>
    </Rows>
  )
}
