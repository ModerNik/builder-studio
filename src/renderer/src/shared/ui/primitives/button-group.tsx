import * as React from 'react'
import { cn } from '@/shared/lib/utils'

/** Joins buttons into one control: shared edges, outer corners only. Give it an aria-label. */
function ButtonGroup({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<'div'> & { orientation?: 'horizontal' | 'vertical' }): React.ReactElement {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(
        'inline-flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10',
        orientation === 'horizontal'
          ? '*:not-first:rounded-s-none *:not-first:-ms-px *:not-last:rounded-e-none'
          : 'flex-col *:not-first:-mt-px *:not-first:rounded-t-none *:not-last:rounded-b-none',
        className
      )}
      {...props}
    />
  )
}

export { ButtonGroup }
