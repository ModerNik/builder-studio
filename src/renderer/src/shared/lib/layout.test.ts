import { describe, expect, it } from 'vitest'
import {
  committedDockSize,
  defaultDock,
  dockReducer,
  fitCount,
  renamePanel,
  resolveDock,
  tierOf,
  type DockPanelSpec
} from './layout'

const panels: DockPanelSpec[] = [
  { id: 'editor', side: 'right', defaultOpen: true },
  { id: 'assistant', side: 'right', defaultOpen: true },
  { id: 'activity', side: 'bottom', defaultOpen: true }
]
const review: DockPanelSpec[] = [{ id: 'feedback', side: 'right', defaultOpen: true }, ...panels]

describe('tierOf', () => {
  it('cuts at 1440, 1100 and 640', () => {
    expect([1920, 1440, 1439, 1100, 1099, 640, 639, 360].map((px) => tierOf(px / 16))).toEqual([
      'wide',
      'wide',
      'desktop',
      'desktop',
      'tablet',
      'tablet',
      'phone',
      'phone'
    ])
  })
})

describe('resolveDock', () => {
  it('gives each right panel a column at wide, with the bottom dock open', () => {
    const layout = resolveDock('wide', panels, defaultDock('wide', panels))
    expect(layout).toEqual({
      columns: [['editor'], ['assistant']],
      bottom: ['activity'],
      sheet: null
    })
  })
  it('shares the second column when more than two right panels are open', () => {
    const layout = resolveDock('wide', review, defaultDock('wide', review))
    expect(layout.columns).toEqual([['feedback'], ['editor', 'assistant']])
  })
  it('merges the right panels into one tabbed column at desktop and folds Activity away', () => {
    const layout = resolveDock('desktop', review, defaultDock('desktop', review))
    expect(layout).toEqual({
      columns: [['feedback', 'editor', 'assistant']],
      bottom: [],
      sheet: null
    })
  })
  it('moves everything into one sheet below 1100, full screen on phones', () => {
    const closed = defaultDock('tablet', panels)
    expect(resolveDock('tablet', panels, closed).sheet).toBeNull()
    const open = dockReducer('tablet', panels, closed, { type: 'toggle', id: 'assistant' })
    expect(resolveDock('tablet', panels, open).sheet).toEqual({
      tabs: ['editor', 'assistant', 'activity'],
      tab: 'assistant',
      size: 'half'
    })
    expect(resolveDock('phone', panels, open).sheet?.size).toBe('full')
  })
  it('ignores remembered panels the screen does not have', () => {
    const state = { open: ['feedback', 'editor'], active: {}, sheet: null }
    expect(resolveDock('desktop', panels, state).columns).toEqual([['editor']])
  })
})

describe('dockReducer', () => {
  it('toggles a visible panel closed and back open in front', () => {
    const start = defaultDock('wide', panels)
    const closed = dockReducer('wide', panels, start, { type: 'toggle', id: 'assistant' })
    expect(closed.open).toEqual(['editor', 'activity'])
    const again = dockReducer('wide', panels, closed, { type: 'toggle', id: 'assistant' })
    expect(again.open).toContain('assistant')
    expect(again.active.right).toBe('assistant')
  })
  it('brings a panel hidden behind another tab to the front instead of closing it', () => {
    const start = defaultDock('desktop', panels) // editor in front of assistant
    const next = dockReducer('desktop', panels, start, { type: 'toggle', id: 'assistant' })
    expect(next.open).toEqual(start.open)
    expect(next.active.right).toBe('assistant')
    const closed = dockReducer('desktop', panels, next, { type: 'toggle', id: 'assistant' })
    expect(closed.open).toEqual(['editor'])
  })
  it('switches the sheet tab, then closes it on a second toggle', () => {
    let s = defaultDock('phone', panels)
    s = dockReducer('phone', panels, s, { type: 'toggle', id: 'editor' })
    s = dockReducer('phone', panels, s, { type: 'toggle', id: 'activity' })
    expect(s.sheet?.tab).toBe('activity')
    s = dockReducer('phone', panels, s, { type: 'toggle', id: 'activity' })
    expect(s.sheet).toBeNull()
  })
  it('opens a closed panel in front and leaves an open one open', () => {
    const closed = dockReducer('wide', panels, defaultDock('wide', panels), {
      type: 'close',
      id: 'assistant'
    })
    const s = dockReducer('wide', panels, closed, { type: 'open', id: 'assistant' })
    expect(s.open).toContain('assistant')
    expect(dockReducer('wide', panels, s, { type: 'open', id: 'assistant' }).open).toEqual(s.open)
    expect(dockReducer('phone', panels, s, { type: 'open', id: 'assistant' }).sheet?.tab).toBe(
      'assistant'
    )
  })
  it('collapses one side to its rail', () => {
    const s = dockReducer('wide', panels, defaultDock('wide', panels), {
      type: 'collapse',
      side: 'right'
    })
    expect(s.open).toEqual(['activity'])
  })
})

describe('fitCount', () => {
  it('fits everything when there is room, without a More button', () => {
    expect(fitCount([100, 100, 100], 316, 8, 60)).toBe(3)
  })
  it('keeps room for More when items overflow', () => {
    // 100 + 8 + 100 + 8 + 60 = 276 fits two; a third needs 384
    expect(fitCount([100, 100, 100], 300, 8, 60)).toBe(2)
  })
  it('reserves pinned space and can fit nothing', () => {
    expect(fitCount([100, 100], 200, 8, 60, 120)).toBe(0)
  })
})

describe('committedDockSize', () => {
  it('saves final user sizes in pixels and ignores initial and passive layout changes', () => {
    const panel = (
      width: number,
      height: number,
      isPanel: boolean
    ): Pick<HTMLElement, 'offsetWidth' | 'offsetHeight' | 'hasAttribute'> => ({
      offsetWidth: width,
      offsetHeight: height,
      hasAttribute: (name: string) => isPanel && name === 'data-panel'
    })
    const group = {
      children: [panel(700, 450, true), panel(1, 1, false), panel(300, 150, true)]
    } as unknown as HTMLElement

    expect(committedDockSize(30, false, group, 'width')).toBeUndefined()
    expect(committedDockSize(36, true, group, 'width')).toBe(360)
    expect(committedDockSize(25, true, group, 'height')).toBe(150)
  })
})

describe('renamePanel', () => {
  it('keeps a remembered Inspector dock open as the Editor', () => {
    const saved = {
      open: ['inspector', 'assistant'],
      active: { right: 'inspector' },
      sheet: { tab: 'inspector', size: 'half' as const },
      sizes: { inspector: 320, bottom: 200 }
    }
    expect(renamePanel(saved, 'inspector', 'editor')).toEqual({
      open: ['editor', 'assistant'],
      active: { right: 'editor' },
      sheet: { tab: 'editor', size: 'half' },
      sizes: { editor: 320, bottom: 200 }
    })
  })
})
