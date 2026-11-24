// Build tab definitions and per-tab Chat dock availability.
// Chat is only available inside a build, on tabs where `chat` is true.

/**
 * Build tabs in display order. Set `chat: false` on any tab to hide the Chat dock, its toggle and
 * its Ctrl+J shortcut on that tab.
 */
export const BUILD_SCREENS = [
  { id: 'workspace', label: 'Workspace', chat: true },
  { id: 'review', label: 'Review', chat: true },
  { id: 'variants', label: 'Variants', chat: true },
  { id: 'ship', label: 'Export', chat: true },
  { id: 'site', label: 'Location', chat: true },
  { id: 'refs', label: 'Refs', chat: true },
  { id: 'log', label: 'Log', chat: true }
] as const

export type ScreenId = (typeof BUILD_SCREENS)[number]['id']

export interface BuildScreen {
  readonly id: ScreenId
  readonly label: string
  readonly chat: boolean
}

export const BUILD_ROUTE = /^\/build\/(.+?)(?:\/(review|log|ship|site|refs|variants))?$/

/** True when the current route hosts the Assistant (Chat) dock. */
export function hasChatDock(
  currentBuild: string | null,
  screen: ScreenId,
  screens: readonly BuildScreen[] = BUILD_SCREENS
): boolean {
  if (!currentBuild) return false
  return screens.some((s) => s.id === screen && s.chat)
}
