// The screen tabs under the title bar: one Tab stop with arrow keys inside, tabs that do not fit go into
// More (the current screen always stays visible), and on phones a screen menu replaces the strip.
import { useRef, type KeyboardEvent, type ReactElement } from 'react'
import { DropdownMenu } from 'radix-ui'
import { Check, ChevronDown, Ellipsis, type LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useFit } from '@/shared/lib/layout'
import { TabBadge } from '@/shared/ui/common/parts'
import { focusRing, menuContent, menuItem } from '@/shared/ui/common/styles'

export interface Screen {
  id: string
  label: string
  icon?: LucideIcon
  badge?: number | 'dot'
  /** What the badge means, e.g. "3 open pins". */
  badgeLabel?: string
  /** `attention` when the badge counts something waiting on the user (asks, a review request): amber. */
  badgeTone?: 'neutral' | 'attention'
}

const MORE_WIDTH = 72 // px kept for the More button when tabs overflow

const tabClass = cn(
  'relative inline-flex h-full shrink-0 items-center gap-1.5 px-3 text-base whitespace-nowrap text-fg-secondary',
  'transition-colors duration-fast ease-standard hover:text-fg [&_svg]:size-4',
  'after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent',
  'aria-[current=page]:text-fg aria-[current=page]:after:bg-accent-solid',
  focusRing,
  'focus-visible:-outline-offset-2'
)

function TabLabel({ screen }: { screen: Screen }): ReactElement {
  const Icon = screen.icon
  return (
    <>
      {Icon && <Icon aria-hidden="true" />}
      {screen.label}
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
      {screens.map((s) => (
        <DropdownMenu.Item key={s.id} className={menuItem} onSelect={() => onChange(s.id)}>
          <Check aria-hidden="true" className={cn(s.id !== value && 'invisible')} />
          <span className="flex-1">{s.label}</span>
          {s.badge !== undefined && (
            <TabBadge badge={s.badge} label={s.badgeLabel} tone={s.badgeTone} />
          )}
        </DropdownMenu.Item>
      ))}
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
  /** `menu` on phones: one button that names the screen and opens the list. */
  mode?: 'tabs' | 'menu'
  label?: string
  className?: string
}): ReactElement {
  const box = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const fit = useFit(box, measure, { moreWidth: MORE_WIDTH }) ?? screens.length
  const currentIndex = screens.findIndex((s) => s.id === value)
  const current = screens[currentIndex]

  if (mode === 'menu')
    return (
      <nav aria-label={label} className={cn('flex min-w-0 items-center', className)}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className={cn(
              'inline-flex h-(--density-control) min-w-0 items-center gap-1.5 rounded-md px-2 text-base text-fg hover:bg-surface-hover aria-expanded:bg-surface-hover',
              focusRing
            )}
          >
            <span className="truncate">{current?.label ?? 'Screens'}</span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-fg-secondary" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={4} className={menuContent}>
              <ScreenMenuItems screens={screens} value={value} onChange={onChange} />
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </nav>
    )

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

  return (
    <nav aria-label={label} className={cn('relative flex h-full min-w-0 flex-1', className)}>
      <div
        ref={box}
        className="flex h-full min-w-0 flex-1 items-stretch overflow-hidden"
        onKeyDown={onKeyDown}
      >
        {shown.map((s) => (
          <button
            key={s.id}
            type="button"
            data-roving=""
            tabIndex={s.id === stop ? 0 : -1}
            aria-current={s.id === value ? 'page' : undefined}
            className={tabClass}
            onClick={() => onChange(s.id)}
          >
            <TabLabel screen={s} />
          </button>
        ))}
        {hidden.length > 0 && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              data-roving=""
              tabIndex={shown.length ? -1 : 0}
              className={tabClass}
            >
              <Ellipsis aria-hidden="true" />
              More
              {hiddenBadge && (
                <TabBadge
                  badge="dot"
                  label="A screen in More needs attention"
                  tone={hiddenAttention ? 'attention' : 'neutral'}
                />
              )}
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="start" sideOffset={2} className={menuContent}>
                <ScreenMenuItems screens={hidden} value={value} onChange={onChange} />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>
      {/* an invisible copy of every tab, measured to decide how many fit */}
      <div
        ref={measure}
        aria-hidden="true"
        inert
        className="invisible absolute top-0 left-0 flex h-full w-max"
      >
        {screens.map((s) => (
          <span key={s.id} className={tabClass}>
            <TabLabel screen={s} />
          </span>
        ))}
      </div>
    </nav>
  )
}
