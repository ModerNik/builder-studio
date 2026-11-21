// The setup notices chip for the title bar's `setup` slot: "N to set up", opening a list of what is missing
// with one fix per row. Hidden when nothing is missing. On tablet and phone the title bar folds the slot
// into its ⋯ menu, where SetupNoticesMenuItem names the same count.
import { useState, type ReactElement } from 'react'
import { DropdownMenu } from 'radix-ui'
import { TriangleAlert, type LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/primitives/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover'
import { chromeButton, menuItem } from '@/shared/ui/common/styles'

export interface SetupNotice {
  id: string
  /** What is missing, e.g. "Preview browser". */
  label: string
  /** What it unlocks or what the check found. */
  detail?: string
  icon?: LucideIcon
  /** The fix's verb: "Install", "Set up". */
  action: string
  onFix: () => void
  /** Set while the fix runs, e.g. "Installing…"; the button shows it and is off. */
  busy?: string
}

const count = (n: number): string => `${n} to set up`

export function SetupNoticesChip({
  notices,
  title = 'Finish setting up',
  description = 'Builder Studio works now. These unlock more.',
  className
}: {
  notices: SetupNotice[]
  title?: string
  description?: string
  className?: string
}): ReactElement | null {
  const [open, setOpen] = useState(false)
  if (!notices.length) return null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            chromeButton,
            'h-(--density-control-sm) shrink-0 rounded-full border border-warning-subtle-border bg-warning-subtle px-2.5 text-xs text-warning-text can-hover:bg-warning-subtle can-hover:text-warning-text',
            className
          )}
        >
          <TriangleAlert aria-hidden="true" className="size-3.5" />
          {count(notices.length)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        aria-label={title}
        className="w-90 max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="flex flex-col gap-0.5 px-4 pt-3.5 pb-2.5">
          <span className="font-semibold text-fg">{title}</span>
          <span className="text-sm text-fg-secondary">{description}</span>
        </div>
        <ul className="flex flex-col px-1.5 pb-1.5">
          {notices.map((n) => {
            const Icon = n.icon ?? TriangleAlert
            return (
              <li
                key={n.id}
                className="flex min-h-(--density-row) items-center gap-3 rounded-md px-2.5 py-2"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0 text-warning-text" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base text-fg">{n.label}</span>
                  {n.detail && <span className="text-sm text-fg-secondary">{n.detail}</span>}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={!!n.busy}
                  aria-label={`${n.action}: ${n.label}`}
                  onClick={() => {
                    n.onFix()
                    setOpen(false)
                  }}
                >
                  {n.busy ?? n.action}
                </Button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/** The same count as a ⋯ menu item for the title bar's `overflow` on tablet and phone. */
export function SetupNoticesMenuItem({
  notices,
  onSelect
}: {
  notices: SetupNotice[]
  /** Usually opens Settings › Advanced › Diagnostics, which lists every requirement. */
  onSelect: () => void
}): ReactElement | null {
  if (!notices.length) return null
  return (
    <DropdownMenu.Item className={cn(menuItem, 'text-warning-text')} onSelect={onSelect}>
      <TriangleAlert aria-hidden="true" />
      {count(notices.length)}
    </DropdownMenu.Item>
  )
}
