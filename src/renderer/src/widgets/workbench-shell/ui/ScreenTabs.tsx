// Workflow-grouped soft-pill screen tabs (Tabs 3): one Tab stop with arrow keys inside, hairline
// dividers between workflow groups, patina active pill, compact icon-only mode for tablet/phone,
// and More overflow (the current screen always stays visible).
import { useRef, type KeyboardEvent, type ReactElement } from 'react'
import { DropdownMenu } from 'radix-ui'
import { Check, ChevronDown, Ellipsis, type LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useFit } from '@/shared/lib/layout'
import { Tip } from '@/shared/ui/common/Tip'
import { TabBadge, type TabBadgeTone } from '@/shared/ui/common/parts'
import { focusRing, menuContent, menuItem } from '@/shared/ui/common/styles'

export interface Screen {
  id: string
  label: string
  icon?: LucideIcon
  /** Optional workflow group (e.g. 'core' | 'support' | 'export'); a hairline divider separates adjacent groups. */
  group?: string
  badge?: number | 'dot'
  /** What the badge means, e.g. "3 open pins". */
  badgeLabel?: string
  /** `attention` when the badge counts something waiting on the user (asks, a review request): amber. */
  badgeTone?: TabBadgeTone
}

const MORE_WIDTH = 92 // px kept for the labelled More button (icon + label + optional dot) when tabs overflow
const MORE_ICON_WIDTH = 40 // px kept for the icon-only More button on compact viewports
const DIVIDER_EXTRA = 13 // px reserved when a swapped-in active tab introduces a group divider
const DIVIDER_EXTRA_COMPACT = 9

const pillBase = cn(
  'group relative inline-flex h-[max(2rem,var(--density-control-sm))] shrink-0 items-center justify-center rounded-md border text-sm font-medium whitespace-nowrap',
  'border-transparent text-fg-secondary transition-colors duration-fast ease-standard',
  'hover:bg-surface-hover hover:text-fg [&_svg]:size-4 [&_svg]:shrink-0',
  'aria-[current=page]:border-accent-subtle-border aria-[current=page]:bg-accent-subtle aria-[current=page]:text-fg',
  focusRing,
  'focus-visible:-outline-offset-2'
)

const tabPillClass = cn(pillBase, 'gap-1.5 px-2.5')
const iconPillClass = cn(pillBase, 'w-[max(2rem,var(--density-control-sm))] px-0')

const iconTone =
  'text-fg-muted transition-colors duration-fast group-hover:text-fg-secondary group-aria-[current=page]:text-accent-text'

function hasDividerBefore(list: Screen[], index: number): boolean {
  if (index <= 0) return false
  const prev = list[index - 1].group
  const curr = list[index].group
  return !!prev && !!curr && prev !== curr
}

function GroupDivider({ compact }: { compact?: boolean }): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'shrink-0 bg-border-default',
        compact ? 'ms-0.5 me-1.5 h-4 w-px' : 'ms-1 me-2 h-5 w-px'
      )}
    />
  )
}

function TabLabel({ screen, iconsOnly }: { screen: Screen; iconsOnly: boolean }): ReactElement {
  const Icon = screen.icon
  if (iconsOnly && Icon) {
    return (
      <>
        <Icon aria-hidden="true" className={iconTone} />
        {screen.badge !== undefined && (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute flex',
              screen.badge === 'dot' ? 'end-1 top-1' : '-end-1 -top-1'
            )}
          >
            <TabBadge badge={screen.badge} tone={screen.badgeTone} />
          </span>
        )}
      </>
    )
  }
  return (
    <>
      {Icon && <Icon aria-hidden="true" className={iconTone} />}
      <span>{screen.label}</span>
      {screen.badge !== undefined && (
        <TabBadge badge={screen.badge} label={screen.badgeLabel} tone={screen.badgeTone} />
      )}
    </>
  )
}

function ScreenMenuItems({
  screens,
  value,
  onChange
}: {
  screens: Screen[]
  value: string
  onChange: (id: string) => void
}): ReactElement {
  return (
    <>
      {screens.map((s) => {
        const Icon = s.icon
        return (
          <DropdownMenu.Item key={s.id} className={menuItem} onSelect={() => onChange(s.id)}>
            <Check aria-hidden="true" className={cn(s.id !== value && 'invisible')} />
            {Icon && <Icon aria-hidden="true" className="text-fg-muted" />}
            <span className="flex-1">{s.label}</span>
            {s.badge !== undefined && (
              <TabBadge badge={s.badge} label={s.badgeLabel} tone={s.badgeTone} />
            )}
          </DropdownMenu.Item>
        )
      })}
    </>
  )
}

