// What still needs setting up, in plain words, and how to fix each: the title-bar chip, its toast and Settings share it.
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { Availability, Repair, Requirement, RuntimeAction } from '@shared/api'

export const SECTIONS = ['general', 'minecraft', 'ai', 'agents', 'tools', 'advanced'] as const
export type Section = (typeof SECTIONS)[number]
export const REPAIR_SECTION: Record<Repair, Section> = {
  workspace: 'general',
  runtime: 'tools',
  minecraft: 'minecraft',
  ai: 'ai'
}

export type Issue = Requirement
export const ISSUES: Record<
  Issue,
  {
    name: string
    why: string // one line, what it unlocks
    effect: string // the toast title: what the user notices without it
    action: string
    section: Section
    install?: RuntimeAction // runs straight from the notice
  }
> = {
  workspace: {
    name: 'Workspace folder',
    why: 'Choose where your builds are kept.',
    effect: 'Builds have nowhere to go yet',
    action: 'Set up',
    section: 'general'
  },
  engine: {
    name: 'Build engine',
    why: 'Generates and checks builds.',
    effect: 'Builds can’t be generated yet',
    action: 'Install',
    section: 'tools',
    install: 'engine'
  },
  pack: {
    name: '3D view textures (optional)',
    why: 'Add game files to see blocks textured in the 3D view. Builds still work without them.',
    effect: 'The 3D view has no textures',
    action: 'Set up',
    section: 'minecraft'
  },
  browser: {
    name: 'Preview browser',
    why: 'Needed for preview images and site pages.',
    effect: 'Preview images are off',
    action: 'Install',
    section: 'tools',
    install: 'browser'
  },
  export: {
    name: 'Exported schematics folder',
    why: 'Choose where Export copies finished builds.',
    effect: 'Export has no destination',
    action: 'Set up',
    section: 'minecraft'
  },
  ai: {
    name: 'AI assistant',
    why: 'Not connected. Builds work without it.',
    effect: 'The AI assistant isn’t connected',
    action: 'Set up',
    section: 'ai'
  },
  git: {
    name: 'Git',
    why: 'Keeps a history of every build version.',
    effect: 'Build history is off',
    action: 'Install',
    section: 'tools',
    install: 'git'
  },
  identity: {
    name: 'Your name for build history',
    why: 'Each saved build version is signed with a name and email.',
    effect: 'Build versions can’t be saved yet',
    action: 'Set up',
    section: 'tools'
  }
}

/** The requirements still missing, in a stable order. */
export function missingIssues(availability: Availability | undefined): Issue[] {
  if (!availability) return []
  return (Object.keys(ISSUES) as Issue[]).filter((id) => !availability.requirements[id]?.ok)
}

// localStorage can throw (blocked or full storage); a lost dismissal only means one more toast
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      /* not remembered */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* not remembered */
    }
  }
}

/** Issues whose toast the user dismissed. They stay in the chip; one fixed and broken again toasts again. */
export const useDismissed = create<{ ids: Issue[] }>()(
  persist(() => ({ ids: [] as Issue[] }), {
    name: 'setup-notices',
    storage: createJSONStorage(() => safeStorage)
  })
)

/** Dismissals of issues that are fixed now are forgotten, so they toast again if they come back. */
export const keepDismissed = (dismissed: Issue[], missing: Issue[]): Issue[] =>
  dismissed.filter((id) => missing.includes(id))
/** The issues a toast should tell about: missing and not dismissed. */
export const toastIssues = (missing: Issue[], dismissed: Issue[]): Issue[] =>
  missing.filter((id) => !dismissed.includes(id))

/**
 * After a fix opens a Settings section, focus the control that fixes it: the element marked
 * `data-issue="<requirement>"` (several requirements space-separated). Waits a few frames for the section.
 */
export function focusIssue(issue: Requirement, tries = 20): void {
  const el = document.querySelector<HTMLElement>(`[data-issue~="${issue}"]`)
  if (el) {
    el.scrollIntoView({ block: 'center' })
    el.focus()
  } else if (tries > 0) requestAnimationFrame(() => focusIssue(issue, tries - 1))
}
