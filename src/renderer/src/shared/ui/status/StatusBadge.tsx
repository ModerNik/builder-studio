import type { ReactElement, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { STATE, TONE, type JobState, type Tone } from './state'
import { StatusDot } from './StatusDot'

type Props =
  | { state: JobState; children?: ReactNode; className?: string }
  | { tone: Tone; icon?: LucideIcon; children: ReactNode; className?: string }

/** A status as a chip: a job state (its shape and name), or a tone with your own text and icon. */
export function StatusBadge(props: Props): ReactElement {
  const base =
    'inline-flex h-5 max-w-full shrink-0 items-center gap-1 rounded-full px-2 text-xs whitespace-nowrap'
  if ('state' in props) {
    const s = STATE[props.state]
    return (
      <span className={cn(base, s.bg, s.fg, props.className)}>
        <StatusDot state={props.state} label="" className="[&_svg]:size-3" />
        <span className="truncate">{props.children ?? s.label}</span>
      </span>
    )
  }
  const { tone, icon: Icon, children, className } = props
  return (
    <span className={cn(base, TONE[tone].bg, TONE[tone].text, className)}>
      {Icon && <Icon aria-hidden className="size-3 shrink-0" strokeWidth={2.25} />}
      <span className="truncate">{children}</span>
    </span>
  )
}
