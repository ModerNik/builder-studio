import type { ReactElement } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { StatusDot } from '@/shared/ui/status/StatusDot'
import { IconAction } from '@/shared/ui/common/Tip'

/**
 * A thread in the thread picker: its state (working, live, closed), title, build, and whether it waits
 * for approval or has replies the user has not read. Close ends its agent; the session stays listed.
 */
export function ThreadListItem({
  title,
  build,
  state,
  awaiting = false,
  unread = false,
  active = false,
  updated,
  onSelect,
  onClose
}: {
  title: string
  build: string
  /** busy: on a turn; live: holds a session; off: closed. */
  state: 'busy' | 'live' | 'off'
  awaiting?: boolean
  unread?: boolean
  active?: boolean
  updated?: string
  onSelect: () => void
  onClose?: () => void
}): ReactElement {
  return (
    <div
      className={cn(
        'group relative flex min-h-(--density-row) min-w-0 items-center gap-2 rounded-md pr-1 pl-2 transition-colors duration-(--dur-fast) hover:bg-surface-hover',
        active && 'bg-surface-active hover:bg-surface-active'
      )}
    >
      <button
        type="button"
        aria-current={active ? 'true' : undefined}
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-md text-left outline-hidden after:absolute after:inset-0 after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-focus"
      >
        {state === 'busy' ? (
          <StatusDot state="running" label="Working" />
        ) : state === 'live' ? (
          <StatusDot state="done" label="Live session" />
        ) : (
          <StatusDot state="idle" label="Closed" />
        )}
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            unread ? 'font-semibold text-fg' : 'text-fg-secondary',
            active && 'text-fg'
          )}
        >
          {title}
        </span>
        {unread && (
          <span className="size-1.5 shrink-0 rounded-full bg-accent-solid">
            <span className="sr-only">Unread replies</span>
          </span>
        )}
      </button>
      {awaiting && (
        <StatusBadge state="awaiting-approval" className="relative">
          Awaiting approval
        </StatusBadge>
      )}
      <span className="max-w-24 shrink-0 truncate font-mono text-2xs text-fg-muted">{build}</span>
      {updated && (
        <span className="shrink-0 font-mono text-2xs text-fg-muted tabular-nums max-sm:hidden">
          {updated}
        </span>
      )}
      {onClose && (
        <IconAction
          label={`Close ${title}`}
          tip="Close: ends its agent, the session stays in the list"
          icon={X}
          size="xs"
          className="relative opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
          onClick={onClose}
        />
      )}
    </div>
  )
}
