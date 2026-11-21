// Layout helpers for kit sections: a labelled specimen and a wrapping row of them.
import type { ReactElement, ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/** One example with a small caption naming its state ("hover", "disabled", "RTL"). */
export function Specimen({
  label,
  children,
  className
}: {
  label: string
  children: ReactNode
  className?: string
}): ReactElement {
  return (
    <figure className={cn('flex min-w-0 flex-col items-start gap-2', className)}>
      <figcaption className="text-2xs text-fg-muted">{label}</figcaption>
      {children}
    </figure>
  )
}

/** A titled group of specimens that wraps on narrow windows. */
export function Specimens({
  title,
  children,
  className
}: {
  title?: string
  children: ReactNode
  className?: string
}): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      {title && <h3 className="text-xs text-fg-secondary">{title}</h3>}
      <div className={cn('flex flex-wrap items-start gap-x-6 gap-y-4', className)}>{children}</div>
    </div>
  )
}

/** Usage guidance under a section's specimens. */
export function Guidance({ children }: { children: ReactNode }): ReactElement {
  return <p className="max-w-prose text-sm text-fg-muted">{children}</p>
}

// Forced states for static specimens; the live controls beside them show the real thing.
export const forceFocus =
  'outline-(length:--focus-width) outline-offset-(--focus-offset) outline-focus'

/** Long text for overflow and truncation specimens. */
export const LONG =
  'Northern watchtower with spiral stair, copper roof and a lantern on every landing (revision 14)'
/** Hebrew text for right-to-left specimens. */
export const RTL_TEXT = 'מגדל שמירה צפוני'
