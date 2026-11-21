import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/shared/lib/utils'
import { Spinner } from '@/shared/ui/primitives/spinner'

// Sizes come from the density tokens, so coarse pointers get 44px targets without a prop.
// Press is colour-only, except primary, which scales to --press-scale-primary (1 under reduced motion).
const buttonVariants = cva(
  "focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent text-(length:--density-text) font-medium whitespace-nowrap transition-[color,background-color,border-color,scale] duration-fast ease-standard select-none disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress aria-invalid:border-danger-solid [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-accent-solid text-accent-on-solid can-hover:bg-accent-solid-hover can-press:scale-(--press-scale-primary) can-press:bg-accent-solid-active',
        primary:
          'bg-accent-solid text-accent-on-solid can-hover:bg-accent-solid-hover can-press:scale-(--press-scale-primary) can-press:bg-accent-solid-active',
        secondary:
          'bg-surface-hover text-fg can-hover:bg-surface-active can-press:bg-surface-active',
        outline:
          'border-border-strong bg-transparent text-fg can-hover:bg-surface-hover can-press:bg-surface-active data-[state=open]:bg-surface-hover',
        ghost:
          'text-fg-secondary can-hover:bg-surface-hover can-hover:text-fg can-press:bg-surface-active data-[state=open]:bg-surface-hover data-[state=open]:text-fg',
        destructive:
          'bg-danger-solid text-danger-on-solid can-hover:bg-danger-solid-hover can-press:bg-danger-solid-hover',
        link: 'h-auto! border-0 px-0! text-accent-text underline-offset-4 can-hover:underline'
      },
      size: {
        default: 'h-(--density-control) px-3 has-[>svg]:px-2.5',
        xs: "h-(--density-control-xs) gap-1 px-2 text-sm has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: 'h-(--density-control-sm) gap-1 px-2.5 has-[>svg]:px-2',
        lg: 'h-[max(2.5rem,var(--density-control))] px-4 text-md has-[>svg]:px-3.5',
        icon: 'size-(--density-icon-button)',
        'icon-xs': "size-(--density-control-xs) [&_svg:not([class*='size-'])]:size-3.5",
        'icon-sm': 'size-(--density-control-sm)',
        'icon-lg': 'size-[max(2.5rem,var(--density-icon-button))]'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner, sets aria-busy and ignores clicks while keeping focus and width. */
    loading?: boolean
  }

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  loading = false,
  onClick,
  children,
  'aria-disabled': ariaDisabled,
  ...props
}: ButtonProps): React.ReactElement {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      aria-disabled={loading || ariaDisabled || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      // a busy button keeps focus (no native disabled) but does nothing
      onClick={loading ? (e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault() : onClick}
      {...props}
    >
      {loading && !asChild ? (
        <>
          <Spinner label="Working" />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants, type ButtonProps }
