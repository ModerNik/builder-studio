// Title bar content: app mark, breadcrumb (Builds › build switcher), command palette trigger, and slots
// for the global job chip, the setup chip and app links. WorkbenchShell supplies the bar itself.
import type { ReactElement, ReactNode } from 'react'
import { DropdownMenu } from 'radix-ui'
import { Boxes, Check, ChevronDown, ChevronRight, Ellipsis, Search } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useWorkbench } from '../model/context'
import { Tip } from '@/shared/ui/common/Tip'
import { IconButton, Kbd } from '@/shared/ui/common/parts'
import { chromeButton, focusRing, menuContent, menuItem } from '@/shared/ui/common/styles'

export interface Crumb {
  label: string
  onSelect?: () => void
  /** A switcher: the crumb opens a menu of siblings (the build switcher). */
  menu?: {
    label: string
    items: { id: string; label: string }[]
    value: string
    onSelect: (id: string) => void
  }
}

function CrumbItem({ crumb, last }: { crumb: Crumb; last: boolean }): ReactElement {
  const cls = cn(
    chromeButton,
    'h-(--density-control-sm) min-w-0 px-1.5 text-base',
    last && 'text-fg'
  )
  if (crumb.menu)
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className={cls} aria-label={`${crumb.menu.label}: ${crumb.label}`}>
          <span className="truncate font-mono text-sm">{crumb.label}</span>
          <ChevronDown aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={4} className={menuContent}>
            <DropdownMenu.Label className="px-2 py-1 text-xs text-fg-muted">
              {crumb.menu.label}
            </DropdownMenu.Label>
            {crumb.menu.items.map((item) => (
              <DropdownMenu.Item
                key={item.id}
                className={menuItem}
                onSelect={() => crumb.menu!.onSelect(item.id)}
              >
                <Check
                  aria-hidden="true"
                  className={cn(item.id !== crumb.menu!.value && 'invisible')}
                />
                <span className="font-mono text-sm">{item.label}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    )
  return crumb.onSelect ? (
    <button
      type="button"
      className={cls}
      onClick={crumb.onSelect}
      aria-current={last ? 'page' : undefined}
    >
      <span className="truncate">{crumb.label}</span>
    </button>
  ) : (
    <span className="truncate px-1.5 text-fg" aria-current={last ? 'page' : undefined}>
      {crumb.label}
    </span>
  )
}

export function TitleBar({
  crumbs,
  onHome,
  onSearch,
  searchLabel = 'Search builds and commands',
  job,
  setup,
  actions,
  overflow,
  panelAction
}: {
  crumbs: Crumb[]
  onHome?: () => void
  /** Opens the command palette (the app registers Ctrl K). */
  onSearch?: () => void
  searchLabel?: string
  /** Global job chip: what is running anywhere, opens Activity. */
  job?: ReactNode
  /** Setup or notice chip; moves into ⋯ on touch tiers. */
  setup?: ReactNode
  /** App links (Labs, Settings) at the right end. */
  actions?: ReactNode
  /** Menu items for ⋯ on tablet and phone (setup notices, app links). */
  overflow?: ReactNode
  panelAction?: ReactNode
}): ReactElement {
  const { tier } = useWorkbench()
  const compact = tier === 'tablet' || tier === 'phone'
  const shownCrumbs = tier === 'phone' ? crumbs.slice(-1) : crumbs
  return (
    <div className="workbench-title-content min-w-0 flex-1 items-center gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Tip label="All builds">
          <button
            type="button"
            onClick={onHome}
            aria-label="Builder Studio: all builds"
            className={cn(
              chromeButton,
              'h-(--density-control-sm) gap-2 px-1.5 font-medium text-fg'
            )}
          >
            <Boxes aria-hidden="true" className="text-accent-text" />
            {!compact && <span>Builder Studio</span>}
          </button>
        </Tip>
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex min-w-0 items-center">
            {shownCrumbs.map((c, i) => (
              <li key={c.label} className="flex min-w-0 items-center">
                {(i > 0 || !compact) && (
                  <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-fg-muted" />
                )}
                <CrumbItem crumb={c} last={i === shownCrumbs.length - 1} />
              </li>
            ))}
          </ol>
        </nav>
      </div>
      <div className="workbench-title-search flex min-w-0 items-center justify-center">
        {onSearch && (
          <button
            type="button"
            onClick={onSearch}
            aria-keyshortcuts="Control+K"
            aria-label={searchLabel}
            title={searchLabel}
            className={cn(
              'inline-flex h-(--density-control-sm) w-64 min-w-0 shrink items-center gap-2 rounded-md border border-border-default bg-surface-sunken px-2 text-fg-muted',
              'transition-colors duration-fast hover:border-border-strong hover:text-fg-secondary',
              focusRing
            )}
          >
            <Search aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="workbench-search-label flex-1 truncate text-left text-sm">Search</span>
            <span className="workbench-search-label">
              <Kbd keys="Ctrl+K" />
            </span>
          </button>
        )}
      </div>
      <div className="workbench-title-actions flex shrink-0 items-center gap-2">
        {panelAction}
        {job}
        {!compact && setup}
        {!compact && actions}
        {compact && overflow && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton icon={Ellipsis} label="More: setup and app links" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={4} className={menuContent}>
                {overflow}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>
    </div>
  )
}
