import type { ReactElement, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/**
 * What is (or will be) here, why it is empty and the next useful action.
 * first-run: invite the first step; no-results: a search or filter found nothing; error: it failed to load.
 * size page centres it in a screen, under the screen's h1, so its title is an h2; panel in a dock or
 * list, an h3.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  secondary,
  variant = 'first-run',
  size = 'panel',
  className
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
  secondary?: ReactNode
  variant?: 'first-run' | 'no-results' | 'error'
  size?: 'page' | 'panel'
  className?: string
}): ReactElement {
  const page = size === 'page'
  const Title = page ? 'h2' : 'h3'
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'mx-auto flex w-full flex-col items-center text-center',
        page ? 'max-w-md gap-3 px-4 py-16' : 'max-w-sm gap-2 px-4 py-8',
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mb-1 grid place-items-center rounded-lg border',
          page ? 'size-12' : 'size-10',
          variant === 'error'
            ? 'border-danger-subtle-border bg-danger-subtle text-danger-text'
            : 'border-border-subtle bg-surface-sunken text-fg-muted'
        )}
      >
        <Icon className={page ? 'size-6' : 'size-5'} strokeWidth={1.75} />
      </span>
      <Title className={cn('text-balance text-fg', page ? 'text-xl' : 'text-md')}>{title}</Title>
      {children && (
        <div className={cn('text-pretty text-fg-secondary', page ? 'text-base' : 'text-sm')}>
          {children}
        </div>
      )}
      {(action || secondary) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      )}
    </div>
  )
}
