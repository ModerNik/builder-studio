import * as React from 'react'
import { cn } from '@/shared/lib/utils'

/**
 * Plain table parts. The wrapper scrolls; give it a max height for a sticky header (TableHeader sticky).
 * Rows are --density-row tall; dense drops them to the small control height.
 */
function Table({
  className,
  dense = false,
  containerClassName,
  ...props
}: React.ComponentProps<'table'> & {
  dense?: boolean
  containerClassName?: string
}): React.ReactElement {
  return (
    <div
      data-slot="table-container"
      className={cn('relative w-full overflow-auto rounded-md', containerClassName)}
    >
      <table
        data-slot="table"
        data-dense={dense || undefined}
        className={cn('group/table w-full caption-bottom border-collapse text-base tabular-nums', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({
  className,
  sticky = false,
  ...props
}: React.ComponentProps<'thead'> & { sticky?: boolean }): React.ReactElement {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        'bg-surface-panel [&_tr]:border-b [&_tr]:border-border-default',
        sticky && 'sticky top-0 z-sticky shadow-[0_1px_0_var(--border-default)]',
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>): React.ReactElement {
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>): React.ReactElement {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t border-border-default bg-surface-panel font-medium', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>): React.ReactElement {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-border-subtle transition-colors duration-fast hover:bg-surface-hover/60 aria-selected:bg-accent-subtle data-[state=selected]:bg-accent-subtle',
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>): React.ReactElement {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-(--density-row) px-2 text-start align-middle text-xs font-medium whitespace-nowrap text-fg-secondary group-data-dense/table:h-(--density-control-sm) [&:has([role=checkbox])]:w-8 [&:has([role=checkbox])]:pe-0',
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>): React.ReactElement {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'h-(--density-row) px-2 align-middle group-data-dense/table:h-(--density-control-sm) group-data-dense/table:text-sm [&:has([role=checkbox])]:pe-0',
        className
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>): React.ReactElement {
  return (
    <caption data-slot="table-caption" className={cn('mt-3 text-sm text-fg-muted', className)} {...props} />
  )
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow }
