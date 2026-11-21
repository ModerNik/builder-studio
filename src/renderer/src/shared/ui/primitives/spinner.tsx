import * as React from 'react'
import { Loader2Icon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/** A spinning ring that means work is happening. Under reduced motion it stands still; pair it with text. */
function Spinner({
  className,
  label = 'Loading',
  ...props
}: React.ComponentProps<'svg'> & { label?: string }): React.ReactElement {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label={label}
      className={cn('size-4 shrink-0 animate-spin motion-reduce:animate-none', className)}
      {...props}
    />
  )
}

export { Spinner }
