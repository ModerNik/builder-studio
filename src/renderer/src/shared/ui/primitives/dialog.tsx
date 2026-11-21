import * as React from 'react'
import { XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'
import { useModalFocus } from '@/shared/lib/focus'
import { Button } from '@/shared/ui/primitives/button'

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>): React.ReactElement {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>
): React.ReactElement {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal(
  props: React.ComponentProps<typeof DialogPrimitive.Portal>
): React.ReactElement {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose(
  props: React.ComponentProps<typeof DialogPrimitive.Close>
): React.ReactElement {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>): React.ReactElement {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn('motion-fade fixed inset-0 z-overlay bg-surface-scrim', className)}
      {...props}
    />
  )
}

/** The close button every modal layer shares: an icon button, top end corner. */
function ModalClose({ className }: { className?: string }): React.ReactElement {
  return (
    <DialogPrimitive.Close asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Close"
        className={cn('absolute end-3 top-3', className)}
      >
        <XIcon />
      </Button>
    </DialogPrimitive.Close>
  )
}

const dialogSizes = {
  sm: 'sm:max-w-sm',
  default: 'sm:max-w-dialog',
  lg: 'sm:max-w-dialog-lg',
  full: 'sm:max-w-wide sm:h-[calc(100dvh-4rem)]'
}

/** A modal dialog: focus is trapped inside and returns to the trigger on close; Esc closes. */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  size = 'default',
  phone = 'centred',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  /** sm 384px, default 480px (max-w-dialog), lg 720px (max-w-dialog-lg), full nearly the window. */
  size?: keyof typeof dialogSizes
  /** Below 640px: a centred card, or a full-height sheet with the footer at the bottom (long forms). */
  phone?: 'centred' | 'sheet'
}): React.ReactElement {
  const focus = useModalFocus(props)
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        aria-modal="true"
        data-size={size}
        className={cn(
          'motion-dialog fixed start-1/2 top-1/2 z-modal flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-border-default bg-surface-overlay p-5 text-fg shadow-lg outline-none rtl:translate-x-1/2',
          dialogSizes[size],
          phone === 'sheet' &&
            'max-sm:inset-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:translate-none max-sm:rounded-none max-sm:border-0 max-sm:rtl:translate-none max-sm:[&>[data-slot=dialog-footer]]:mt-auto',
          className
        )}
        {...props}
        {...focus}
      >
        {children}
        {showCloseButton && <ModalClose />}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1 pe-8 text-start', className)}
      {...props}
    />
  )
}

/** The part that scrolls when content runs long; header and footer stay in place. */
function DialogBody({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      data-slot="dialog-body"
      // -m-1 p-1: room for focus rings, which the scroll edge would otherwise clip
      className={cn('-m-1 min-h-0 flex-1 overflow-y-auto p-1', className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & { showCloseButton?: boolean }): React.ReactElement {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>): React.ReactElement {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-xl text-balance', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>): React.ReactElement {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-base text-fg-secondary', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  ModalClose
}
