import * as React from 'react'
import { cn } from '@/shared/lib/utils'

/** A raised, bordered block. Flat at rest: no shadow. Never nest cards. */
function Card({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-lg border border-border-default bg-surface-raised p-4 text-fg',
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'grid auto-rows-min grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1 *:not-data-[slot=card-action]:col-start-1',
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>): React.ReactElement {
  return <h3 data-slot="card-title" className={cn('min-w-0 text-lg', className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>): React.ReactElement {
  return <p data-slot="card-description" className={cn('text-sm text-fg-muted', className)} {...props} />
}

/** A control at the header's end, e.g. a menu button. */
function CardAction({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return <div data-slot="card-content" className={cn('min-w-0', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div data-slot="card-footer" className={cn('flex items-center gap-2', className)} {...props} />
  )
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
