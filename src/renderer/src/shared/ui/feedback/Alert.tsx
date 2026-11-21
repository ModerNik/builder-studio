import type { ReactElement, ReactNode } from 'react'
import { CircleCheck, Info, OctagonAlert, TriangleAlert, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { TONE } from '@/shared/ui/status/state'
import { IconAction } from '@/shared/ui/common/Tip'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

export const ALERT_ICON: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: OctagonAlert
}

// One text line tall with a text baseline (its zero-width space), so the alert's baseline alignment keeps the icon
// and Dismiss level with the first line of text, also when an action on that row pushes the text down.
const FIRST_LINE = 'flex min-h-[1lh] shrink-0 items-center'

/**
 * A message about a whole view or panel. callout sits in the content as a tinted box; banner runs edge to
 * edge across the top of a page or dock. Warnings and dangers are announced at once (role alert),
 * info and success politely.
 */
export function Alert({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
  variant = 'callout',
  icon,
  className
}: {
  tone?: AlertTone
  title?: string
  children?: ReactNode
  action?: ReactNode
  onDismiss?: () => void
  variant?: 'callout' | 'banner'
  icon?: LucideIcon
  className?: string
}): ReactElement {
  const Icon = icon ?? ALERT_ICON[tone]
  const t = TONE[tone]
  return (
    <div
      role={tone === 'warning' || tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-baseline gap-2.5 text-fg',
        t.bg,
        variant === 'callout'
          ? cn('rounded-lg border px-3 py-2.5', t.border)
          : cn('border-b px-4 py-2', t.border),
        className
      )}
    >
      <span className={FIRST_LINE}>
        {'\u200b'}
        <Icon aria-hidden className={cn('size-4', t.text)} />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-[1_1_16rem] wrap-anywhere">
          {title && <p className="font-medium">{title}</p>}
          {children && <div className="text-pretty text-fg-secondary">{children}</div>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </div>
      {onDismiss && (
        <span className={cn(FIRST_LINE, '-mr-1')}>
          {'\u200b'}
          <IconAction label="Dismiss" icon={X} size="xs" className="-my-0.5" onClick={onDismiss} />
        </span>
      )}
    </div>
  )
}

/** A one-line status beside a control or under a field: icon and text in the tone's colour. */
export function InlineNotice({
  tone = 'info',
  children,
  className
}: {
  tone?: AlertTone
  children: ReactNode
  className?: string
}): ReactElement {
  const Icon = ALERT_ICON[tone]
  return (
    <p
      role={tone === 'danger' ? 'alert' : undefined}
      className={cn('flex items-start gap-1.5 text-base', TONE[tone].text, className)}
    >
      <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
      <span className="min-w-0 text-pretty wrap-anywhere">{children}</span>
    </p>
  )
}
