// Class strings the shell, layout and viewer kits share: the focus ring, chrome buttons and chrome menus.
import { cn } from '@/shared/lib/utils'

export const focusRing =
  'outline-none focus-visible:outline-(length:--focus-width) focus-visible:outline-offset-(length:--focus-offset) focus-visible:outline-ring focus-visible:outline-solid'

/** Chrome control: transparent at rest, surface-hover on hover, verdigris text when pressed or selected. */
export const chromeButton = cn(
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-fg-secondary transition-colors duration-fast ease-standard',
  'hover:bg-surface-hover hover:text-fg disabled:pointer-events-none disabled:text-fg-disabled',
  'aria-pressed:text-accent-text aria-expanded:bg-surface-hover aria-expanded:text-fg [&_svg]:size-4 [&_svg]:shrink-0',
  focusRing
)

/** Menus opened from shell chrome (More, screen and build menus, toolbar overflow). */
export const menuContent =
  'z-dropdown max-h-[min(26.25rem,70vh)] min-w-48 overflow-y-auto rounded-lg border border-border-subtle bg-surface-overlay p-1 text-fg shadow-md'
export const menuItem = cn(
  'flex min-h-(--density-row) cursor-default items-center gap-2 rounded-sm px-2 outline-none select-none',
  'data-highlighted:bg-surface-hover data-disabled:text-fg-disabled [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-secondary'
)
