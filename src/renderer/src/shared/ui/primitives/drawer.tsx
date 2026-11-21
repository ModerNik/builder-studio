import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'
import { useModalFocus } from '@/shared/lib/focus'
import { DialogOverlay } from '@/shared/ui/primitives/dialog'

// shortcut: the handle is visual only (no swipe-to-close); add drag handling if touch use needs it.

function Drawer(props: React.ComponentProps<typeof DialogPrimitive.Root>): React.ReactElement {
  return <DialogPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>
): React.ReactElement {
  return <DialogPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerClose(
  props: React.ComponentProps<typeof DialogPrimitive.Close>
): React.ReactElement {
  return <DialogPrimitive.Close data-slot="drawer-close" {...props} />
}

/** A bottom sheet for narrow and touch windows: rounded top, a grab handle, safe-area padding. */
function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>): React.ReactElement {
  const focus = useModalFocus(props)
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="drawer-content"
        aria-modal="true"
        data-side="bottom"
        className={cn(
          'motion-sheet fixed inset-x-0 bottom-0 z-modal mx-auto flex max-h-[85dvh] w-full max-w-dialog-lg flex-col rounded-t-xl border border-b-0 border-border-default bg-surface-panel px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-fg shadow-lg outline-none',
          className
        )}
        {...props}
        {...focus}
      >
        <div
          aria-hidden
          className="mx-auto mt-2 mb-3 h-1 w-9 shrink-0 rounded-full bg-border-strong"
        />
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      data-slot="drawer-header"
      className={cn('flex flex-col gap-1 text-center', className)}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      data-slot="drawer-footer"
      className={cn('mt-auto flex flex-col gap-2', className)}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>): React.ReactElement {
  return (
    <DialogPrimitive.Title
      data-slot="drawer-title"
      className={cn('text-lg', className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>): React.ReactElement {
  return (
    <DialogPrimitive.Description
      data-slot="drawer-description"
      className={cn('text-base text-fg-secondary', className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
}
