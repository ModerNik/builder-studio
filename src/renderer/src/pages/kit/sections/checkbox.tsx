import { useState, type ReactElement } from 'react'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import { Field, Fieldset } from '@/shared/ui/primitives/field'
import { forceFocus, LONG, RTL_TEXT, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Forms', title: 'Checkbox' }

const checks = ['Floating blocks', 'Unsupported sand', 'Light level']

export default function CheckboxSection(): ReactElement {
  const [on, setOn] = useState<string[]>(['Floating blocks'])
  const all = on.length === checks.length ? true : on.length ? 'indeterminate' : false
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="unchecked">
          <Checkbox aria-label="Unchecked" />
        </Specimen>
        <Specimen label="checked">
          <Checkbox aria-label="Checked" defaultChecked />
        </Specimen>
        <Specimen label="indeterminate">
          <Checkbox aria-label="Indeterminate" checked="indeterminate" />
        </Specimen>
        <Specimen label="hover">
          <Checkbox aria-label="Hover" className="border-fg-secondary" />
        </Specimen>
        <Specimen label="focus">
          <Checkbox aria-label="Focus" className={forceFocus} tabIndex={-1} />
        </Specimen>
        <Specimen label="invalid">
          <Checkbox aria-label="Invalid" aria-invalid />
        </Specimen>
        <Specimen label="disabled">
          <Checkbox aria-label="Disabled" disabled />
        </Specimen>
        <Specimen label="disabled checked">
          <Checkbox aria-label="Disabled checked" disabled defaultChecked />
        </Specimen>
      </Specimens>
      <div className="grid gap-6 md:grid-cols-2">
        <Fieldset legend="Checks to run" description="Select all toggles every check.">
          <Field label="All checks" orientation="horizontal">
            <Checkbox
              checked={all}
              onCheckedChange={(v) => setOn(v === true ? checks : [])}
            />
          </Field>
          <div className="flex flex-col gap-2 ps-6">
            {checks.map((c) => (
              <Field key={c} label={c} orientation="horizontal">
                <Checkbox
                  checked={on.includes(c)}
                  onCheckedChange={(v) => setOn(v === true ? [...on, c] : on.filter((x) => x !== c))}
                />
              </Field>
            ))}
          </div>
        </Fieldset>
        <div className="flex flex-col gap-3">
          <Field label="I understand this overwrites build.py" orientation="horizontal" required error="Confirm to continue">
            <Checkbox />
          </Field>
          <Field label={LONG} orientation="horizontal" hint="Long labels wrap beside the box">
            <Checkbox defaultChecked />
          </Field>
          <div dir="rtl">
            <Field label={RTL_TEXT} orientation="horizontal">
              <Checkbox defaultChecked />
            </Field>
          </div>
        </div>
      </div>
    </div>
  )
}
