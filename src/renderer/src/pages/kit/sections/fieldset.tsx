import type { ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import { Field, Fieldset, FormSection } from '@/shared/ui/primitives/field'
import { Input } from '@/shared/ui/primitives/input'
import { NumberField } from '@/shared/ui/primitives/number-field'
import { Switch } from '@/shared/ui/primitives/switch'
import { Guidance } from '../specimen'

export const meta = { group: 'Forms', title: 'Fieldset and form section' }

export default function FieldsetSection(): ReactElement {
  return (
    <div className="flex max-w-settings flex-col gap-6">
      <FormSection title="Build location" description="Where the schematic will be pasted. Builder Studio never writes to the world.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="X">
            <NumberField value={128} onValueChange={() => {}} />
          </Field>
          <Field label="Y">
            <NumberField value={64} onValueChange={() => {}} min={-64} max={320} />
          </Field>
          <Field label="Z">
            <NumberField value={-40} onValueChange={() => {}} />
          </Field>
        </div>
      </FormSection>
      <FormSection title="Export" description="Applied to every export of this build.">
        <Fieldset legend="Include">
          <Field label="Air blocks" orientation="horizontal">
            <Checkbox />
          </Field>
          <Field label="Entities" orientation="horizontal">
            <Checkbox defaultChecked />
          </Field>
        </Fieldset>
        <Field label="Open the folder after export" orientation="horizontal">
          <Switch defaultChecked />
        </Field>
        <Field label="File name">
          <Input defaultValue="watchtower_v14" />
        </Field>
      </FormSection>
      <Fieldset legend="Disabled fieldset" description="disabled on the fieldset disables every control in it" disabled>
        <Field label="Option" orientation="horizontal">
          <Checkbox />
        </Field>
        <Button variant="outline" className="self-start">
          Apply
        </Button>
      </Fieldset>
      <Guidance>
        Fieldset groups related controls under one legend (radio groups, check sets). FormSection titles a
        block of a settings page and separates it from the one above with a hairline.
      </Guidance>
    </div>
  )
}
