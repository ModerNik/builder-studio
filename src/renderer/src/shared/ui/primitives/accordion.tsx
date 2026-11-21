import * as React from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { Accordion as AccordionPrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'

function Accordion(
  props: React.ComponentProps<typeof AccordionPrimitive.Root>
): React.ReactElement {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>): React.ReactElement {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn('border-b border-border-subtle last:border-b-0', className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>): React.ReactElement {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'focus-ring flex min-h-(--density-control) flex-1 cursor-pointer items-center justify-between gap-3 rounded-sm py-2 text-start font-medium transition-colors duration-fast can-hover:text-fg disabled:cursor-not-allowed disabled:opacity-50 [&[data-state=open]>svg]:rotate-180',
          className
        )}
        {...props}
      >
        <span className="min-w-0">{children}</span>
        <ChevronDownIcon
          aria-hidden
          className="size-4 shrink-0 text-fg-muted transition-transform duration-base ease-standard"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

/** Opens in place with a fade (no height animation: layout never animates). */
function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>): React.ReactElement {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="motion-fade overflow-hidden text-fg-secondary"
      {...props}
    >
      <div className={cn('pb-3', className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }
