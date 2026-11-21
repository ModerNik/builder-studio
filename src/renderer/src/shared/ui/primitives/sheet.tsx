import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'
import { useModalFocus } from '@/shared/lib/focus'
import { DialogOverlay, ModalClose } from '@/shared/ui/primitives/dialog'

function Sheet(props: React.ComponentProps<typeof DialogPrimitive.Root>): React.ReactElement {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>
): React.ReactElement {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props: React.ComponentProps<typeof DialogPrimitive.Close>): React.ReactElement {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

const sides = {
  // logical edges, so a start sheet opens from the right in RTL
  start: 'inset-y-0 start-0 h-full w-[min(var(--dock-assistant),calc(100%-3rem))] border-e',
  end: 'inset-y-0 end-0 h-full w-[min(var(--dock-assistant),calc(100%-3rem))] border-s',
  top: 'inset-x-0 top-0 max-h-[85dvh] border-b',
  bottom: 'inset-x-0 bottom-0 max-h-[85dvh] border-t'
}
// motion-sheet travels from data-side; physical sides follow the reading direction
const travelSide = { start: 'left', end: 'right', top: 'top', bottom: 'bottom' } as const

/** A modal panel from any edge: narrow-window docks, filters, details. Focus is trapped; Esc closes. */
function SheetContent({
  className,
  children,
  side = 'end',
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: keyof typeof sides
  showCloseButton?: boolean
}): React.ReactElement {
  const focus = useModalFocus(props)
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        aria-modal="true"
        data-side={travelSide[side]}
        className={cn(
          'motion-sheet fixed z-modal flex flex-col gap-4 overflow-y-auto border-border-default bg-surface-panel p-5 text-fg shadow-lg outline-none',
          sides[side],
          className
        )}
        {...props}
        {...focus}
      >
        {children}
        {showCloseButton && <ModalClose />}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1 pe-8', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>): React.ReactElement {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-lg', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>): React.ReactElement {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-base text-fg-secondary', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
}
