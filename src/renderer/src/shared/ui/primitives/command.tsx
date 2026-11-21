import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { SearchIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/primitives/dialog'
import { menuSeparator, menuShortcut } from '@/shared/ui/primitives/menu-styles'
import { Spinner } from '@/shared/ui/primitives/spinner'

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>): React.ReactElement {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-lg bg-surface-overlay text-fg',
        className
      )}
      {...props}
    />
  )
}

/** The command palette: a top-anchored dialog holding a Command. */
function CommandDialog({
  title = 'Command palette',
  description = 'Search for a command to run',
  children,
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
}): React.ReactElement {
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn(
          'top-[max(1rem,14vh)] translate-y-0 gap-0 overflow-hidden p-0 shadow-xl sm:max-w-dialog-lg',
          className
        )}
        showCloseButton={showCloseButton}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command className="[&_[cmdk-input-wrapper]]:h-12 **:data-[slot=command-input-wrapper]:h-12 **:data-[slot=command-list]:max-h-[min(25rem,60dvh)]">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  loading = false,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
  /** Shows a spinner in place of the search icon while results load. */
  loading?: boolean
}): React.ReactElement {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-(--density-control) shrink-0 items-center gap-2 border-b border-border-subtle px-3"
    >
      {loading ? (
        <Spinner className="text-fg-muted" />
      ) : (
        <SearchIcon aria-hidden className="size-4 shrink-0 text-fg-muted" />
      )}
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          'flex h-full w-full min-w-0 cursor-text bg-transparent text-(length:--density-text) outline-hidden placeholder:text-fg-muted disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>): React.ReactElement {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn('max-h-[18.75rem] scroll-py-1 overflow-x-hidden overflow-y-auto p-1', className)}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>): React.ReactElement {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn('px-3 py-6 text-center text-sm text-fg-muted', className)}
      {...props}
    />
  )
}

function CommandLoading({
  className,
  children = 'Loading…',
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Loading>): React.ReactElement {
  return (
    <CommandPrimitive.Loading
      data-slot="command-loading"
      className={cn('flex items-center justify-center gap-2 py-6 text-sm text-fg-muted', className)}
      {...props}
    >
      <Spinner />
      {children}
    </CommandPrimitive.Loading>
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>): React.ReactElement {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        'overflow-hidden text-fg [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-muted',
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>): React.ReactElement {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn(menuSeparator, 'mx-0', className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>): React.ReactElement {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex min-h-(--density-row) cursor-pointer items-center gap-2 rounded-sm px-2 text-(length:--density-text) outline-hidden select-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:text-fg-disabled data-[selected=true]:bg-surface-hover [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-fg-muted",
        className
      )}
      {...props}
    />
  )
}

function CommandShortcut({ className, ...props }: React.ComponentProps<'span'>): React.ReactElement {
  return <span data-slot="command-shortcut" className={cn(menuShortcut, className)} {...props} />
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
  CommandSeparator,
  CommandShortcut
}
