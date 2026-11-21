// Fill's settings in the Edit tab (DESIGN › Tool options).
import type { ReactElement } from 'react'
import { Choice, Hint, Row, Rows, Toggle } from '@/entities/block-edit/ui/OptionRows'
import type { FillOptions } from '../model/fill'

const HINTS = {
  connected: 'Click a block: it and the touching blocks of its kind become the chosen block.',
  air: 'Click a face: the air in front of it, as far as it reaches, fills with the chosen block.',
  replace: 'Click a block: every block of its kind becomes the chosen block.'
}

export function FillPanel({
  options: o,
  onChange
}: {
  options: FillOptions
  onChange: (patch: Partial<FillOptions>) => void
}): ReactElement {
  return (
    <Rows>
      <Row label="Mode">
        {(id) => (
          <Choice
            id={id}
            value={o.mode}
            items={[
              ['connected', 'Connected'],
              ['air', 'Air'],
              ['replace', 'Replace']
            ]}
            onChange={(mode) => onChange({ mode })}
          />
        )}
      </Row>
      <Row label="Limit">
        {(id) => (
          <Choice
            id={id}
            value={o.limit}
            items={[
              ['selection', 'Selection'],
              ['layer', 'Layer'],
              ['build', 'Build']
            ]}
            onChange={(limit) => onChange({ limit })}
          />
        )}
      </Row>
      {o.mode !== 'air' && (
        <Row label="Keep shape and facing">
          {(id) => <Toggle id={id} checked={o.keep} onChange={(keep) => onChange({ keep })} />}
        </Row>
      )}
      <Hint>
        {HINTS[o.mode]} Without a selection, Selection means the whole build; Layer keeps to the
        clicked height.
      </Hint>
    </Rows>
  )
}
