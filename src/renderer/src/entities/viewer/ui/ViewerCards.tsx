// Cards over the 3D view: loading (determinate or not) on a light scrim, and the error card with a
// details disclosure.
import type { ReactElement, ReactNode } from 'react'
import { CircleAlert, Loader2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { focusRing } from '@/shared/ui/common/styles'
import { ViewerOverlay } from './ViewerOverlay'

export function ViewerLoadingCard({
  label,
  value,
  progressLabel = 'Loading preview'
}: {
  /** What is loading, e.g. "Loading texture pack…". */
  label: string
  /** 0 to 1; leave out while the size of the work is unknown. */
  value?: number
  progressLabel?: string
}): ReactElement {
  const pct = value === undefined ? undefined : Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className="absolute inset-0 z-floating flex items-center justify-center bg-surface-viewer/40">
      <ViewerOverlay className="w-[18.75rem] max-w-[calc(100%-1.5rem)] space-y-2.5 px-4 py-3.5">
        <div role="status" className="flex items-center gap-2">
          <Loader2
            aria-hidden="true"
            className="size-3.5 shrink-0 animate-spin text-accent-text motion-reduce:animate-none"
          />
          <span className="truncate">{label}</span>
          {pct !== undefined && (
            <span aria-hidden="true" className="ml-auto text-fg-muted tabular-nums">
              {pct}%
            </span>
          )}
        </div>
        <div
          role="progressbar"
          aria-label={progressLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-1 overflow-hidden rounded-full bg-surface-active"
        >
          {pct !== undefined ? (
            <div
              className="h-full rounded-full bg-accent-solid transition-[width] duration-slow ease-standard"
              style={{ width: `${pct}%` }}
            />
          ) : (
            <div className="viewer-sweep h-full w-1/3 rounded-full bg-accent-solid" />
          )}
        </div>
      </ViewerOverlay>
    </div>
  )
}

export function ViewerErrorCard({
  title,
  details,
  actions,
  className
}: {
  /** What failed, in the user's words: "The preview couldn’t be completed". */
  title: string
  /** The raw error, behind Show details. */
  details?: string
  /** Recovery, e.g. a Retry button. */
  actions?: ReactNode
  className?: string
}): ReactElement {
  return (
    <ViewerOverlay
      role="alert"
      className={cn(
        'absolute top-14 left-1/2 z-floating flex w-[27.5rem] max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-start gap-3 border-danger-subtle-border px-4 py-3.5',
        className
      )}
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-danger-text" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">{title}</p>
        {details && (
          <details className="text-fg-secondary">
            <summary
              className={cn(
                'flex min-h-(--density-control-sm) cursor-pointer items-center rounded-sm',
                focusRing
              )}
            >
              Show details
            </summary>
            <p className="max-h-32 overflow-auto font-mono text-sm break-words select-text">
              {details}
            </p>
          </details>
        )}
        {actions && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
      </div>
    </ViewerOverlay>
  )
}
