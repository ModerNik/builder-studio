import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Toggle as TogglePrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'

const toggleVariants = cva(
  "focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent text-(length:--density-text) font-medium whitespace-nowrap text-fg-secondary transition-[color,background-color,border-color] duration-fast ease-standard select-none can-hover:bg-surface-hover can-hover:text-fg disabled:cursor-not-allowed disabled:opacity-50 data-[state=on]:bg-surface-active data-[state=on]:text-fg [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: '',
        outline: 'border-border-strong data-[state=on]:border-accent-subtle-border'
      },
      size: {
        default: 'h-(--density-control) min-w-(--density-control) px-2',
        sm: 'h-(--density-control-sm) min-w-(--density-control-sm) px-1.5',
        lg: 'h-[max(2.5rem,var(--density-control))] min-w-[max(2.5rem,var(--density-control))] px-2.5'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
)

/** A two-state button (aria-pressed). Icon-only toggles need an aria-label. */
function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>): React.ReactElement {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
