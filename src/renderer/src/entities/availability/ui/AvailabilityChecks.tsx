// Diagnostics in Settings › Advanced: every requirement checked again, the features they unlock, and a
// report to copy when asking for help.
import { type ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/shared/ui/primitives/collapsible'
import { Spinner } from '@/shared/ui/primitives/spinner'
import { Alert } from '@/shared/ui/feedback/Alert'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { Checklist, ChecklistRow } from '@/shared/ui/data/progress'
import { SettingsPanel, SettingsRow, SettingsSection } from '@/entities/settings/ui/Settings'
import type { Feature, Repair, Requirement } from '@shared/api'
import { ISSUES } from '../model/setupIssues'
import { useDiagnostics } from '../model/diagnostics'

const FEATURES: Record<Feature, string> = {
  browse: 'Open your builds',
  engine: 'Build checks and materials',
  viewer: '3D view',
  render: 'Preview images',
  proto: 'Drafts without previews',
  export: 'Export to Minecraft',
  ai: 'AI assistant',
  variants: 'Parallel variants',
  newBuild: 'New builds',
  commit: 'Saving build versions'
}
const requirementName = (name: Requirement): string => ISSUES[name].name

const time = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** Diagnostics: requirements (missing first) beside the features they unlock. */
export function AvailabilityChecks({
  repair
}: {
  repair: (name: Requirement, step: Repair) => void
}): ReactElement {
  const { checks, recheck, copy } = useDiagnostics()
  const data = checks.data
  const running = checks.isFetching || recheck.isPending
  const names = data ? (Object.keys(data.requirements) as Requirement[]) : []
  const ordered = [
    ...names.filter((n) => !data!.requirements[n].ok),
    ...names.filter((n) => data!.requirements[n].ok)
  ]
  const readyCount = names.filter((n) => data!.requirements[n].ok).length
  const features = data ? (Object.keys(data.features) as Feature[]) : []
  const available = features.filter((f) => data!.features[f].ok).length
  const error = checks.error ?? recheck.error ?? copy.error
  return (
    <SettingsSection
      id="h-diagnostics"
      title="Diagnostics"
      lead={`Check every requirement again, or copy a report to share when asking for help.${data ? ` Last checked ${time(data.checkedAt)}.` : ''}`}
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={running} onClick={() => recheck.mutate()}>
          {running && <Spinner />}
          {running ? 'Checking…' : 'Run checks'}
        </Button>
        <Button variant="ghost" disabled={!data || copy.isPending} onClick={() => copy.mutate()}>
          {copy.isSuccess ? 'Report copied' : 'Copy report'}
        </Button>
      </div>
      {error && (
        <Alert
          tone="danger"
          title="The checks couldn’t run."
          action={
            <Button size="sm" variant="outline" onClick={() => recheck.mutate()}>
              Try again
            </Button>
          }
        >
          {errorMessage(error)}
        </Alert>
      )}
      {data && readyCount === names.length && available === features.length && (
        <Alert tone="success">
          {`All ${names.length} requirements pass. Every feature is available.`}
        </Alert>
      )}
      {data && (
        <div className="@container">
          <div className="grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
            <section aria-labelledby="h-requirements" className="flex min-w-0 flex-col gap-2">
              <h3 id="h-requirements" className="flex items-baseline gap-2 font-medium">
                Requirements
                <span className="text-sm font-normal text-fg-secondary">
                  {readyCount} of {names.length} ready
                </span>
              </h3>
              <Checklist
                label="Requirements"
                className="rounded-lg border border-border-default bg-surface-raised px-4"
              >
                {ordered.map((name) => {
                  const item = data.requirements[name]
                  return (
                    <ChecklistRow
                      key={name}
                      label={requirementName(name)}
                      status={running ? 'running' : item.ok ? 'done' : 'failed'}
                      detail={
                        item.ok ? (
                          item.detail
                        ) : (
                          <Collapsible>
                            <CollapsibleTrigger className="focus-ring cursor-pointer rounded-sm font-sans text-fg-secondary underline underline-offset-2 can-hover:text-fg">
                              What the check found
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-1">{item.detail}</CollapsibleContent>
                          </Collapsible>
                        )
                      }
                      action={
                        !item.ok && (
                          <Button
                            size="sm"
                            variant={
                              ISSUES[name as keyof typeof ISSUES]?.install ? 'primary' : 'outline'
                            }
                            aria-label={`Set up: ${requirementName(name)}`}
                            onClick={() => repair(name, item.repair)}
                          >
                            Set up
                          </Button>
                        )
                      }
                    />
                  )
                })}
              </Checklist>
            </section>
            <section aria-labelledby="h-features" className="flex min-w-0 flex-col gap-2">
              <h3 id="h-features" className="flex items-baseline gap-2 font-medium">
                Features
                <span className="text-sm font-normal text-fg-secondary">
                  {available} of {features.length} available
                </span>
              </h3>
              <SettingsPanel>
                {features.map((name) => {
                  const feature = data.features[name]
                  return (
                    <SettingsRow
                      key={name}
                      title={FEATURES[name]}
                      detail={
                        feature.missing.length > 0 &&
                        `Needs: ${feature.missing.map(requirementName).join(', ')}`
                      }
                    >
                      <StatusBadge tone={feature.ok ? 'success' : 'warning'}>
                        {feature.ok ? 'Available' : 'Needs setup'}
                      </StatusBadge>
                    </SettingsRow>
                  )
                })}
              </SettingsPanel>
            </section>
          </div>
        </div>
      )}
    </SettingsSection>
  )
}
