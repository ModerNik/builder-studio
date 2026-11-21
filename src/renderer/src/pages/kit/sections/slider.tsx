import { useState, type ReactElement } from 'react'
import { Field } from '@/shared/ui/primitives/field'
import { Slider } from '@/shared/ui/primitives/slider'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Forms', title: 'Slider' }

export default function SliderSection(): ReactElement {
  const [clip, setClip] = useState([40])
  return (
    <div className="flex flex-col gap-6">
      <Specimens className="*:w-64">
        <Specimen label="with value label">
          <Slider aria-label="Clip height" value={clip} onValueChange={setClip} max={64} showValue formatValue={(v) => `y ${v}`} />
        </Specimen>
        <Specimen label="uncontrolled, step 5">
          <Slider aria-label="Opacity" defaultValue={[60]} step={5} showValue formatValue={(v) => `${v}%`} />
        </Specimen>
        <Specimen label="range (two thumbs)">
          <Slider aria-label="Layer range" defaultValue={[10, 48]} max={64} showValue />
        </Specimen>
        <Specimen label="disabled">
          <Slider aria-label="Disabled" defaultValue={[30]} disabled showValue />
        </Specimen>
        <Specimen label="no label">
          <Slider aria-label="Plain" defaultValue={[50]} />
        </Specimen>
        <Specimen label="RTL">
          <div dir="rtl" className="w-full">
            <Slider aria-label="RTL" defaultValue={[30]} dir="rtl" showValue />
          </div>
        </Specimen>
        <Specimen label="vertical" className="h-44 w-auto!">
          <Slider aria-label="Vertical" defaultValue={[30]} orientation="vertical" />
        </Specimen>
      </Specimens>
      <div className="w-72">
        <Field label="Clip height" hint="[ and ] step one layer in the viewer">
          <Slider value={clip} onValueChange={setClip} max={64} showValue />
        </Field>
      </div>
      <Guidance>
        Arrow keys move one step, Page Up/Down ten, Home/End to the ends. formatValue also sets the
        thumb’s aria-valuetext, so screen readers hear “y 40”, not “40”.
      </Guidance>
    </div>
  )
}
