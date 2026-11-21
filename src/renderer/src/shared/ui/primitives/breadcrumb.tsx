import * as React from 'react'
import { ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react'
import { Slot } from 'radix-ui'
import { cn } from '@/shared/lib/utils'

function Breadcrumb({ ...props }: React.ComponentProps<'nav'>): React.ReactElement {
  return <nav aria-label="Breadcrumb" data-slot="breadcrumb" {...props} />
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>): React.ReactElement {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn('flex min-w-0 items-center gap-1 text-sm text-fg-muted', className)}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>): React.ReactElement {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn('inline-flex min-w-0 items-center gap-1', className)}
      {...props}
    />
  )
}

/** A crumb that navigates; long names truncate (set a max-w on it). Use asChild for router links. */
function BreadcrumbLink({
  asChild,
  className,
  ...props
}: React.ComponentProps<'a'> & { asChild?: boolean }): React.ReactElement {
  const Comp = asChild ? Slot.Root : 'a'
  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn(
        'focus-ring cursor-pointer truncate rounded-xs transition-colors duration-fast can-hover:text-fg',
        className
      )}
      {...props}
    />
  )
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>): React.ReactElement {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn('truncate font-medium text-fg', className)}
      {...props}
    />
  )
}

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<'li'>): React.ReactElement {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden
      className={cn('shrink-0 [&>svg]:size-3.5 rtl:[&>svg]:rotate-180', className)}
      {...props}
    >
      {children ?? <ChevronRightIcon />}
    </li>
  )
}

/** Stands for collapsed middle crumbs; wrap it in a DropdownMenuTrigger to reveal them. */
function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<'span'>): React.ReactElement {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      className={cn('flex size-5 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontalIcon aria-hidden className="size-4" />
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
}
