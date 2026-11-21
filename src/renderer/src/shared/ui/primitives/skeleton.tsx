import * as React from 'react'
import { cn } from '@/shared/lib/utils'

/** A placeholder block while content loads. Pulses; static under reduced motion. Hidden from screen readers. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        'animate-pulse rounded-sm bg-surface-hover motion-reduce:animate-none',
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
