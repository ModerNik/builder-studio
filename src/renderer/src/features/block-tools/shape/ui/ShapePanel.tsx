// Shape's settings in the Edit tab (DESIGN › Tool options).
import type { ReactElement } from 'react'
import { NumberField } from '@/shared/ui/primitives/number-field'
import type { Cell } from '@/entities/viewer/model/inspection'
import { Choice, Count, Hint, Row, Rows, Toggle } from '@/entities/block-edit/ui/OptionRows'
import type { ShapeOptions } from '../model/shape'

export function ShapePanel({
  options: o,
  onChange
}: {
  options: ShapeOptions
  onChange: (patch: Partial<ShapeOptions>) => void
}): ReactElement {
  const line = o.kind === 'line'
  return (
    <Rows>
      <Row label="Kind">
        {(id) => (
          <Choice
            id={id}
            value={o.kind}
            items={[
              ['box', 'Box'],
              ['cylinder', 'Cylinder'],
              ['sphere', 'Sphere'],
              ['line', 'Line']
            ]}
            onChange={(kind) => onChange({ kind })}
          />
        )}
      </Row>
      {line ? (
        <Row label="Width">
          {(id) => (
            <Count id={id} value={o.width} max={8} onChange={(width) => onChange({ width })} />
          )}
        </Row>
      ) : (
        <>
          <Row label="Size">
            {(id) => (
              <div role="group" aria-labelledby={id} className="grid grid-cols-3 gap-1.5">
                {(['Width', 'Height', 'Depth'] as const).map((axis, i) => (
                  <NumberField
                    key={axis}
                    aria-label={axis}
                    value={o.size[i]}
                    min={1}
                    max={64}
                    hideStepper
                    onValueChange={(v) =>
                      v !== null &&
                      onChange({ size: o.size.map((s, j) => (j === i ? v : s)) as Cell })
                    }
                  />
                ))}
              </div>
            )}
          </Row>
          <Row label="Hollow">
            {(id) => (
              <Toggle id={id} checked={o.hollow} onChange={(hollow) => onChange({ hollow })} />
            )}
          </Row>
          {o.hollow && (
            <Row label="Wall">
              {(id) => (
                <Count id={id} value={o.wall} max={8} onChange={(wall) => onChange({ wall })} />
              )}
            </Row>
          )}
          <Row label="Spacing">
            {(id) => (
              <Count
                id={id}
                value={o.spacing}
                max={64}
                onChange={(spacing) => onChange({ spacing })}
              />
            )}
          </Row>
        </>
      )}
      <Hint>
        {line
          ? 'Press on a face and release on another: the line fills the air between them.'
          : 'Size is width × height × depth. Shapes fill only air; a drag stamps one every Spacing blocks.'}
      </Hint>
    </Rows>
  )
}
