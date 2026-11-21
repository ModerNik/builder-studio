import { useId, useState, type ReactElement, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/shared/ui/primitives/alert-dialog'
import { Input } from '@/shared/ui/primitives/input'

/**
 * The one confirm every destructive action goes through. The title names the action and the object
 * ("Delete stone_watchtower?"), the body says what happens to which files, and the button repeats the verb.
 * With confirmText the button stays off until that exact text is typed, for what cannot be undone.
 */
export function ConfirmDestructive({
  open,
  onOpenChange,
  title,
  children,
  action = 'Delete',
  confirmText,
  onConfirm,
  onCloseAutoFocus
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  /** The button's verb: "Delete", "Archive", "Move to Recycle Bin". */
  action?: string
  /** Text the user must type to enable the action, usually the build's name. */
  confirmText?: string
  onConfirm: () => void
  onCloseAutoFocus?: React.ComponentProps<typeof AlertDialogContent>['onCloseAutoFocus']
}): ReactElement {
  const [typed, setTyped] = useState('')
  const id = useId()
  const locked = confirmText !== undefined && typed.trim() !== confirmText
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped('')
        onOpenChange(o)
      }}
    >
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-balance">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-base text-fg-secondary">{children}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {confirmText !== undefined && (
          <form
            className="flex flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              if (locked) return
              onConfirm()
              onOpenChange(false)
              setTyped('')
            }}
          >
            <label htmlFor={id} className="text-base text-fg-secondary">
              Type <span className="font-mono text-fg select-text">{confirmText}</span> to confirm
            </label>
            <Input
              id={id}
              value={typed}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setTyped(e.target.value)}
              className="h-(--density-control) font-mono"
            />
          </form>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={locked}
            onClick={() => {
              onConfirm()
              setTyped('')
            }}
          >
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
