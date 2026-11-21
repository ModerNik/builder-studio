// Shared classes for every menu-like list: DropdownMenu, ContextMenu, Menubar, Select and Command.
// Rows are --density-row tall; the highlighted row is a hover fill; destructive rows use danger text.

export const menuContent =
  'motion-pop z-dropdown min-w-36 overflow-x-hidden overflow-y-auto rounded-lg border border-border-default bg-surface-overlay p-1 text-fg shadow-md outline-none'

export const menuItem =
  "relative flex min-h-(--density-row) cursor-pointer items-center gap-2 rounded-sm px-2 text-(length:--density-text) outline-none select-none data-highlighted:bg-surface-hover data-disabled:cursor-not-allowed data-disabled:text-fg-disabled data-inset:ps-8 data-[variant=destructive]:text-danger-text data-[variant=destructive]:data-highlighted:bg-danger-subtle [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-fg-muted data-[variant=destructive]:[&_svg]:text-danger-text! data-disabled:[&_svg]:text-fg-disabled!"

/** A checkbox or radio row: room at the start for the indicator. */
export const menuChoiceItem = `${menuItem} ps-8`

export const menuIndicator =
  'pointer-events-none absolute start-2 flex size-4 items-center justify-center'

export const menuLabel = 'px-2 pt-2 pb-1 text-xs font-medium text-fg-muted data-inset:ps-8'

// border-subtle is darker than surface-overlay in dark, so it disappeared
export const menuSeparator = '-mx-1 my-1 h-px bg-border-strong/40'

export const menuShortcut = 'ms-auto ps-4 font-mono text-2xs tracking-wide text-fg-muted'
