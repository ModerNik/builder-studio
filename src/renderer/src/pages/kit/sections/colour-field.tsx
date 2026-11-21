import { useState, type ReactElement } from 'react'
import { ColourField } from '@/shared/ui/primitives/colour-field'
import { Field } from '@/shared/ui/primitives/field'
import { Swatch } from '@/shared/ui/data/values'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Forms', title: 'Color field' }

export default function ColourFieldSection(): ReactElement {
  const [colour, setColour] = useState('#8a6f4e')
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="live: type a hex or click the swatch">
          <Field label="Color" hint="#rgb or #rrggbb">
            <ColourField value={colour} onChange={setColour} />
          </Field>
          <span className="flex items-center gap-2 font-mono text-sm text-fg-secondary">
            <Swatch color={colour} size="md" /> {colour}
          </span>
        </Specimen>
        <Specimen label="invalid (after blur)">
          <ColourField value="#3a5f9c" onChange={() => {}} aria-invalid />
        </Specimen>
        <Specimen label="disabled">
          <ColourField value="#3a5f9c" onChange={() => {}} disabled />
        </Specimen>
        <Specimen label="read-only">
          <ColourField value="#c7c2b8" onChange={() => {}} readOnly />
        </Specimen>
      </Specimens>
      <Guidance>
        The swatch is the native colour input, so it opens the system picker. Text is kept as typed
        until it is a hex colour; a bad value is marked when the field is left.
      </Guidance>
    </div>
  )
}
