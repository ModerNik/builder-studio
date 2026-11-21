import { useRef, type FocusEventHandler } from 'react'

/** For dialogs opened by a key or a toggle, not a trigger: on close, focus goes back where it was. */
export function useReturnFocus(): {
  onOpenAutoFocus: () => void
  onCloseAutoFocus: (e: Event) => void
} {
  const returnTo = useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: () => {
      returnTo.current = document.activeElement as HTMLElement | null
    },
    onCloseAutoFocus: (e) => {
      if (!returnTo.current?.isConnected) return
      e.preventDefault()
      returnTo.current.focus()
    }
  }
}

type AutoFocus = {
  onOpenAutoFocus?: (e: Event) => void
  onCloseAutoFocus?: (e: Event) => void
  onFocusCapture?: FocusEventHandler<HTMLDivElement>
}
/**
 * A kit modal's focus handlers: Radix returns focus only to its own Trigger, so a modal opened by a
 * key, a menu or a store would drop focus to the page. The opener is what focus came from on its way
 * in (a field with autoFocus gets there before onOpenAutoFocus, which then never fires). The caller's
 * handlers run too; one that prevents the close default keeps its own target.
 */
export function useModalFocus(own: AutoFocus): Required<AutoFocus> {
  const returnTo = useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: (e) => {
      returnTo.current ??= document.activeElement as HTMLElement | null
      own.onOpenAutoFocus?.(e)
    },
    onFocusCapture: (e) => {
      own.onFocusCapture?.(e)
      const from = e.relatedTarget
      if (!returnTo.current && from instanceof HTMLElement && !e.currentTarget.contains(from))
        returnTo.current = from
    },
    onCloseAutoFocus: (e) => {
      own.onCloseAutoFocus?.(e)
      const to = returnTo.current
      returnTo.current = null
      if (e.defaultPrevented || !to?.isConnected) return
      e.preventDefault()
      to.focus()
    }
  }
}
