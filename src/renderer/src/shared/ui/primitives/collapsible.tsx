import * as React from 'react'
import { Collapsible as CollapsiblePrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'

function Collapsible(
  props: React.ComponentProps<typeof CollapsiblePrimitive.Root>
): React.ReactElement {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger(
  props: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>
): React.ReactElement {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
}

function CollapsibleContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content>): React.ReactElement {
  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      className={cn('motion-fade', className)}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger }
