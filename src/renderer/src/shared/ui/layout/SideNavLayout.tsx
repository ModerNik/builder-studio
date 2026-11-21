// Settings-style layout: a side list of sections beside the content. Narrower than `collapseBelow` (its own
// width) it either becomes a menu button naming the current section (`narrow="menu"`, Documentation) or
// drills in (`narrow="drill"`, Settings on phone): a full-width section list, and each section opens on
// its own with Back.
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { DropdownMenu } from 'radix-ui'
import { Check, ChevronDown, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { remPx, useContainerWidth } from '@/shared/lib/layout'
import { chromeButton, menuContent, menuItem } from '@/shared/ui/common/styles'

export interface SideNavItem {
  id: string
  label: string
  icon?: LucideIcon
  /** A problem in the section, e.g. "Needs setup: Preview browser": a dot in the rail, words in the list. */
  notice?: string
}

const NoticeDot = ({ text }: { text: string }): ReactElement => (
  <span className="ms-auto flex shrink-0 items-center">
    <span aria-hidden="true" className="size-1.5 rounded-full bg-warning-solid" />
    <span className="sr-only">{text}</span>
  </span>
)

export function SideNavLayout({
  label,
  items,
  value,
  onChange,
  collapseBelow = 48,
  narrow: narrowMode = 'menu',
  drilled: drilledProp,
  onBack,
  children,
  className
}: {
  label: string
  items: SideNavItem[]
  value: string
  onChange: (id: string) => void
  collapseBelow?: number
  /** What the list becomes when narrow: a menu button, or a list that drills into each section. */
  narrow?: 'menu' | 'drill'
  /** Drill-in, controlled: whether a section is open (Settings keeps it in the URL, so a link opens it). */
  drilled?: boolean
  /** With `drilled`: Back was pressed. */
  onBack?: () => void
  children: ReactNode
  className?: string
}): ReactElement {
  const box = useRef<HTMLDivElement>(null)
  const width = useContainerWidth(box)
  const narrow = width > 0 && width < collapseBelow * remPx()
  const current = items.find((i) => i.id === value) ?? items[0]
  const [drilledState, setDrilledState] = useState(false)
  const controlled = drilledProp !== undefined
  const drilled = controlled ? drilledProp : drilledState
  const back = useRef<HTMLButtonElement>(null)
  const opener = useRef<string | null>(null)
  const list = useRef<HTMLUListElement>(null)
  const drill = narrow && narrowMode === 'drill'
  // moving into a section focuses Back; coming back focuses the row that opened it
  useEffect(() => {
    if (!drill) return
    if (drilled) back.current?.focus()
    else if (opener.current)
      list.current?.querySelector<HTMLButtonElement>(`[data-id="${opener.current}"]`)?.focus()
  }, [drill, drilled])

  if (drill)
    return (
      <div ref={box} className={cn('flex min-h-0 min-w-0 flex-col gap-3', className)}>
        {drilled ? (
          <>
            <button
              ref={back}
              type="button"
              onClick={() => (controlled ? onBack?.() : setDrilledState(false))}
              className={cn(chromeButton, 'h-(--density-control) self-start ps-1 pe-2.5 text-base')}
            >
              <ChevronLeft aria-hidden="true" className="rtl:rotate-180" />
              {label}
            </button>
            <div className="min-w-0 flex-1">{children}</div>
          </>
        ) : (
          // the list stands in for a section's own page header, so it carries the page heading
          <nav aria-label={label}>
            <h1 className="sr-only">{label}</h1>
            <ul
              ref={list}
              className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-default bg-surface-raised"
            >
              {items.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    data-id={i.id}
                    onClick={() => {
                      opener.current = i.id
                      onChange(i.id)
                      if (!controlled) setDrilledState(true)
                    }}
                    className={cn(
                      chromeButton,
                      'min-h-11 w-full justify-start rounded-none px-3 py-2 text-start text-base text-fg focus-visible:-outline-offset-2'
                    )}
                  >
                    {i.icon && <i.icon aria-hidden="true" className="text-fg-secondary" />}
                    <span className="flex min-w-0 flex-1 flex-col">
                      {i.label}
                      {i.notice && <span className="text-sm text-warning-text">{i.notice}</span>}
                    </span>
                    <ChevronRight aria-hidden="true" className="text-fg-muted rtl:rotate-180" />
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    )

  return (
    <div
      ref={box}
      className={cn('flex min-h-0 min-w-0', narrow ? 'flex-col gap-3' : 'gap-6', className)}
    >
      <nav aria-label={label} className={narrow ? '' : 'w-56 shrink-0'}>
        {narrow ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              className={cn(
                chromeButton,
                'h-(--density-control) w-full justify-between border border-border-default px-3 text-base text-fg'
              )}
            >
              <span className="flex items-center gap-2">
                {current.icon && <current.icon aria-hidden="true" />}
                {current.label}
              </span>
              <ChevronDown aria-hidden="true" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={4}
                className={cn(menuContent, 'w-(--radix-dropdown-menu-trigger-width)')}
              >
                <DropdownMenu.RadioGroup value={value} onValueChange={onChange}>
                  {items.map((i) => (
                    <DropdownMenu.RadioItem key={i.id} value={i.id} className={menuItem}>
                      {i.icon && <i.icon aria-hidden="true" />}
                      <span className="flex-1">{i.label}</span>
                      {i.notice && <NoticeDot text={i.notice} />}
                      <DropdownMenu.ItemIndicator>
                        <Check aria-hidden="true" />
                      </DropdownMenu.ItemIndicator>
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  aria-current={i.id === value ? 'page' : undefined}
                  onClick={() => onChange(i.id)}
                  className={cn(
                    chromeButton,
                    'min-h-(--density-row) w-full justify-start px-2.5 py-1.5 text-start text-base',
                    'aria-[current=page]:bg-surface-active aria-[current=page]:text-fg'
                  )}
                >
                  {i.icon && <i.icon aria-hidden="true" />}
                  <span className="min-w-0">{i.label}</span>
                  {i.notice && <NoticeDot text={i.notice} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
