import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'

type ProgressProps = Omit<React.ComponentProps<typeof ProgressPrimitive.Root>, 'value'> & {
  /** 0..max, or null for work of unknown length (a sweeping bar). */
  value: number | null
  /** Shown above the bar and used as the accessible name. */
  label?: React.ReactNode
  /** Shows the percentage (determinate) beside the label. */
  showValue?: boolean
  tone?: 'accent' | 'success' | 'danger'
}

const tones = { accent: 'bg-accent-solid', success: 'bg-success-solid', danger: 'bg-danger-solid' }

/** A determinate or indeterminate bar. Without a label, pass aria-label. */
function Progress({
  className,
  value,
  max = 100,
  label,
  showValue = false,
  tone = 'accent',
  ...props
}: ProgressProps): React.ReactElement {
  const id = React.useId()
  const pct = value == null ? null : Math.round((Math.min(max, Math.max(0, value)) / max) * 100)
  return (
    <div data-slot="progress-group" className={cn('flex w-full min-w-0 flex-col gap-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-baseline justify-between gap-3 text-sm">
          {label && (
            <span id={id} className="min-w-0 truncate text-fg-secondary">
              {label}
            </span>
          )}
          {showValue && (
            <span className="shrink-0 font-mono text-fg-muted tabular-nums">
              {pct == null ? 'Working…' : `${pct}%`}
            </span>
          )}
        </div>
      )}
      <ProgressPrimitive.Root
        data-slot="progress"
        value={value}
        max={max}
        aria-labelledby={label ? id : undefined}
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-active"
        {...props}
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className={cn(
            'h-full rounded-full',
            tones[tone],
            pct == null
              ? 'animate-progress-sweep w-2/5'
              : 'w-full -translate-x-(--progress-rest) transition-[translate] duration-slow ease-standard rtl:translate-x-(--progress-rest)'
          )}
          style={
            pct == null ? undefined : ({ '--progress-rest': `${100 - pct}%` } as React.CSSProperties)
          }
        />
      </ProgressPrimitive.Root>
    </div>
  )
}

export { Progress, type ProgressProps }
