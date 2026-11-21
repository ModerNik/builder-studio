import { useState, type ReactElement } from 'react'
import { Field } from '@/shared/ui/primitives/field'
import { NumberField } from '@/shared/ui/primitives/number-field'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Forms', title: 'Number field' }

export default function NumberFieldSection(): ReactElement {
  const [x, setX] = useState<number | null>(128)
  const [h, setH] = useState<number | null>(24)
  const [scale, setScale] = useState<number | null>(0.5)
  return (
    <div className="flex flex-col gap-6">
      <Specimens className="*:w-48">
        <Specimen label="coordinate (no limits)">
          <NumberField aria-label="X" value={x} onValueChange={setX} />
        </Specimen>
        <Specimen label="min/max + unit">
          <NumberField aria-label="Height" value={h} onValueChange={setH} min={1} max={320} unit="blocks" />
        </Specimen>
        <Specimen label="decimal step 0.1">
          <NumberField aria-label="Scale" value={scale} onValueChange={setScale} min={0} max={1} step={0.1} />
        </Specimen>
        <Specimen label="at max (+ disabled)">
          <NumberField aria-label="Max" value={320} onValueChange={() => {}} min={1} max={320} />
        </Specimen>
        <Specimen label="empty">
          <NumberField aria-label="Seed" value={null} onValueChange={() => {}} placeholder="Random" />
        </Specimen>
        <Specimen label="disabled">
          <NumberField aria-label="Disabled" value={12} onValueChange={() => {}} disabled />
        </Specimen>
        <Specimen label="read-only">
          <NumberField aria-label="Read-only" value={12} onValueChange={() => {}} readOnly unit="px" />
        </Specimen>
        <Specimen label="no stepper">
          <NumberField aria-label="Y" value={64} onValueChange={() => {}} hideStepper />
        </Specimen>
      </Specimens>
      <div className="w-64">
        <Field label="Clip height" hint="1 to 320" error={h != null && h > 300 ? 'Above the build limit you set' : undefined}>
          <NumberField value={h} onValueChange={setH} min={1} max={320} unit="blocks" />
        </Field>
      </div>
      <Guidance>
        Arrow Up/Down step, Shift+Arrow and Page Up/Down step by ten, Home/End jump to the limits. Typing is
        free; the value is clamped and committed on Enter or blur. The stepper buttons stay out of the Tab
        order (the keys do the same job).
      </Guidance>
    </div>
  )
}
