import type { ReactElement } from 'react'
import { Field } from '@/shared/ui/primitives/field'
import { Switch } from '@/shared/ui/primitives/switch'
import { forceFocus, RTL_TEXT, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Forms', title: 'Switch' }

export default function SwitchSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="off">
          <Switch aria-label="Off" />
        </Specimen>
        <Specimen label="on">
          <Switch aria-label="On" defaultChecked />
        </Specimen>
        <Specimen label="focus">
          <Switch aria-label="Focus" className={forceFocus} tabIndex={-1} />
        </Specimen>
        <Specimen label="invalid">
          <Switch aria-label="Invalid" aria-invalid />
        </Specimen>
        <Specimen label="disabled off / on">
          <div className="flex gap-3">
            <Switch aria-label="Disabled off" disabled />
            <Switch aria-label="Disabled on" disabled defaultChecked />
          </div>
        </Specimen>
        <Specimen label="RTL on">
          <div dir="rtl">
            <Switch aria-label="RTL" defaultChecked />
          </div>
        </Specimen>
      </Specimens>
      <div className="flex max-w-md flex-col gap-3">
        <Field label="Run checks after every draft" hint="Adds about ten seconds per draft" orientation="horizontal">
          <Switch defaultChecked />
        </Field>
        <Field label="Send usage data" orientation="horizontal" hint="Off by default; nothing leaves your PC">
          <Switch />
        </Field>
        <div dir="rtl">
          <Field label={RTL_TEXT} orientation="horizontal">
            <Switch defaultChecked />
          </Field>
        </div>
      </div>
    </div>
  )
}
