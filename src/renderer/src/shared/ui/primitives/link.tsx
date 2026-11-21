import * as React from 'react'
import { ArrowUpRightIcon } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/shared/lib/utils'

const linkVariants = cva(
  'focus-ring cursor-pointer rounded-xs underline-offset-[3px] transition-colors duration-fast ease-standard aria-disabled:pointer-events-none aria-disabled:text-fg-disabled',
  {
    variants: {
      variant: {
        default: 'text-accent-text underline decoration-accent-text/40 can-hover:decoration-accent-text',
        subtle: 'text-fg-secondary can-hover:text-fg can-hover:underline'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

/**
 * Inline text link. `external` adds an arrow icon and an "opens outside the app" hint for screen readers.
 * Wrap a router link with asChild.
 */
function Link({
  className,
  variant,
  asChild = false,
  external = false,
  children,
  ...props
}: React.ComponentProps<'a'> &
  VariantProps<typeof linkVariants> & { asChild?: boolean; external?: boolean }): React.ReactElement {
  const Comp = asChild ? Slot.Root : 'a'
  return (
    <Comp
      data-slot="link"
      className={cn(linkVariants({ variant }), className)}
      {...(external && !asChild ? { target: '_blank', rel: 'noreferrer' } : {})}
      {...props}
    >
      {external && !asChild ? (
        <>
          {children}
          <ArrowUpRightIcon aria-hidden className="ms-0.5 inline size-3.5 align-[-2px] rtl:-scale-x-100" />
          <span className="sr-only"> (opens outside the app)</span>
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Link, linkVariants }
