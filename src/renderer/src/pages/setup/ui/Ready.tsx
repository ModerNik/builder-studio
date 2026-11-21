import type { ReactElement } from 'react'
import { Check, CircleCheck, CircleDashed, LoaderCircle, TriangleAlert } from 'lucide-react'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { SettingsPanel, SettingsRow } from '@/entities/settings/ui/Settings'
import type { Settings } from '@shared/api'
import { SETUP_REQUIREMENTS } from '@shared/availability'
import { StepHeader } from './parts'
import { STEPS } from '../model/steps'
import { useFreshAvailability } from '../model/setup'

const SUMMARY = ['workspace', 'runtime', 'minecraft', 'ai'] as const

export function Ready({
  skipped
}: {
  skipped: ReadonlySet<Settings['setup']['step']>
}): ReactElement {
  const availability = useFreshAvailability()
  const data = availability.data
  const ready = data && SETUP_REQUIREMENTS.every((r) => data.requirements[r].ok)
  return (
    <div className="flex flex-col gap-6">
      <span className="grid size-12 place-items-center rounded-full bg-accent-subtle">
        {ready ? (
          <Check className="size-6 text-accent-text" aria-hidden />
        ) : (
          <TriangleAlert className="size-6 text-warning-text" aria-hidden />
        )}
      </span>
      <StepHeader title={ready ? 'You’re ready to build' : 'Let’s finish getting ready'}>
        {ready
          ? 'Your folders and tools are ready. You can create and export builds; add Minecraft game files whenever you want the 3D view. AI can be connected later in Settings.'
          : 'Return to any step that needs attention. We check everything required before opening Builder Studio.'}
      </StepHeader>
      <SettingsPanel>
        {SUMMARY.map((step) => {
          const ok = data && STEPS[step].needs.every((r) => data.requirements[r].ok)
          return (
            <SettingsRow key={step} title={STEPS[step].label}>
              {!data ? (
                <StatusBadge tone="neutral" icon={LoaderCircle}>
                  {availability.isFetching ? 'Checking…' : 'Unknown'}
                </StatusBadge>
              ) : ok ? (
                <StatusBadge tone="success" icon={CircleCheck}>
                  Ready
                </StatusBadge>
              ) : skipped.has(step) ? (
                <StatusBadge tone="warning" icon={TriangleAlert}>
                  Skipped · in Settings
                </StatusBadge>
              ) : (
                <StatusBadge tone="neutral" icon={CircleDashed}>
                  Not set up
                </StatusBadge>
              )}
            </SettingsRow>
          )
        })}
      </SettingsPanel>
      {availability.error && (
        <InlineNotice tone="danger">{String(availability.error)}</InlineNotice>
      )}
    </div>
  )
}
