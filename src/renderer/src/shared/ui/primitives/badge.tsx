import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/shared/lib/utils'

// Small static labels and counts. Status tones are for true status only, always with a word or icon.
const badgeVariants = cva(
  'focus-ring inline-flex h-5 w-fit max-w-full shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-1.5 text-2xs whitespace-nowrap tabular-nums transition-[color,background-color] duration-fast ease-standard [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-accent-solid text-accent-on-solid [a&]:can-hover:bg-accent-solid-hover',
        secondary: 'bg-surface-hover text-fg-secondary [a&]:can-hover:bg-surface-active',
        destructive: 'bg-danger-solid text-danger-on-solid [a&]:can-hover:bg-danger-solid-hover',
        outline: 'border-border-default text-fg-secondary [a&]:can-hover:bg-surface-hover',
        ghost: 'text-fg-secondary [a&]:can-hover:bg-surface-hover',
        link: 'text-accent-text underline-offset-4 [a&]:can-hover:underline',
        success: 'border-success-subtle-border bg-success-subtle text-success-text',
        warning: 'border-warning-subtle-border bg-warning-subtle text-warning-text',
        danger: 'border-danger-subtle-border bg-danger-subtle text-danger-text',
        info: 'border-info-subtle-border bg-info-subtle text-info-text',
        accent: 'border-accent-subtle-border bg-accent-subtle text-accent-text'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }): React.ReactElement {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
