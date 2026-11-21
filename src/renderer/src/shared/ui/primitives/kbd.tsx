import * as React from 'react'
import { cn } from '@/shared/lib/utils'

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>): React.ReactElement {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm border border-border-default bg-surface-sunken px-1 font-mono text-2xs text-fg-secondary tabular-nums',
        className
      )}
      {...props}
    />
  )
}

/** A key combination such as "Ctrl+K" or "Ctrl+Shift+P" as separate keys. */
function Shortcut({
  keys,
  className,
  ...props
}: Omit<React.ComponentProps<'kbd'>, 'children'> & { keys: string }): React.ReactElement {
  const parts = keys === '+' ? ['+'] : keys.split(/\+(?!$)/)
  return (
    <kbd
      data-slot="shortcut"
      aria-label={parts.join(' ')}
      className={cn('inline-flex items-center gap-0.5 font-sans', className)}
      {...props}
    >
      {parts.map((k, i) => (
        <Kbd key={i} aria-hidden>
          {k}
        </Kbd>
      ))}
    </kbd>
  )
}

/** An action name with its shortcut, for empty states and hints: "Open palette  Ctrl K". */
function ShortcutHint({
  keys,
  children,
  className,
  ...props
}: React.ComponentProps<'span'> & { keys: string }): React.ReactElement {
  return (
    <span
      data-slot="shortcut-hint"
      className={cn('inline-flex items-center gap-2 text-sm text-fg-muted', className)}
      {...props}
    >
      {children}
      <Shortcut keys={keys} />
    </span>
  )
}

export { Kbd, Shortcut, ShortcutHint }
