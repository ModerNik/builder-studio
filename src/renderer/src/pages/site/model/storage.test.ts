import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  legacySiteWorldKey,
  readSiteState,
  siteStateStorageKey,
  writeSiteState,
  type SiteStoredState
} from './storage'

function createMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key)
    },
    setItem: (key: string, value: string) => {
      data.set(key, value)
    }
  }
}

describe('Location site state persistence', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null on first open when nothing is stored and ignores legacy site:world keys', () => {
    localStorage.setItem(legacySiteWorldKey('keep'), 'C:\\saves\\DefaultWorld')
    expect(readSiteState('keep')).toBeNull()
  })

  it('persists and restores world choice along with all Location settings across restarts', () => {
    const state: SiteStoredState = {
      version: 1,
      world: 'C:\\saves\\Survival',
      dimension: 'nether',
      mode: 'build',
      versionPath: 'builds/keep/out/v3.litematic',
      cameraMode: 'iso',
      lighting: 'game',
      areaBox: [-20, -10, 40, 50],
      origin: [12, 69, -4],
      rotation: 270,
      margin: 32,
      clipY: 9
    }
    localStorage.setItem(legacySiteWorldKey('keep'), 'C:\\saves\\Old')
    writeSiteState('keep', state)

    expect(localStorage.getItem(legacySiteWorldKey('keep'))).toBeNull()
    expect(readSiteState('keep')).toEqual(state)
  })

  it('returns null when stored JSON is malformed or missing a world path', () => {
    localStorage.setItem(siteStateStorageKey('keep'), '{not json')
    expect(readSiteState('keep')).toBeNull()

    localStorage.setItem(
      siteStateStorageKey('keep'),
      JSON.stringify({ version: 1, world: '', cameraMode: '3d' })
    )
    expect(readSiteState('keep')).toBeNull()
  })
})
