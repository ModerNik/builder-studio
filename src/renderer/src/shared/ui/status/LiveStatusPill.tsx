import type { ReactElement, ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { STATE, type JobState } from './state'
import { StatusDot } from './StatusDot'

/**
 * What is live right now (engine, assistant, a job) as a pill for a toolbar or a dock header.
 * It is a polite live region, so a change of label is announced; with onClick it becomes a button.
 */
export function LiveStatusPill({
  state,
  label,
  detail,
  onClick,
  className
}: {
  state: JobState
  label: string
  /** Mono, tabular extra: an elapsed time, a count. */
  detail?: ReactNode
  onClick?: () => void
  className?: string
}): ReactElement {
  const live = state === 'running'
  const body = (
    <>
      {live ? (
        <span aria-hidden className="working-dot" />
      ) : (
        <StatusDot state={state} label="" className="[&_svg]:size-3" />
      )}
      <span className="truncate">{label}</span>
      {detail !== undefined && (
        <span className="font-mono text-2xs text-fg-muted tabular-nums">{detail}</span>
      )}
    </>
  )
  const cls = cn(
    'inline-flex h-5 max-w-full min-w-0 items-center gap-1.5 rounded-full border border-border-subtle px-2 text-xs whitespace-nowrap',
    live ? 'border-accent-subtle-border bg-accent-subtle text-accent-text' : STATE[state].fg,
    onClick &&
      'cursor-pointer transition-colors duration-(--dur-fast) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    className
  )
  return (
    <span role="status" aria-live="polite" className="inline-flex min-w-0">
      {onClick ? (
        <button type="button" className={cls} onClick={onClick}>
          {body}
        </button>
      ) : (
        <span className={cls}>{body}</span>
      )}
    </span>
  )
}
