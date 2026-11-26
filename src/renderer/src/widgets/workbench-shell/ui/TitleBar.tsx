// Minimal studio title bar (Header C): framed app mark + active build switcher on the left,
// open drag area in the centre, and compact search + setup + global actions on the right.
import type { ReactElement, ReactNode } from 'react'
import { DropdownMenu } from 'radix-ui'
import { Boxes, Check, ChevronDown, ChevronRight, Ellipsis, Search } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { formatKeys } from '@/shared/lib/shortcuts'
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
    'h-[max(2rem,var(--density-control-sm))] min-w-0 max-w-full shrink px-2 text-sm',
    last && 'font-medium text-fg'
  )
  if (crumb.menu)
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={cn(
            chromeButton,
            'h-[max(2rem,var(--density-control-sm))] min-w-0 max-w-full shrink gap-1.5 px-2.5 text-sm font-semibold text-fg [&_svg]:size-3.5'
          )}
          aria-label={`${crumb.menu.label}: ${crumb.label}`}
        >
          <span className="truncate">{crumb.label}</span>
          <ChevronDown aria-hidden="true" className="text-fg-muted" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={4}
            className={cn(menuContent, 'max-w-72')}
          >
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
                <span className="truncate text-sm">{item.label}</span>
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
    <span
      className="truncate px-1 text-sm font-medium text-fg-secondary"
      aria-current={last ? 'page' : undefined}
    >
      {crumb.label}
    </span>
  )
}

export function TitleBar({
  crumbs,
  onHome,
  onSearch,
  searchLabel = 'Search builds and commands',
  setup,
  actions,
  overflow
}: {
  crumbs: Crumb[]
  onHome?: () => void
  /** Opens the command palette (the app registers Ctrl K). */
  onSearch?: () => void
  searchLabel?: string
  /** Setup or notice chip; moves into ⋯ on tablet and phone tiers. */
  setup?: ReactNode
  /** App links (Labs, Documentation, Settings) at the right end. */
  actions?: ReactNode
  /** Menu items for ⋯ on tablet and phone (setup notices, app links). */
  overflow?: ReactNode
}): ReactElement {
  const { tier } = useWorkbench()
  const compact = tier === 'tablet' || tier === 'phone'
  const phone = tier === 'phone'
  const hasSwitcher = crumbs.some((c) => !!c.menu)
  const shownCrumbs = phone ? crumbs.slice(-1) : crumbs
  const showBrandWordmark = !hasSwitcher && (!phone || shownCrumbs.length === 0)
  const hasTrailingTools = (!compact && (!!setup || !!actions)) || (compact && !!overflow)

  return (
    <div className="workbench-title-content min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2">
        <Tip label="All builds">
          <button
            type="button"
            onClick={onHome}
            aria-label="Builder Studio: all builds"
            className={cn(
              'group inline-flex min-w-0 shrink items-center gap-2 rounded-lg text-left transition-colors duration-fast ease-standard',
              showBrandWordmark && 'pe-1.5 hover:bg-surface-hover',
              focusRing
            )}
          >
            <span
              className={cn(
                'inline-flex h-[max(2rem,var(--density-control-sm))] w-[max(2rem,var(--density-control-sm))] shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-panel text-accent-text transition-colors duration-fast ease-standard',
                'group-hover:border-border-default group-hover:bg-surface-hover'
              )}
            >
              <Boxes aria-hidden="true" className="size-4" />
            </span>
            {showBrandWordmark && (
              <span className="truncate text-sm font-semibold text-fg">Builder Studio</span>
            )}
          </button>
        </Tip>
        {shownCrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-0.5">
              {shownCrumbs.map((c, i) => (
                <li key={`${i}:${c.label}`} className="flex min-w-0 items-center gap-0.5">
                  {i === 0 && showBrandWordmark && (
                    <span aria-hidden="true" className="px-0.5 text-sm text-fg-muted">
                      ·
                    </span>
                  )}
                  {i > 0 && (
                    <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-fg-muted" />
                  )}
                  <CrumbItem crumb={c} last={i === shownCrumbs.length - 1} />
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>

      {/* Open centre drag region */}
      <div aria-hidden="true" className="min-w-2 flex-1" />

      <div className="workbench-title-actions flex shrink-0 items-center gap-2">
        {onSearch && (
          <Tip label={`${searchLabel} (${formatKeys('Ctrl+K').join(' ')})`}>
            <button
              type="button"
              onClick={onSearch}
              aria-keyshortcuts="Control+K"
              aria-label={searchLabel}
              className={cn(
                'workbench-title-search-trigger inline-flex h-[max(2rem,var(--density-control-sm))] w-56 min-w-0 shrink items-center gap-2 rounded-md border border-border-default bg-surface-sunken px-2.5 text-fg-muted',
                'transition-colors duration-fast ease-standard hover:border-border-strong hover:text-fg-secondary',
                focusRing
              )}
            >
              <Search aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="workbench-search-label flex-1 truncate text-left text-sm">
                Search…
              </span>
              <span className="workbench-search-label">
                <Kbd keys="Ctrl+K" />
              </span>
            </button>
          </Tip>
        )}
        {onSearch && hasTrailingTools && (
          <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border-subtle" />
        )}
        {!compact && setup}
        {!compact && actions && <div className="flex shrink-0 items-center gap-0.5">{actions}</div>}
        {compact && overflow && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton size="sm" icon={Ellipsis} label="More: setup and app links" />
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
