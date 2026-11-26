// Small pieces the shell, layout and viewer kits share: the focus ring, an icon button sized from the
// density tokens with the kit's Tooltip, and key caps.
import { forwardRef, type ComponentProps, type ReactElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { formatKeys } from '@/shared/lib/shortcuts'
import { Tip } from './Tip'
import { chromeButton } from './styles'

export type TabBadgeTone = 'neutral' | 'attention' | 'running' | 'danger'

/**
 * A count or a dot on a tab or panel toggle, with its meaning spelled out for screen readers.
 * `attention` is for asks waiting on the user ("Needs you"): amber; `running` is a glowing working
 * dot for a live build job; `danger` is for a failed job.
 */
export function TabBadge({
  badge,
  label,
  tone = 'neutral'
}: {
  badge: number | 'dot'
  label?: string
  tone?: TabBadgeTone
}): ReactElement {
  return badge === 'dot' ? (
    <span
      className={cn(
        tone === 'running'
          ? 'working-dot'
          : cn(
              'size-1.5 shrink-0 rounded-full',
              tone === 'attention'
                ? 'bg-warning-solid'
                : tone === 'danger'
                  ? 'bg-danger-solid'
                  : 'bg-accent-solid'
            )
      )}
      role="img"
      aria-label={label ?? 'Needs attention'}
    />
  ) : (
    <span
      className={cn(
        'min-w-4 rounded-full px-1 text-center text-2xs tabular-nums',
        tone === 'attention'
          ? 'bg-warning-solid font-semibold text-warning-on-solid'
          : tone === 'danger'
            ? 'bg-danger-solid font-semibold text-danger-on-solid'
            : 'bg-surface-active text-fg-secondary'
      )}
    >
      <span aria-hidden="true">{badge > 99 ? '99+' : badge}</span>
      <span className="sr-only">{label ?? badge}</span>
    </span>
  )
}

type IconButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  icon: LucideIcon
  label: string
  /** Shown in the tooltip after the label, e.g. `Ctrl+I`. */
  keys?: string
  /** Visible label beside the icon. */
  showLabel?: boolean
  /** Compact `sm` fits 44px chrome bars (32px fine, 40px touch); `default` is `--density-icon-button`. */
  size?: 'default' | 'sm'
}

/** An icon button with a label for assistive tech and a tooltip that names its shortcut. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, keys, showLabel, size = 'default', className, ...rest },
  ref
) {
  return (
    <Tip label={keys ? `${label} (${formatKeys(keys).join(' ')})` : label}>
      <button
        ref={ref}
        type="button"
        aria-label={showLabel ? undefined : label}
        aria-keyshortcuts={keys?.replaceAll('Ctrl', 'Control')}
        className={cn(
          chromeButton,
          size === 'sm'
            ? 'h-[max(2rem,var(--density-control-sm))] min-w-[max(2rem,var(--density-control-sm))]'
            : 'h-(--density-icon-button) min-w-(--density-icon-button)',
          showLabel && 'px-2',
          className
        )}
        {...rest}
      >
        <Icon aria-hidden="true" />
        {showLabel && <span>{label}</span>}
      </button>
    </Tip>
  )
})

/** Key caps for a shortcut; hidden on touch, where there is no keyboard to press them. */
export function Kbd({ keys, className }: { keys: string; className?: string }): ReactElement {
  return (
    <span className={cn('inline-flex gap-0.5 pointer-coarse:hidden', className)}>
      {formatKeys(keys).map((k) => (
        <kbd
          key={k}
          className="rounded-xs border border-border-default bg-surface-sunken px-1 font-mono text-2xs text-fg-muted"
        >
          {k}
        </kbd>
      ))}
    </span>
  )
}
