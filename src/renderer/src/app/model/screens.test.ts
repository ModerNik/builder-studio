import { describe, expect, it } from 'vitest'
import { BUILD_SCREENS, hasChatDock, type BuildScreen } from './screens'

describe('hasChatDock', () => {
  it('disables Chat on app pages (no open build)', () => {
    for (const s of BUILD_SCREENS) {
      expect(hasChatDock(null, s.id)).toBe(false)
    }
  })

  it('enables Chat on every build tab by default', () => {
    for (const s of BUILD_SCREENS) {
      expect(hasChatDock('district', s.id)).toBe(true)
    }
  })

  it('places Export (ship) at the end of the build tabs', () => {
    expect(BUILD_SCREENS.at(-1)).toEqual({ id: 'ship', label: 'Export', chat: true })
    expect(BUILD_SCREENS.map((s) => s.id)).toEqual([
      'workspace',
      'review',
      'variants',
      'site',
      'refs',
      'log',
      'ship'
    ])
  })

  it('respects per-tab chat flags when a tab opts out', () => {
    const custom: BuildScreen[] = BUILD_SCREENS.map((s) =>
      s.id === 'log' || s.id === 'ship' ? { ...s, chat: false } : s
    )
    expect(hasChatDock('district', 'workspace', custom)).toBe(true)
    expect(hasChatDock('district', 'review', custom)).toBe(true)
    expect(hasChatDock('district', 'log', custom)).toBe(false)
    expect(hasChatDock('district', 'ship', custom)).toBe(false)
    expect(hasChatDock(null, 'workspace', custom)).toBe(false)
  })
})
