import type { ReactElement, ReactNode } from 'react'
import { ChevronDown, Square } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { cn } from '@/shared/lib/utils'
import { formatElapsed } from '@/shared/ui/common/time'
import { useCopy } from '@/shared/ui/common/copy'
import { StageBar } from './JobStageIndicator'
import type { JobState } from './state'
import { StatusDot } from './StatusDot'
import { stageProgress, type Stage } from './stages'

/**
 * The activity bar under the view: the latest job's state line, the version's size, its paste
 * position (click copies it), Stop while running, and the toggle for the full job log.
 */
export function JobStrip({
  title,
  state,
  stages,
  current,
  seconds,
  dims,
  paste,
  extra,
  open,
  onToggle,
  onStop,
  className
}: {
  /** The job's name, "Draft generation"; omit when no job has run ("Ready"). */
  title?: string
  state: JobState
  stages?: Stage[]
  current?: string | null
  seconds?: number
  /** Width × height × depth in blocks. */
  dims?: [number, number, number]
  /** World position of the min corner. */
  paste?: [number, number, number]
  extra?: ReactNode
  open?: boolean
  onToggle?: () => void
  onStop?: () => void
  className?: string
}): ReactElement {
  const { copied, copy } = useCopy()
  const running = state === 'running'
  const p = stages ? stageProgress(stages, current, state) : null
  const label = !title
    ? 'Ready'
    : running
      ? (p?.label ?? 'Working')
      : state === 'failed'
        ? `${title} failed`
        : state === 'cancelled'
          ? `${title} stopped`
          : state === 'queued'
            ? `${title} queued`
            : `${title} complete${seconds !== undefined ? ` in ${formatElapsed(seconds)}` : ''}`
  return (
    <footer
      className={cn(
        'relative flex min-h-10 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-default bg-surface-panel px-3 py-1 text-sm text-fg-secondary',
        className
      )}
      aria-busy={running}
    >
      {running && stages && (
        <StageBar
          stages={stages}
          current={current}
          state={state}
          label={title ?? 'Job'}
          className="absolute inset-x-0 top-0 h-0.5 gap-px [&>span]:rounded-none"
        />
      )}
      <span className="flex min-w-0 items-center gap-2">
        <StatusDot state={title ? state : 'idle'} label="" />
        <span
          role="status"
          aria-live="polite"
          className={cn(
            'truncate',
            running && 'text-accent-text',
            state === 'failed' && 'text-danger-text'
          )}
        >
          {label}
        </span>
        {running && p && p.index >= 0 && (
          <span className="shrink-0 text-fg-muted tabular-nums">
            {p.index + 1}/{p.total}
          </span>
        )}
        {running && seconds !== undefined && (
          <span className="shrink-0 font-mono text-fg-muted tabular-nums">
            {formatElapsed(seconds)}
          </span>
        )}
      </span>
      {dims && (
        <span className="font-mono tabular-nums" title="Width × height × depth, in blocks">
          {dims.join(' × ')} blocks
        </span>
      )}
      {paste && (
        <button
          type="button"
          className="min-h-(--density-control-sm) rounded-sm px-1 transition-colors duration-(--dur-fast) hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
          onClick={() => copy(paste.join(' '))}
          title="Copy paste position"
        >
          {copied ? (
            <span className="text-success-text">Paste position copied</span>
          ) : (
            <>
              Paste at <span className="font-mono tabular-nums">{paste.join(', ')}</span>
            </>
          )}
        </button>
      )}
      {extra}
      <span className="flex-1" />
      {running && onStop && (
        <Button
          size="sm"
          variant="ghost"
          className="h-(--density-control-sm) text-danger-text hover:bg-danger-subtle hover:text-danger-text"
          onClick={onStop}
        >
          <Square aria-hidden /> Stop
        </Button>
      )}
      {onToggle && (
        <Button
          size="sm"
          variant="ghost"
          className="h-(--density-control-sm)"
          aria-expanded={open}
          onClick={onToggle}
        >
          {open ? 'Hide details' : 'View details'}
          <ChevronDown
            aria-hidden
            className={cn(
              'size-3.5 transition-transform duration-(--dur-base)',
              open && 'rotate-180'
            )}
          />
        </Button>
      )}
    </footer>
  )
}
