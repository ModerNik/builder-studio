import type { ComponentProps, ReactElement } from 'react'
import { Compass, FilePen, Shield, Zap } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import { forceFocus, Guidance, LONG, RTL_TEXT, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Forms', title: 'Select' }

const versions = Array.from({ length: 30 }, (_, i) => `v${30 - i}`)

function Versions({
  className,
  ...props
}: { className?: string } & ComponentProps<typeof Select>): ReactElement {
  return (
    <Select {...props}>
      <SelectTrigger aria-label="Version" className={className}>
        <SelectValue placeholder="Pick a version" />
      </SelectTrigger>
      <SelectContent>
        {versions.map((v) => (
          <SelectItem key={v} value={v}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default function SelectSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens className="*:w-56">
        <Specimen label="placeholder">
          <Versions />
        </Specimen>
        <Specimen label="selected (long list scrolls)">
          <Versions defaultValue="v12" />
        </Specimen>
        <Specimen label="focus">
          <Select defaultValue="a">
            <SelectTrigger aria-label="Focus" className={forceFocus} tabIndex={-1}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Survival</SelectItem>
            </SelectContent>
          </Select>
        </Specimen>
        <Specimen label="invalid">
          <Select>
            <SelectTrigger aria-label="World" aria-invalid>
              <SelectValue placeholder="Pick a world" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Survival</SelectItem>
            </SelectContent>
          </Select>
        </Specimen>
        <Specimen label="disabled">
          <Versions defaultValue="v3" disabled />
        </Specimen>
        <Specimen label="sm (subtle variant)">
          <Select defaultValue="a">
            <SelectTrigger size="sm" variant="subtle" aria-label="Small subtle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Blocks</SelectItem>
              <SelectItem value="b">Parts</SelectItem>
            </SelectContent>
          </Select>
        </Specimen>
        <Specimen label="ghost with icons & descriptions">
          <Select defaultValue="auto">
            <SelectTrigger
              size="sm"
              variant="ghost"
              leading={<Zap aria-hidden className="size-3.5 text-warning-text" />}
              aria-label="Mode"
              className="w-auto text-warning-text"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="w-64">
              <SelectItem
                value="default"
                icon={<Shield aria-hidden className="size-3.5" />}
                description="Asks before each edit"
              >
                Manual
              </SelectItem>
              <SelectItem
                value="acceptEdits"
                icon={<FilePen aria-hidden className="size-3.5" />}
                description="Runs edits without asking"
              >
                Accept edits
              </SelectItem>
              <SelectItem
                value="auto"
                icon={<Zap aria-hidden className="size-3.5 text-warning-text" />}
                description="Runs every call without asking"
                className="text-warning-text"
              >
                Auto
              </SelectItem>
              <SelectItem
                value="plan"
                icon={<Compass aria-hidden className="size-3.5 text-accent-text" />}
                description="Plans before editing"
                className="text-accent-text"
              >
                Plan
              </SelectItem>
            </SelectContent>
          </Select>
        </Specimen>
        <Specimen label="groups, descriptions, disabled item">
          <Select defaultValue="claude">
            <SelectTrigger aria-label="Assistant">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Cloud</SelectLabel>
                <SelectItem value="claude" description="Anthropic">
                  Claude Code
                </SelectItem>
                <SelectItem value="codex" description="OpenAI">
                  Codex
                </SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Local</SelectLabel>
                <SelectItem value="ollama" disabled description="Not installed">
                  Ollama
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Specimen>
        <Specimen label="long value truncates">
          <Select defaultValue="long">
            <SelectTrigger aria-label="Long">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-w-80">
              <SelectItem value="long">{LONG}</SelectItem>
            </SelectContent>
          </Select>
        </Specimen>
        <Specimen label="RTL">
          <div dir="rtl" className="w-full">
            <Select defaultValue="a" dir="rtl">
              <SelectTrigger aria-label="RTL">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">{RTL_TEXT}</SelectItem>
                <SelectItem value="b">ב</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Specimen>
      </Specimens>
      <Guidance>
        Use Select instead of a native select (lint warns on native selects in app screens). Type to
        jump to an option; for long or searchable lists use Combobox.
      </Guidance>
    </div>
  )
}
