import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'

function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>): React.ReactElement {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn('group/tabs flex gap-2 data-[orientation=horizontal]:flex-col', className)}
      {...props}
    />
  )
}

// pill (default): segments on a sunken track. line: an underline under the selected tab, for page and dock tabs.
// A horizontal list that runs out of room scrolls sideways; arrow keys bring the focused tab into view.
const tabsListVariants = cva(
  'group/tabs-list inline-flex w-fit max-w-full items-center overflow-x-auto [scrollbar-width:none] group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col group-data-[orientation=vertical]/tabs:items-stretch',
  {
    variants: {
      variant: {
        default:
          'h-(--density-control) gap-0.5 rounded-md bg-surface-sunken p-0.5 ring-1 ring-border-default ring-inset',
        pill: 'h-(--density-control) gap-0.5 rounded-md bg-surface-sunken p-0.5 ring-1 ring-border-default ring-inset',
        line: 'h-(--density-control) gap-1 border-b border-border-subtle group-data-[orientation=vertical]/tabs:border-e group-data-[orientation=vertical]/tabs:border-b-0'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

function TabsList({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>): React.ReactElement {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>): React.ReactElement {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "focus-ring relative inline-flex h-full flex-1 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-2.5 text-(length:--density-text) font-medium whitespace-nowrap text-fg-secondary transition-[color,background-color,box-shadow] duration-fast ease-standard select-none can-hover:text-fg disabled:cursor-not-allowed disabled:opacity-50 data-[state=active]:text-fg group-data-[orientation=vertical]/tabs:h-(--density-control) group-data-[orientation=vertical]/tabs:justify-start [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // pill
        'group-data-[variant=default]/tabs-list:rounded-sm group-data-[variant=pill]/tabs-list:rounded-sm group-data-[variant=default]/tabs-list:data-[state=active]:bg-surface-raised group-data-[variant=pill]/tabs-list:data-[state=active]:bg-surface-raised group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=pill]/tabs-list:data-[state=active]:shadow-sm dark:group-data-[variant=default]/tabs-list:data-[state=active]:bg-surface-active dark:group-data-[variant=pill]/tabs-list:data-[state=active]:bg-surface-active',
        // line: a 2px verdigris bar on the selected tab
        'group-data-[variant=line]/tabs-list:flex-none group-data-[variant=line]/tabs-list:rounded-t-sm group-data-[variant=line]/tabs-list:focus-visible:outline-offset-[-2px] after:absolute after:bg-accent-solid after:opacity-0 after:transition-opacity after:duration-base group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100 group-data-[orientation=horizontal]/tabs:after:inset-x-1 group-data-[orientation=horizontal]/tabs:after:-bottom-px group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-1 group-data-[orientation=vertical]/tabs:after:-end-px group-data-[orientation=vertical]/tabs:after:w-0.5',
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>): React.ReactElement {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('focus-ring flex-1 rounded-sm', className)}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants }
