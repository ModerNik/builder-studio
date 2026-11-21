import type { ReactElement, ReactNode } from 'react'
import { ChevronRight, RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { cn } from '@/shared/lib/utils'
import { CopyButton } from '@/shared/ui/common/CopyButton'
import { errorDetails } from './errors'

/** "Technical details": the raw error behind a disclosure, selectable and copyable for a report. */
export function ErrorDetails({
  error,
  className
}: {
  error: unknown
  className?: string
}): ReactElement {
  const text = errorDetails(error)
  return (
    <details className={cn('group text-sm text-fg-secondary', className)}>
      <summary className="inline-flex min-h-(--density-control-sm) cursor-pointer list-none items-center gap-1 rounded-sm select-none hover:text-fg focus-visible:outline-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-3.5 transition-transform duration-(--dur-base) group-open:rotate-90"
        />
        Technical details
      </summary>
      <div className="relative mt-1 rounded-md border border-border-subtle bg-surface-sunken">
        <pre className="max-h-48 overflow-auto p-2 pr-10 font-mono text-sm break-words whitespace-pre-wrap select-text">
          {text}
        </pre>
        <CopyButton text={text} label="Copy details" size="xs" className="absolute top-1 right-1" />
      </div>
    </details>
  )
}

/**
 * Something failed: what failed (title), why and how to recover (children), a retry, and the raw
 * error behind Technical details. Inline in a panel, or centred when it replaces a whole view.
 */
export function ErrorState({
  title,
  children,
  error,
  onRetry,
  retryLabel = 'Try again',
  action,
  layout = 'inline',
  className
}: {
  title: string
  children?: ReactNode
  error?: unknown
  onRetry?: () => void
  retryLabel?: string
  action?: ReactNode
  layout?: 'inline' | 'centered'
  className?: string
}): ReactElement {
  const centered = layout === 'centered'
  return (
    <div
      role="alert"
      className={cn(
        'flex min-w-0 gap-3 wrap-anywhere',
        centered ? 'mx-auto max-w-md flex-col items-center px-4 py-12 text-center' : 'items-start',
        className
      )}
    >
      <TriangleAlert
        aria-hidden
        className={cn('shrink-0 text-danger-text', centered ? 'size-6' : 'mt-0.5 size-4')}
      />
      <div className={cn('flex min-w-0 flex-col gap-1', centered && 'items-center')}>
        <p className="font-medium text-fg">{title}</p>
        {children && <div className="text-pretty text-fg-secondary">{children}</div>}
        {(onRetry || action) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RotateCw aria-hidden /> {retryLabel}
              </Button>
            )}
            {action}
          </div>
        )}
        {error !== undefined && (
          <ErrorDetails error={error} className={cn('mt-1 w-full', centered && 'text-left')} />
        )}
      </div>
    </div>
  )
}
