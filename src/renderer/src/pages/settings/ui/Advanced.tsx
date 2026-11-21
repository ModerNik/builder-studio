// Settings › Advanced: documentation, diagnostics and the manual program and folder overrides.
import { useState, type ReactElement } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/shared/ui/primitives/collapsible'
import { Field } from '@/shared/ui/primitives/field'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { SettingsPanel, SettingsRow } from '@/entities/settings/ui/Settings'
import type { Settings } from '@shared/api'
import { AvailabilityChecks } from '@/entities/availability/ui/AvailabilityChecks'
import { focusIssue, REPAIR_SECTION } from '@/entities/availability/model/setupIssues'
import { SettingInput } from './bits'
import { useLocations } from '@/entities/settings/model/save'

const RELOADS = 'Changing it reloads the window.'
const FIELDS: {
  key:
    | 'claude'
    | 'codex'
    | 'gitBash'
    | 'python'
    | 'runtimeHome'
    | 'runtime'
    | 'cache'
    | 'assets'
    | 'resources'
  label: string
  empty?: string // the placeholder when nothing is detected
  hint?: string
}[] = [
  { key: 'claude', label: 'Claude Code program' },
  { key: 'codex', label: 'Codex program', empty: 'Found on PATH', hint: RELOADS },
  { key: 'gitBash', label: 'Git Bash program', empty: 'Found automatically', hint: RELOADS },
  { key: 'python', label: 'Python runtime', empty: 'Managed by Builder Studio' },
  {
    key: 'runtimeHome',
    label: 'Build tools folder',
    hint: 'Set it before installing tools to keep them somewhere else.'
  },
  { key: 'runtime', label: 'Active build tools', empty: 'Filled in when tools are installed' },
  { key: 'cache', label: 'Cache folder' },
  { key: 'assets', label: 'Assets folder', empty: 'The assets folder in your workspace' },
  { key: 'resources', label: 'App resources folder', empty: 'Bundled with Builder Studio' }
]

export function Advanced({ settings }: { settings: Settings }): ReactElement {
  const navigate = useNavigate()
  const found = useLocations()
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-8">
      <SettingsPanel>
        <SettingsRow
          title="Documentation"
          detail="How every screen and setting works, from setup to export."
        >
          <Button variant="outline" onClick={() => void navigate({ to: '/docs' })}>
            Open
          </Button>
        </SettingsRow>
        {import.meta.env.DEV && (
          <SettingsRow
            title={
              <span className="flex flex-wrap items-center gap-2">
                UI kit <Badge>Development build</Badge>
              </span>
            }
            detail="Every interface component in every state, in both themes."
          >
            <Button variant="outline" onClick={() => void navigate({ to: '/kit' })}>
              Open
            </Button>
          </SettingsRow>
        )}
      </SettingsPanel>
      <AvailabilityChecks
        repair={(name, step) => {
          void navigate({ to: '/settings', search: { section: REPAIR_SECTION[step] } })
          focusIssue(name)
        }}
      />
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="rounded-lg border border-border-default bg-surface-raised"
      >
        <CollapsibleTrigger className="focus-ring flex min-h-(--density-row) w-full cursor-pointer items-center gap-2 rounded-lg px-4 text-start font-medium text-fg">
          <ChevronRight
            aria-hidden
            className="size-4 text-fg-muted transition-transform duration-fast motion-reduce:transition-none data-[open=true]:rotate-90 rtl:-scale-x-100"
            data-open={open}
          />
          Custom program and folder locations
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 px-4 pb-4">
          <InlineNotice tone="warning" className="text-sm">
            Only change these if you were asked to. An empty field uses the detected location shown
            in gray. Fields save when you leave them.
          </InlineNotice>
          {FIELDS.map(({ key, label, empty, hint }) => (
            <Field key={key} id={`setting-${key}`} label={label} hint={hint}>
              <SettingInput
                setting={key}
                value={settings[key]}
                placeholder={found[key] || empty}
                onBlurOnly
              />
            </Field>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
