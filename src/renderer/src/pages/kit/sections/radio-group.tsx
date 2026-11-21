import type { ReactElement } from 'react'
import { Field, Fieldset } from '@/shared/ui/primitives/field'
import { RadioCard, RadioGroup, RadioGroupItem } from '@/shared/ui/primitives/radio-group'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { forceFocus, RTL_TEXT, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Forms', title: 'Radio group' }

export default function RadioGroupSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="unchecked / checked">
          <RadioGroup defaultValue="b" aria-label="States" className="flex">
            <RadioGroupItem value="a" aria-label="Unchecked" />
            <RadioGroupItem value="b" aria-label="Checked" />
          </RadioGroup>
        </Specimen>
        <Specimen label="focus">
          <RadioGroup aria-label="Focus">
            <RadioGroupItem value="a" aria-label="Focus" className={forceFocus} tabIndex={-1} />
          </RadioGroup>
        </Specimen>
        <Specimen label="invalid">
          <RadioGroup aria-label="Invalid">
            <RadioGroupItem value="a" aria-label="Invalid" aria-invalid />
          </RadioGroup>
        </Specimen>
        <Specimen label="disabled / disabled checked">
          <RadioGroup defaultValue="b" disabled aria-label="Disabled" className="flex">
            <RadioGroupItem value="a" aria-label="Disabled" />
            <RadioGroupItem value="b" aria-label="Disabled checked" />
          </RadioGroup>
        </Specimen>
      </Specimens>
      <div className="grid gap-6 md:grid-cols-2">
        <Fieldset legend="Export format" description="Arrow keys change the choice.">
          <RadioGroup defaultValue="litematic" aria-label="Export format">
            <Field label=".litematic" hint="Litematica, the default" orientation="horizontal">
              <RadioGroupItem value="litematic" />
            </Field>
            <Field label=".schem" hint="WorldEdit and Sponge" orientation="horizontal">
              <RadioGroupItem value="schem" />
            </Field>
            <Field label=".nbt" hint="Structure blocks; 48×48×48 at most" orientation="horizontal">
              <RadioGroupItem value="nbt" disabled />
            </Field>
          </RadioGroup>
        </Fieldset>
        <Fieldset
          legend="AI assistant"
          description="Card variant: the whole card is the radio. The chosen card shows its check."
          className="md:col-span-2"
        >
          <RadioGroup defaultValue="claude" aria-label="AI assistant" className="gap-2">
            <RadioCard
              value="claude"
              title="Claude Code"
              description="Anthropic's agent, run on this computer"
              badge={<Badge variant="success">Ready</Badge>}
            >
              <p className="font-mono text-sm text-fg-secondary">claude 2.1.4 · signed in</p>
              <Button size="sm" variant="outline" className="self-start">
                Check again
              </Button>
            </RadioCard>
            <RadioCard
              value="codex"
              title="Codex"
              description="OpenAI's agent, signs in with ChatGPT"
              badge={<Badge variant="warning">Sign-in needed</Badge>}
            >
              <Button size="sm" className="self-start">
                Sign in with ChatGPT
              </Button>
            </RadioCard>
            <RadioCard
              value="ollama"
              title="Ollama"
              description="Local models; no account"
              badge={<Badge variant="outline">Not connected</Badge>}
            />
            <RadioCard
              value="other"
              title="Disabled card"
              description="Not available on this computer"
              badge={<Badge variant="secondary">Checking…</Badge>}
              disabled
            />
          </RadioGroup>
        </Fieldset>
        <div dir="rtl">
          <Fieldset legend={RTL_TEXT}>
            <RadioGroup defaultValue="a" aria-label="RTL" dir="rtl">
              <Field label="א" orientation="horizontal">
                <RadioGroupItem value="a" />
              </Field>
              <Field label="ב" orientation="horizontal">
                <RadioGroupItem value="b" />
              </Field>
            </RadioGroup>
          </Fieldset>
        </div>
      </div>
    </div>
  )
}
