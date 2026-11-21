// Layout helpers for the app-composite kit sections (not a section itself: ./sections only holds sections).
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/** A sub-heading inside a section, one per component. */
export function Sub({
  title,
  note,
  children
}: {
  title: string
  note?: ReactNode
  children: ReactNode
}): ReactElement {
  return (
    <div className="mb-8 flex flex-col gap-3">
      <div>
        <h3 className="text-md text-fg">{title}</h3>
        {note && <p className="max-w-prose text-sm text-fg-muted">{note}</p>}
      </div>
      {children}
    </div>
  )
}

/** Specimens side by side, wrapping to fit. */
export function Grid({
  children,
  min = '18rem',
  className
}: {
  children: ReactNode
  min?: string
  className?: string
}): ReactElement {
  return (
    <div
      className={cn('grid gap-3', className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))` }}
    >
      {children}
    </div>
  )
}

/** One labelled specimen on the panel surface. */
export function Cell({
  label,
  children,
  className,
  surface = 'panel'
}: {
  label: string
  children: ReactNode
  className?: string
  surface?: 'panel' | 'bg' | 'none'
}): ReactElement {
  return (
    <figure className="flex min-w-0 flex-col gap-1.5">
      <figcaption className="text-xs text-fg-muted">{label}</figcaption>
      <div
        className={cn(
          'min-w-0 rounded-lg border border-border-subtle',
          surface === 'panel' && 'bg-surface-panel p-3',
          surface === 'bg' && 'bg-surface p-3',
          className
        )}
      >
        {children}
      </div>
    </figure>
  )
}

// the coarse-pointer density tokens (main.css), applied to one subtree so both densities show side by side
const TOUCH = {
  '--density-control': '2.75rem',
  '--density-control-sm': '2.5rem',
  '--density-row': '3rem',
  '--density-icon-button': '2.75rem',
  '--density-gap': '0.75rem',
  '--density-text': '1rem'
} as CSSProperties

/** Renders children at touch density (2.75rem controls, 3rem rows). */
export function Touch({ children }: { children: ReactNode }): ReactElement {
  return <div style={TOUCH}>{children}</div>
}

/** A narrow frame (phone width, in rem) to show wrapping and stacking. */
export function Narrow({
  children,
  width = 21.25
}: {
  children: ReactNode
  width?: number
}): ReactElement {
  return (
    <div className="max-w-full overflow-hidden" style={{ width: `${width}rem` }}>
      {children}
    </div>
  )
}
