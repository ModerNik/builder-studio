import type { ReactElement } from 'react'
import { cn } from '@/shared/lib/utils'
import { STATE, type JobState } from './state'

/** A job or agent state as a small shape in its colour, with the state's name for screen readers. */
export function StatusDot({
  state,
  label,
  className
}: {
  state: JobState
  /** Spoken name; the state's own label by default. Pass "" when visible text already says it. */
  label?: string
  className?: string
}): ReactElement {
  const { icon: Icon, fg, label: name } = STATE[state]
  const spoken = label ?? name
  return (
    <span className={cn('inline-flex shrink-0', fg, className)} data-state={state}>
      <Icon
        aria-hidden
        className={cn('size-3.5', state === 'running' && 'motion-safe:animate-spin')}
        strokeWidth={2.25}
      />
      {spoken && <span className="sr-only">{spoken}</span>}
    </span>
  )
}
