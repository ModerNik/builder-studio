import type { ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import { Progress } from '@/shared/ui/primitives/progress'
import { Alert } from '@/shared/ui/feedback/Alert'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { Checklist, ChecklistRow } from '@/shared/ui/data/progress'
import { useAvailability } from '@/entities/availability/model/availability'
import type { RuntimeDelivery, RuntimeState } from '@shared/api'
import { StepHeader } from './parts'
import { cancelRuntime } from '@/entities/availability/model/availability'

const TOOLS = [
  { key: 'engine', title: 'Build engine', text: 'Generates and checks builds.' },
  { key: 'git', title: 'Git', text: 'Keeps a history of every build version.' },
  {
    key: 'browser',
    title: 'Preview browser',
    text: 'Uses Microsoft Edge, or downloads Chromium if needed.'
  },
  {
    key: 'identity',
    title: 'Build history',
    text: 'Keeps your existing name or uses a local default. Change it later in Settings.'
  }
] as const

export function BuildTools({
  state,
  pending,
  error,
  delivery,
  prepare
}: {
  state: RuntimeState
  pending: boolean
  error: Error | null
  delivery?: RuntimeDelivery
  prepare: () => void
}): ReactElement {
  const checks = useAvailability()
  const busy = pending || state.busy
  const percent = state.total ? Math.round((100 * (state.received || 0)) / state.total) : null
  const failed = error || checks.error
  return (
    <div className="flex flex-col gap-6">
      <StepHeader eyebrow="Step 3 of 6" title="Prepare build tools">
        We check your tools and prepare anything missing. Your existing tools and builds are kept.
      </StepHeader>
      <Checklist
        label="Build tools"
        className="rounded-lg border border-border-default bg-surface-raised px-4"
      >
        {TOOLS.map(({ key, title, text }) => {
          const item = checks.data?.requirements[key]
          return (
            <ChecklistRow
              key={key}
              label={title}
              status={
                item?.ok
                  ? 'done'
                  : busy && state.action === key
                    ? 'running'
                    : !busy && failed
                      ? 'failed'
                      : 'idle'
              }
              detail={item?.ok ? item.detail : <span className="font-sans">{text}</span>}
            />
          )
        })}
      </Checklist>
      {delivery && (
        <p className="text-sm text-fg-secondary">
          {delivery.mode === 'bundled'
            ? 'Engine and Git are included in this installer.'
            : 'Engine and Git download if needed.'}
        </p>
      )}
      {busy && (
        <div className="flex flex-col gap-2">
          <Progress value={percent} aria-label="Preparing build tools" />
          <div className="flex items-center justify-between gap-3">
            <p role="status" className="text-sm text-fg-secondary">
              {state.busy ? state.stage : 'Checking build tools…'}
              {percent !== null && ` · ${percent}%`}
            </p>
            <Button variant="ghost" onClick={cancelRuntime}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {!busy && failed && (
        <Alert tone="danger" title="Preparation didn’t finish">
          {errorMessage(failed).replace(/[^.!?]$/, '$&.')} You can retry; completed installations
          are kept.
        </Alert>
      )}
      {!busy && (
        <Button variant="outline" className="self-start" onClick={() => prepare()}>
          {failed ? 'Retry preparation' : 'Check tools again'}
        </Button>
      )}
    </div>
  )
}
