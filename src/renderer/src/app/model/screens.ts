// Build tab definitions and per-tab Chat dock availability.
// Chat is only available inside a build, on tabs where `chat` is true.

/**
 * Build tabs in display order. Set `chat: false` on any tab to hide the Chat dock, its toggle and
 * its Ctrl+J shortcut on that tab.
 */
export const BUILD_SCREENS = [
  { id: 'workspace', label: 'Workspace', group: 'core', chat: true },
  { id: 'review', label: 'Review', group: 'core', chat: true },
  { id: 'variants', label: 'Variants', group: 'core', chat: true },
  { id: 'ship', label: 'Export', group: 'core', chat: true },
  { id: 'site', label: 'Location', group: 'support', chat: true },
  { id: 'refs', label: 'Refs', group: 'support', chat: true },
  { id: 'log', label: 'Log', group: 'support', chat: true }
] as const

export type ScreenId = (typeof BUILD_SCREENS)[number]['id']
export type ScreenGroup = (typeof BUILD_SCREENS)[number]['group']

export interface BuildScreen {
  readonly id: ScreenId
  readonly label: string
  readonly group: ScreenGroup
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
