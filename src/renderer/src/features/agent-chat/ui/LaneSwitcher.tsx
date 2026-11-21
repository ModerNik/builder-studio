// The Variants lane switcher: one button per lane, its letter and status, for jumping between lanes when
// more than fit. The screen scrolls the picked lane into view (desktop) or shows it alone (phone).
import type { ReactElement } from 'react'
import { cn } from '@/shared/lib/utils'
import { StatusDot } from '@/shared/ui/status/StatusDot'
import { STATE, type JobState } from '@/shared/ui/status/state'
import { focusRing } from '@/shared/ui/common/styles'
import { Tip } from '@/shared/ui/common/Tip'

export interface Lane {
  id: string
  /** "A", "B"… as on the lane header. */
  letter: string
  /** The variant's brief, e.g. "Spruce railings": the tooltip and the spoken name. */
  name: string
  state: JobState
}

export function LaneSwitcher({
  lanes,
  value,
  onChange,
  label = 'Lanes',
  className
}: {
  lanes: Lane[]
  /** The lane in view. */
  value?: string
  onChange: (id: string) => void
  label?: string
  className?: string
}): ReactElement {
  return (
    <ul
      aria-label={label}
      className={cn(
        'flex min-w-0 gap-1 overflow-x-auto rounded-lg bg-surface-sunken p-0.5',
        className
      )}
    >
      {lanes.map((l) => (
        <li key={l.id} className="shrink-0">
          <Tip label={l.name}>
            <button
              type="button"
              aria-current={l.id === value ? 'true' : undefined}
              aria-label={`Lane ${l.letter}: ${l.name}, ${STATE[l.state].label}`}
              onClick={() => onChange(l.id)}
              className={cn(
                focusRing,
                'flex h-(--density-control-sm) min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 font-mono text-sm font-semibold text-fg-secondary transition-colors duration-fast ease-standard can-hover:hover:bg-surface-hover can-hover:hover:text-fg',
                'aria-[current=true]:bg-surface-raised aria-[current=true]:text-fg aria-[current=true]:shadow-[inset_0_-2px_0_var(--color-accent-solid)]'
              )}
            >
              {l.letter}
              <StatusDot state={l.state} label="" />
            </button>
          </Tip>
        </li>
      ))}
    </ul>
  )
}
