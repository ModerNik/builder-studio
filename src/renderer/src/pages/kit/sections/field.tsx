import { useState, type ReactElement } from 'react'
import { Field } from '@/shared/ui/primitives/field'
import { Input } from '@/shared/ui/primitives/input'
import { Label } from '@/shared/ui/primitives/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { Guidance, LONG, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Forms', title: 'Field and label' }

export default function FieldSection(): ReactElement {
  const [name, setName] = useState('watch tower!')
  const error = /^[a-z0-9_-]+$/.test(name) ? undefined : 'Use lower-case letters, digits, - and _ only'
  return (
    <div className="flex flex-col gap-6">
      <div className="grid max-w-3xl gap-6 md:grid-cols-2">
        <Field label="Build name" hint="Becomes the folder name under builds/" required error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Minecraft version" hint="The engine targets this version">
          <Select defaultValue="1.21">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1.21">1.21.4</SelectItem>
              <SelectItem value="1.20">1.20.6</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Notes for the assistant" hint="Optional">
          <Textarea placeholder="Keep the roof under 40 blocks" />
        </Field>
        <Field label="Workspace folder" hint="Read-only here; change it in Settings → General">
          <Input readOnly defaultValue="D:\Builds\workspace" className="font-mono text-sm" />
        </Field>
        <Field label={LONG} hint={LONG} error={LONG}>
          <Input defaultValue="long label, hint and error wrap" />
        </Field>
        <Field label="Disabled field">
          <Input disabled defaultValue="Locked while exporting" />
        </Field>
      </div>
      <Specimens title="Label alone">
        <Specimen label="Label + input">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kit-label-demo">Seed</Label>
            <Input id="kit-label-demo" className="w-48" />
          </div>
        </Specimen>
      </Specimens>
      <Guidance>
        Field gives its control an id, aria-describedby (error, then hint), aria-invalid when there is an error
        and aria-required when required. The asterisk is decorative; the control says “required” itself. Show
        errors after the user leaves the field or submits, not on the first keystroke.
      </Guidance>
    </div>
  )
}
