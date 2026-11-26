import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  const api: object = new Proxy(() => Promise.resolve([]), { get: () => api })
  Object.assign(globalThis, { window: { studio: api, location: {} } })
})

const { clearShow, matchShow, useShow } = await import('./builds')

describe('workspace show requests', () => {
  beforeEach(() => {
    useShow.setState({ path: null, sheet: null, t: 0 })
  })

  it('matches only requests belonging to the open build', () => {
    const sheet = { path: null, sheet: 'builds/tower/out/v1_3d/sheet.png', t: 1 }
    expect(matchShow(sheet, 'tower')).toEqual({ sheet: 'builds/tower/out/v1_3d/sheet.png' })
    expect(matchShow(sheet, 'tower_2')).toBeNull()
    expect(matchShow(sheet, 'castle')).toBeNull()

    const version = { path: 'builds/_examples/keep/out/v2.litematic', sheet: null, t: 2 }
    expect(matchShow(version, '_examples/keep')).toEqual({
      path: 'builds/_examples/keep/out/v2.litematic'
    })
    expect(matchShow({ path: null, sheet: null, t: 0 }, 'tower')).toBeNull()
  })

  it('clears a consumed sheet request so reopening Workspace defaults to 3D', () => {
    useShow.setState({ path: null, sheet: 'builds/tower/out/v1_3d/sheet.png', t: 10 })
    const first = useShow.getState()
    expect(matchShow(first, 'tower')).toEqual({ sheet: 'builds/tower/out/v1_3d/sheet.png' })

    clearShow(first)
    expect(useShow.getState()).toEqual({ path: null, sheet: null, t: 0 })
    expect(matchShow(useShow.getState(), 'tower')).toBeNull()
  })

  it('does not clobber a newer show request when clearing an older one', () => {
    useShow.setState({ path: null, sheet: 'builds/tower/out/v1_3d/sheet.png', t: 10 })
    const first = useShow.getState()

    useShow.setState({ path: 'builds/tower/out/v2.litematic', sheet: null, t: 20 })
    const second = useShow.getState()

    clearShow(first)
    expect(useShow.getState()).toBe(second)
    expect(matchShow(useShow.getState(), 'tower')).toEqual({
      path: 'builds/tower/out/v2.litematic'
    })
  })
})
