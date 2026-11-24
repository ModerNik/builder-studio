// Workbench layout (S3): container-width tiers, the dock state machine, overflow fitting and remembered layout.
// Pure functions first (tested in layout.test.ts), then the React hooks that feed them.
import { useEffect, useState, type RefObject } from 'react'

/** S3 tiers by container width in rem (the root size grows with the window): ≥90 wide (1440px at 16px),
 * 68.75–90 desktop (1100px), 40–68.75 tablet (640px), below that phone. */
export type Tier = 'wide' | 'desktop' | 'tablet' | 'phone'
export const tierOf = (rem: number): Tier =>
  rem >= 90 ? 'wide' : rem >= 68.75 ? 'desktop' : rem >= 40 ? 'tablet' : 'phone'
/** Docks sit beside the canvas; below 1100 every panel moves into one sheet. */
export const docked = (tier: Tier): boolean => tier === 'wide' || tier === 'desktop'

export type DockSide = 'right' | 'bottom'
export interface DockPanelSpec {
  id: string
  side: DockSide
  /** Open on first use at wide; at desktop only right panels open by default (Activity starts closed). */
  defaultOpen?: boolean
}
export type SheetSize = 'half' | 'full'
export interface DockState {
  open: string[] // panels shown in docks (wide, desktop)
  active: Partial<Record<DockSide, string>> // the tab in front where panels share a group
  sheet: { tab: string; size: SheetSize } | null // tablet and phone
}
export interface DockLayout {
  columns: string[][] // right dock, left to right; tabs within a column
  bottom: string[] // bottom dock tabs
  sheet: { tabs: string[]; tab: string; size: SheetSize } | null
}

export function defaultDock(tier: Tier, panels: DockPanelSpec[]): DockState {
  if (!docked(tier)) return { open: [], active: {}, sheet: null }
  const open = panels.filter((p) => p.defaultOpen && (tier === 'wide' || p.side === 'right'))
  return { open: open.map((p) => p.id), active: {}, sheet: null }
}

/** Where each panel goes for a tier: two right columns at wide, one tabbed column at desktop, a sheet below. */
export function resolveDock(tier: Tier, panels: DockPanelSpec[], state: DockState): DockLayout {
  if (!docked(tier)) {
    const tabs = panels.map((p) => p.id)
    const tab = state.sheet && tabs.includes(state.sheet.tab) ? state.sheet.tab : null
    return {
      columns: [],
      bottom: [],
      sheet: tab ? { tabs, tab, size: tier === 'phone' ? 'full' : state.sheet!.size } : null
    }
  }
  const open = (side: DockSide): string[] =>
    panels.filter((p) => p.side === side && state.open.includes(p.id)).map((p) => p.id)
  const right = open('right')
  // wide: the first open panel gets its own column and the rest share the second
  const columns =
    right.length === 0
      ? []
      : tier === 'wide' && right.length > 1
        ? [right.slice(0, 1), right.slice(1)]
        : [right]
  return { columns, bottom: open('bottom'), sheet: null }
}

/** The tab a group shows: the side's active panel when it is in the group, else the first. */
export const frontOf = (group: string[], state: DockState, side: DockSide): string =>
  group.find((id) => id === state.active[side]) ?? group[0]

function visible(tier: Tier, panels: DockPanelSpec[], state: DockState, id: string): boolean {
  const layout = resolveDock(tier, panels, state)
  if (layout.sheet) return layout.sheet.tab === id
  const groups = [
    ...layout.columns.map((g) => ['right', g] as const),
    ['bottom', layout.bottom] as const
  ]
  return groups.some(([side, g]) => g.length > 0 && frontOf(g, state, side) === id)
}

export type DockAction =
  | { type: 'toggle'; id: string } // Ctrl I / J / ` and the Panels toggles
  | { type: 'select'; id: string } // a dock or sheet tab
  | { type: 'open'; id: string } // show it in front, never close it (a screen asking for the Assistant)
  | { type: 'close'; id: string }
  | { type: 'collapse'; side: DockSide } // fold a dock to its rail
  | { type: 'sheet-size'; size: SheetSize }
  | { type: 'close-sheet' }

