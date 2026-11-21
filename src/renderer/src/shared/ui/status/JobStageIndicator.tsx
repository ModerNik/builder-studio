import type { ReactElement } from 'react'
import { Square } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { cn } from '@/shared/lib/utils'
import { formatElapsed } from '@/shared/ui/common/time'
import type { JobState } from './state'
import { StatusDot } from './StatusDot'
import '@/shared/ui/common/composites.css'
import { stageProgress, type SegmentState, type Stage } from './stages'

const SEGMENT: Record<SegmentState, string> = {
  done: 'bg-accent-solid',
  current: 'stage-sweep bg-accent-subtle-border',
  failed: 'bg-danger-solid',
  pending: 'bg-surface-active'
}

/** The staged bar alone: one segment per stage. */
export function StageBar({
  stages,
  current,
  state,
  label,
  className
}: {
  stages: Stage[]
  current?: string | null
  state: JobState
  /** The job's name, as the progress bar's accessible name. */
  label: string
  className?: string
}): ReactElement {
  const p = stageProgress(stages, current, state)
  const done = p.segments.filter((s) => s === 'done').length
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={p.total}
      aria-valuenow={done}
      aria-valuetext={`${p.label}, ${done} of ${p.total} stages done`}
      className={cn('flex h-1 gap-0.5', className)}
    >
      {p.segments.map((s, i) => (
        <span
          key={stages[i].id}
          className={cn(
            'h-full min-w-2 flex-1 rounded-full transition-colors duration-(--dur-slow) ease-standard',
            state === 'done' ? 'bg-success-solid' : SEGMENT[s]
          )}
        />
      ))}
    </div>
  )
}

/**
 * A staged job: the current stage's label, step n of N, elapsed time, a segmented bar and Stop.
 * The label line is a polite live region, so stage changes are announced; the timer is not.
 */
export function JobStageIndicator({
  title,
  stages,
  current,
  state,
  seconds,
  onStop,
  className
}: {
  /** The job's name: "Draft generation", "Full build". */
  title: string
  stages: Stage[]
  current?: string | null
  state: JobState
  /** Elapsed (running) or total (finished) seconds. */
  seconds?: number
  onStop?: () => void
  className?: string
}): ReactElement {
  const p = stageProgress(stages, current, state)
  const running = state === 'running'
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)} aria-busy={running}>
      <div className="flex min-h-(--density-control-sm) min-w-0 items-center gap-2">
        <StatusDot state={state} label="" />
        <div
          role="status"
          aria-live="polite"
          className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2"
        >
          <span className="truncate font-medium">
            {running || state === 'queued' ? p.label : `${title}: ${p.label.toLowerCase()}`}
          </span>
          {running && p.index >= 0 && (
            <span className="shrink-0 text-sm text-fg-muted tabular-nums">
              step {p.index + 1} of {p.total}
            </span>
          )}
        </div>
        {seconds !== undefined && (
          <span className="shrink-0 font-mono text-sm text-fg-muted tabular-nums">
            {formatElapsed(seconds)}
          </span>
        )}
        {running && onStop && (
          <Button
            size="xs"
            variant="ghost"
            className="h-(--density-control-sm) shrink-0 text-danger-text hover:bg-danger-subtle hover:text-danger-text"
            onClick={onStop}
          >
            <Square aria-hidden /> Stop
          </Button>
        )}
      </div>
      <StageBar stages={stages} current={current} state={state} label={title} />
    </div>
  )
}
