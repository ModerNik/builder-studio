// Glass over the 3D view (`.viewer-overlay`: overlay surface at 92%, hairline, md shadow), the stage it
// floats on, the floating toolbar and tool rail that keep clear of the axis gizmo, and the transient status pill.
import './viewer.css'
import { useEffect, useState, type ComponentProps, type ReactElement, type ReactNode } from 'react'
import { Toolbar } from 'radix-ui'
import { cn } from '@/shared/lib/utils'
import { viewerToolButton } from '../model/styles'

/** The viewer's backdrop: pure grey (True Block Rule), the positioning context for every overlay. */
export function ViewerStage({ className, ...rest }: ComponentProps<'div'>): ReactElement {
  return (
    <div
      className={cn(
        'viewer-stage relative isolate h-full w-full overflow-hidden bg-surface-viewer',
        className
      )}
      {...rest}
    />
  )
}

export function ViewerOverlay({ className, ...rest }: ComponentProps<'div'>): ReactElement {
  return <div className={cn('viewer-overlay text-fg', className)} {...rest} />
}

/**
 * A floating toolbar. Horizontal, it runs along the top from the tool rail to the axis gizmo and wraps on a
 * narrow stage instead of sliding under either. Vertical, it is the tool rail down the start edge, and the
 * stage makes room for it (`--viewer-rail-size`). Arrow keys move between its controls.
 */
export function ViewerToolbar({
  label,
  orientation = 'horizontal',
  className,
  children
}: {
  label: string
  orientation?: 'horizontal' | 'vertical'
  className?: string
  children: ReactNode
}): ReactElement {
  const vertical = orientation === 'vertical'
  return (
    <div
      className={cn(
        'pointer-events-none absolute top-(--viewer-inset) z-floating flex',
        vertical
          ? 'viewer-rail bottom-(--viewer-inset) left-(--viewer-inset) flex-col items-start'
          : 'right-[calc(var(--viewer-gizmo-size)+2*var(--viewer-inset))] left-[calc(var(--viewer-inset)+var(--viewer-rail-size))]'
      )}
    >
      <Toolbar.Root
        aria-label={label}
        orientation={orientation}
        className={cn(
          'viewer-overlay pointer-events-auto flex gap-0.5 p-1 text-fg',
          // a short stage scrolls the rail; a scrollbar would widen it past --viewer-rail-size
          vertical
            ? 'min-h-0 flex-col overflow-y-auto [scrollbar-width:none]'
            : 'min-w-0 flex-wrap items-center',
          className
        )}
      >
        {children}
      </Toolbar.Root>
    </div>
  )
}

export function ViewerToolbarButton({
  className,
  ...rest
}: ComponentProps<typeof Toolbar.Button>): ReactElement {
  return <Toolbar.Button className={cn(viewerToolButton, className)} {...rest} />
}
export function ViewerToolbarSeparator(): ReactElement {
  // Radix turns the separator across the toolbar: vertical in a row, horizontal in the rail
  return (
    <Toolbar.Separator className="shrink-0 self-center bg-border-default data-[orientation=horizontal]:my-1 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-4 data-[orientation=vertical]:mx-1 data-[orientation=vertical]:h-4 data-[orientation=vertical]:w-px" />
  )
}

/** A segmented choice inside a viewer toolbar (3D / Preview / Compare, Blocks / Parts). */
export function ViewerSegmented<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: T
  options: { value: T; label: string; keys?: string }[]
  onChange: (value: T) => void
}): ReactElement {
  return (
    <Toolbar.ToggleGroup
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      className="flex rounded-md bg-surface-sunken p-0.5"
    >
      {options.map((o) => (
        <Toolbar.ToggleItem
          key={o.value}
          value={o.value}
          title={o.keys ? `${o.label} (${o.keys})` : o.label}
          className={cn(
            viewerToolButton,
            'h-[calc(var(--density-control-sm)-0.25rem)] data-[state=on]:bg-surface-active data-[state=on]:text-fg'
          )}
        >
          {o.label}
        </Toolbar.ToggleItem>
      ))}
    </Toolbar.ToggleGroup>
  )
}

/**
 * The transient centred pill ("Southeast", "Isometric"): shows each new message for 1.6s. Pass a new
 * `at` (e.g. Date.now()) to show the same message again.
 */
export function ViewerStatusToast({
  message,
  at
}: {
  message: string | null
  at: number
}): ReactElement {
  const [doneAt, setDoneAt] = useState(0)
  useEffect(() => {
    if (!message) return
    const id = setTimeout(() => setDoneAt(at), 1600)
    return () => clearTimeout(id)
  }, [message, at])
  const shown = !!message && doneAt !== at
  return (
    <div
      role="status"
      className={cn(
        'viewer-overlay pointer-events-none absolute top-(--viewer-inset) left-1/2 z-floating flex h-7 -translate-x-1/2 items-center rounded-full px-3 text-xs font-medium text-fg-secondary',
        'transition-opacity duration-base ease-standard',
        shown ? 'opacity-100' : 'opacity-0'
      )}
    >
      {message}
    </div>
  )
}