/** Toggling a panel that is open but behind another tab brings it to the front instead of closing it. */
export function dockReducer(
  tier: Tier,
  panels: DockPanelSpec[],
  state: DockState,
  action: DockAction
): DockState {
  const side = (id: string): DockSide => panels.find((p) => p.id === id)?.side ?? 'right'
  const front = (id: string): DockState['active'] => ({ ...state.active, [side(id)]: id })
  switch (action.type) {
    case 'toggle': {
      if (!docked(tier)) {
        if (state.sheet?.tab === action.id) return { ...state, sheet: null }
        return { ...state, sheet: { tab: action.id, size: state.sheet?.size ?? 'half' } }
      }
      if (visible(tier, panels, state, action.id))
        return { ...state, open: state.open.filter((id) => id !== action.id) }
      const open = state.open.includes(action.id) ? state.open : [...state.open, action.id]
      return { ...state, open, active: front(action.id) }
    }
    case 'open': {
      if (!docked(tier))
        return { ...state, sheet: { tab: action.id, size: state.sheet?.size ?? 'half' } }
      const open = state.open.includes(action.id) ? state.open : [...state.open, action.id]
      return { ...state, open, active: front(action.id) }
    }
    case 'select':
      if (!docked(tier))
        return { ...state, sheet: { tab: action.id, size: state.sheet?.size ?? 'half' } }
      return { ...state, active: front(action.id) }
    case 'close':
      return { ...state, open: state.open.filter((id) => id !== action.id) }
    case 'collapse':
      return { ...state, open: state.open.filter((id) => side(id) !== action.side) }
    case 'sheet-size':
      return state.sheet ? { ...state, sheet: { ...state.sheet, size: action.size } } : state
    case 'close-sheet':
      return { ...state, sheet: null }
  }
}

/**
 * How many leading items fit in `available` px. When not all of them fit, room is kept for a More button.
 * `pinned` px stay reserved for items that never overflow (a primary action at the end).
 */
export function fitCount(
  widths: number[],
  available: number,
  gap: number,
  moreWidth: number,
  pinned = 0
): number {
  const room = available - pinned
  const total = widths.reduce((sum, w, i) => sum + w + (i ? gap : 0), 0)
  if (total <= room) return widths.length
  let used = moreWidth
  for (let i = 0; i < widths.length; i++) {
    used += widths[i] + gap
    if (used > room) return i
  }
  return widths.length
}

/** A value kept per viewer in localStorage; private windows and blocked storage fall back to `fallback`. */
/** A remembered layout with a panel id renamed (the Editor dock was `inspector`), so it stays open. */
export function renamePanel<T extends DockState & { sizes?: Record<string, number> }>(
  state: T,
  from: string,
  to: string
): T {
  const id = (v: string): string => (v === from ? to : v)
  return {
    ...state,
    open: state.open.map(id),
    active: Object.fromEntries(Object.entries(state.active).map(([k, v]) => [k, v && id(v)])),
    sheet: state.sheet && { ...state.sheet, tab: id(state.sheet.tab) },
    ...(state.sizes && {
      sizes: Object.fromEntries(Object.entries(state.sizes).map(([k, v]) => [id(k), v]))
    })
  }
}

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
export function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: the layout is simply not remembered */
  }
}

/** The element's layout width (unaffected by CSS transforms, so scaled kit previews report their real width). */
export function useContainerWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}

/**
 * Overflow by measurement: `measure` holds an inert, invisible copy of every item in one row; the hook
 * returns how many fit in `container` beside a More button of `moreWidth` px.
 */
export function useFit(
  container: RefObject<HTMLElement | null>,
  measure: RefObject<HTMLElement | null>,
  { moreWidth, pinned = 0 }: { moreWidth: number; pinned?: number }
): number | null {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    const box = container.current
    const row = measure.current
    if (!box || !row) return
    const update = (): void => {
      const items = [...row.children] as HTMLElement[]
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0
      setCount(
        fitCount(
          items.map((el) => el.offsetWidth),
          box.clientWidth,
          gap,
          moreWidth,
          pinned
        )
      )
    }
    const observer = new ResizeObserver(update)
    observer.observe(box)
    observer.observe(row)
    return () => observer.disconnect()
  }, [container, measure, moreWidth, pinned])
  return count
}

/** A token's length in px (e.g. `--dock-editor`), read from the document. */
export function tokenPx(token: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  const ref = /^var\((--[\w-]+)\)$/.exec(v)
  if (ref) return tokenPx(ref[1], fallback)
  const n = parseFloat(v)
  if (Number.isNaN(n)) return fallback
  return v.endsWith('rem') ? n * remPx() : n
}

/** The root font size in px; it grows with the window, so rem tokens do too. */
export function remPx(): number {
  if (typeof document === 'undefined') return 16
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
}

/** Translate a completed user layout to pixels, excluding the separators from the group size. */
export function committedDockSize(
  percentage: number | undefined,
  isUserInteraction: boolean,
  group: HTMLElement | null,
  axis: 'width' | 'height'
): number | undefined {
  if (!isUserInteraction || percentage === undefined || !group) return
  const dimension = axis === 'width' ? 'offsetWidth' : 'offsetHeight'
  const available = Array.from(group.children).reduce(
    (sum, item) => (item.hasAttribute('data-panel') ? sum + (item as HTMLElement)[dimension] : sum),
    0
  )
  return available > 0 ? Math.round((available * percentage) / 100) : undefined
}