export function ScreenTabs({
  screens,
  value,
  onChange,
  mode = 'tabs',
  label = 'Screens',
  className
}: {
  screens: Screen[]
  value: string
  onChange: (id: string) => void
  /** `tabs`: icon + label soft pills; `icons`: compact icon-only pills (tablet/phone); `menu`: single dropdown. */
  mode?: 'tabs' | 'icons' | 'menu'
  label?: string
  className?: string
}): ReactElement {
  const iconsOnly = mode === 'icons'
  const box = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const currentIndex = screens.findIndex((s) => s.id === value)
  const current = screens[currentIndex]
  const keepExtra =
    currentIndex > 0 && !hasDividerBefore(screens, currentIndex) && !!current?.group
      ? iconsOnly
        ? DIVIDER_EXTRA_COMPACT
        : DIVIDER_EXTRA
      : 0
  const fit =
    useFit(box, measure, {
      moreWidth: iconsOnly ? MORE_ICON_WIDTH : MORE_WIDTH,
      keepIndex: currentIndex >= 0 ? currentIndex : undefined,
      keepExtra
    }) ?? screens.length

  if (mode === 'menu') {
    const CurrentIcon = current?.icon
    return (
      <nav aria-label={label} className={cn('flex min-w-0 items-center', className)}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className={cn(
              'inline-flex h-[max(2rem,var(--density-control-sm))] min-w-0 items-center gap-1.5 rounded-md border border-accent-subtle-border bg-accent-subtle px-2.5 text-sm font-medium text-fg hover:bg-surface-hover aria-expanded:bg-surface-hover',
              focusRing
            )}
          >
            {CurrentIcon && (
              <CurrentIcon aria-hidden="true" className="size-4 shrink-0 text-accent-text" />
            )}
            <span className="truncate">{current?.label ?? 'Screens'}</span>
            {current?.badge !== undefined && (
              <TabBadge badge={current.badge} label={current.badgeLabel} tone={current.badgeTone} />
            )}
            <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-fg-secondary" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={4} className={menuContent}>
              <ScreenMenuItems screens={screens} value={value} onChange={onChange} />
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </nav>
    )
  }

  // the current screen stays visible: it takes the last visible slot when it would overflow
  const shown =
    fit >= screens.length
      ? screens
      : currentIndex >= fit && fit > 0
        ? [...screens.slice(0, fit - 1), current]
        : screens.slice(0, fit)
  const hidden = screens.filter((s) => !shown.includes(s))
  const hiddenBadge = hidden.some((s) => s.badge !== undefined)
  const hiddenAttention = hidden.some((s) => s.badge !== undefined && s.badgeTone === 'attention')

  // roving focus across the visible tabs and More
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-roving]')]
    const at = items.indexOf(document.activeElement as HTMLElement)
    if (at < 0) return
    const next =
      e.key === 'ArrowRight'
        ? (at + 1) % items.length
        : e.key === 'ArrowLeft'
          ? (at - 1 + items.length) % items.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? items.length - 1
              : -1
    if (next < 0) return
    e.preventDefault()
    items[next].focus()
  }
  const stop = shown.some((s) => s.id === value) ? value : shown[0]?.id
  const itemClass = iconsOnly ? iconPillClass : tabPillClass

  return (
    <nav
      aria-label={label}
      className={cn('relative flex h-full min-w-0 flex-1 overflow-hidden pe-1', className)}
    >
      <div
        ref={box}
        className="flex h-full min-w-0 flex-1 items-center gap-1 overflow-hidden"
        onKeyDown={onKeyDown}
      >
        {shown.map((s, i) => {
          const isIconButton = iconsOnly && !!s.icon
          const accessibleLabel =
            s.badge !== undefined && s.badgeLabel ? `${s.label}, ${s.badgeLabel}` : s.label
          const tipLabel =
            s.badge !== undefined && s.badgeLabel ? `${s.label} · ${s.badgeLabel}` : s.label
          const btn = (
            <button
              type="button"
              data-roving=""
              tabIndex={s.id === stop ? 0 : -1}
              aria-current={s.id === value ? 'page' : undefined}
              aria-label={isIconButton ? accessibleLabel : undefined}
              className={isIconButton ? iconPillClass : tabPillClass}
              onClick={() => onChange(s.id)}
            >
              <TabLabel screen={s} iconsOnly={iconsOnly} />
            </button>
          )
          return (
            <span key={s.id} className="inline-flex shrink-0 items-center">
              {hasDividerBefore(shown, i) && <GroupDivider compact={iconsOnly} />}
              {isIconButton ? (
                <Tip side="bottom" label={tipLabel}>
                  {btn}
                </Tip>
              ) : (
                btn
              )}
            </span>
          )
        })}
        {hidden.length > 0 && (
          <DropdownMenu.Root>
            {iconsOnly ? (
              <Tip
                side="bottom"
                label={
                  hiddenBadge ? 'More screens · A screen in More needs attention' : 'More screens'
                }
              >
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    data-roving=""
                    tabIndex={shown.length ? -1 : 0}
                    aria-label={
                      hiddenBadge
                        ? 'More screens, a screen in More needs attention'
                        : 'More screens'
                    }
                    className={iconPillClass}
                  >
                    <Ellipsis aria-hidden="true" className={iconTone} />
                    {hiddenBadge && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute end-1 top-1 flex"
                      >
                        <TabBadge badge="dot" tone={hiddenAttention ? 'attention' : 'neutral'} />
                      </span>
                    )}
                  </button>
                </DropdownMenu.Trigger>
              </Tip>
            ) : (
              <DropdownMenu.Trigger
                data-roving=""
                tabIndex={shown.length ? -1 : 0}
                className={tabPillClass}
              >
                <Ellipsis aria-hidden="true" className={iconTone} />
                <span>More</span>
                {hiddenBadge && (
                  <TabBadge
                    badge="dot"
                    label="A screen in More needs attention"
                    tone={hiddenAttention ? 'attention' : 'neutral'}
                  />
                )}
              </DropdownMenu.Trigger>
            )}
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="start" sideOffset={4} className={menuContent}>
                <ScreenMenuItems screens={hidden} value={value} onChange={onChange} />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>
      {/* an invisible copy of every tab (plus any preceding group divider), measured to decide how many fit */}
      <div
        ref={measure}
        aria-hidden="true"
        inert
        className="invisible absolute top-0 left-0 flex h-full w-max items-center gap-1"
      >
        {screens.map((s, i) => (
          <span key={s.id} className="inline-flex shrink-0 items-center">
            {hasDividerBefore(screens, i) && <GroupDivider compact={iconsOnly} />}
            <span className={s.icon || !iconsOnly ? itemClass : tabPillClass}>
              <TabLabel screen={s} iconsOnly={iconsOnly} />
            </span>
          </span>
        ))}
      </div>
    </nav>
  )
}
