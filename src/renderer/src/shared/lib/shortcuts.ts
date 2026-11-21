// The keyboard shortcut registry: components register what they handle, one window listener dispatches,
// and the "Keyboard shortcuts" overlay (?) lists whatever is registered right now.
import { useEffect, useRef, useSyncExternalStore } from 'react'

export interface Shortcut {
  /** `Ctrl+I`, `Ctrl+Shift+Tab`, `[`, `?`, `F6`; Ctrl also matches Cmd. */
  keys: string
  label: string
  group: string
  run: (e: KeyboardEvent) => void
  /** Also fire while typing in a field (shortcuts with Ctrl or Alt do unless this is false). */
  inFields?: boolean
  /** Also fire while a modal dialog has focus. */
  inModals?: boolean
  /** Fires without being listed in the overlay (e.g. Ctrl 1 to 7 listed once as a range). */
  hidden?: boolean
}
type Registered = Shortcut & { readonly token: object }

export interface KeyLike {
  key: string
  code?: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

// e.code for printable keys, so `Ctrl+`` works whatever the layout puts on that key
const CODES: Record<string, string> = {
  '`': 'Backquote',
  '[': 'BracketLeft',
  ']': 'BracketRight'
}

export function parseKeys(keys: string): {
  key: string
  ctrl: boolean
  shift: boolean
  alt: boolean
} {
  const parts = keys === '+' ? ['+'] : keys.split('+')
  const key = parts.pop()!.toLowerCase()
  const mods = new Set(parts.map((p) => p.toLowerCase()))
  return { key, ctrl: mods.has('ctrl'), shift: mods.has('shift'), alt: mods.has('alt') }
}

export function matches(e: KeyLike, keys: string): boolean {
  const want = parseKeys(keys)
  if (want.ctrl !== (e.ctrlKey || e.metaKey) || want.alt !== e.altKey) return false
  const key = e.key.toLowerCase()
  const code =
    CODES[want.key] ??
    (/^[a-z]$/.test(want.key)
      ? `Key${want.key.toUpperCase()}`
      : /^\d$/.test(want.key)
        ? `Digit${want.key}`
        : null)
  const same = key === want.key || (!!code && e.code === code)
  // a single symbol like ? or [ carries its own Shift; letters, digits and named keys must match it exactly
  const symbol = want.key.length === 1 && !/[a-z0-9]/.test(want.key)
  return same && (symbol || want.shift === e.shiftKey)
}

/** `Ctrl+Shift+Tab` as shown in hints and the overlay: `Ctrl Shift Tab`. */
export const formatKeys = (keys: string): string[] => (keys === '+' ? ['+'] : keys.split('+'))

let registry: Registered[] = []
const listeners = new Set<() => void>()
const emit = (): void => listeners.forEach((l) => l())

const editable = (el: Element | null): boolean =>
  !!el?.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]')

/** Runs the newest matching shortcut; returns whether one ran. Exported for tests. */
export function dispatch(
  e: KeyLike & { target?: EventTarget | null; preventDefault?: () => void }
): boolean {
  const target = typeof Element !== 'undefined' && e.target instanceof Element ? e.target : null
  const inField = editable(target)
  const inModal = !!target?.closest('[role="dialog"][aria-modal="true"], [role="alertdialog"]')
  for (let i = registry.length - 1; i >= 0; i--) {
    const s = registry[i]
    if (!matches(e, s.keys)) continue
    const chord = e.ctrlKey || e.metaKey || e.altKey
    if (inField && (chord ? s.inFields === false : !s.inFields)) continue
    if (inModal && !s.inModals) continue
    e.preventDefault?.()
    s.run(e as KeyboardEvent)
    return true
  }
  return false
}

const onKey = (e: KeyboardEvent): void => {
  if (!e.defaultPrevented && !e.repeat) dispatch(e)
}

/** Adds a shortcut until the returned function is called. */
export function registerShortcut(s: Shortcut): () => void {
  const entry: Registered = { ...s, token: {} }
  if (registry.length === 0 && typeof window !== 'undefined')
    window.addEventListener('keydown', onKey)
  registry = [...registry, entry]
  emit()
  return () => {
    registry = registry.filter((r) => r.token !== entry.token)
    if (registry.length === 0 && typeof window !== 'undefined')
      window.removeEventListener('keydown', onKey)
    emit()
  }
}

/**
 * Registers shortcuts while the component is mounted. `run` always sees the latest props; the
 * registration only changes when the keys, labels or flags do.
 */
export function useShortcuts(list: (Shortcut | false | null | undefined)[]): void {
  const active = list.filter((s): s is Shortcut => !!s)
  const latest = useRef(active)
  useEffect(() => {
    latest.current = active
  })
  const signature = active
    .map((s) => [s.keys, s.label, s.group, s.inFields, s.inModals, s.hidden].join('|'))
    .join('\n')
  useEffect(() => {
    const offs = signature
      .split('\n')
      .filter(Boolean)
      .map((_, i) =>
        registerShortcut({ ...latest.current[i], run: (e) => latest.current[i]?.run(e) })
      )
    return () => offs.forEach((off) => off())
  }, [signature])
}

const snapshot = (): readonly Shortcut[] => registry
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
/** Every registered, listed shortcut; the newest registration of a key wins. */
export function useShortcutList(): Shortcut[] {
  const all = useSyncExternalStore(subscribe, snapshot)
  const seen = new Set<string>()
  return [...all]
    .reverse()
    .filter((s) => !s.hidden && !seen.has(s.keys) && seen.add(s.keys))
    .reverse()
}
