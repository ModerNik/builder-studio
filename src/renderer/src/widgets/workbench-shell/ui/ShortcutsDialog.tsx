// "Keyboard shortcuts" (?): every shortcut registered right now, grouped, so the list is never stale.
import type { ReactElement } from 'react'
import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { useShortcutList } from '@/shared/lib/shortcuts'
import { IconButton, Kbd } from '@/shared/ui/common/parts'
import { useReturnFocus } from '@/shared/lib/focus'

export function ShortcutsDialog({
  open,
  onOpenChange,
  container,
  extra = []
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  container?: HTMLElement | null
  /** Rows that are not single registrations, e.g. `Ctrl+1` "Screen by position (Ctrl 1 to 7)". */
  extra?: { keys: string; label: string; group: string }[]
}): ReactElement {
  const list = [...useShortcutList(), ...extra]
  const groups = [...new Set(list.map((s) => s.group))]
  const returnFocus = useReturnFocus()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="workbench-scrim fixed inset-0 z-overlay bg-surface-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          aria-modal="true"
          {...returnFocus}
          // start on the dialog, not Close: a focused Close opens its tooltip and the first Esc only shuts that
          onOpenAutoFocus={(e) => {
            returnFocus.onOpenAutoFocus()
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).focus()
          }}
          className="workbench-sheet fixed top-1/2 left-1/2 z-modal flex max-h-[min(40rem,calc(100%-2rem))] w-[min(var(--container-dialog),calc(100%-2rem))] -translate-1/2 flex-col rounded-lg border border-border-subtle bg-surface-overlay shadow-lg outline-none"
        >
          <div className="flex items-center justify-between border-b border-border-subtle py-2 pr-2 pl-4">
            <Dialog.Title className="text-lg">Keyboard shortcuts</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Close" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-4 pt-2 pb-4">
            {groups.map((g) => (
              <section key={g} className="mt-3 first:mt-1">
                <h3 className="mb-1 text-xs text-fg-muted">{g}</h3>
                <dl className="divide-y divide-border-subtle">
                  {list
                    .filter((s) => s.group === g)
                    .map((s) => (
                      <div
                        key={s.keys}
                        className="flex min-h-(--density-row) items-center justify-between gap-4"
                      >
                        <dt>{s.label}</dt>
                        <dd>
                          <Kbd keys={s.keys} className="pointer-coarse:inline-flex" />
                        </dd>
                      </div>
                    ))}
                </dl>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
