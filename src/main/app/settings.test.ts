import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ dir: '', packaged: false }))
vi.mock('electron', () => ({
  app: {
    getPath: () => state.dir,
    getAppPath: () => process.cwd(),
    get isPackaged() {
      return state.packaged
    }
  }
}))
afterEach(() => {
  state.packaged = false
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.doUnmock('../runtime/detect')
  if (state.dir) rmSync(state.dir, { recursive: true, force: true })
})

describe('loading settings', () => {
  it('adds provider defaults without resetting existing version 2 settings or credentials', async () => {
    vi.resetModules()
    state.dir = mkdtempSync(join(tmpdir(), 'studio provider settings '))
    const raw = {
      version: 2,
      workspace: 'workspace',
      claude: 'my-claude.exe',
      agentAllow: { tower: ['Read'] },
      variantCap: 4
    }
    const file = join(state.dir, 'settings.json')
    writeFileSync(file, JSON.stringify(raw))
    const { getSettings, setSettings } = await import('./settings')
    const s = getSettings()
    expect(s).toMatchObject({
      ...raw,
      provider: 'claude',
      codex: '',
      gitBash: '',
      ollamaEndpoint: 'http://127.0.0.1:11434',
      ollamaModel: ''
    })
    setSettings({ ...s, provider: 'codex' })
    expect(JSON.parse(readFileSync(file, 'utf8')).agentAllow).toEqual(raw.agentAllow)
    expect(existsSync(file + '.v1.bak')).toBe(false)
  })
  it('loads a version 1 file as is: compatible fields kept, unknown keys ignored, file untouched', async () => {
    vi.resetModules()
    state.dir = mkdtempSync(join(tmpdir(), 'studio settings сборка '))
    const file = join(state.dir, 'settings.json')
    const legacy = JSON.stringify({
      repo: 'old checkout',
      python: 'D:/old checkout/.venv/Scripts/python.exe',
      pack: 'D:/old checkout/pack.zip',
      jar: 'client.jar',
      schematics: '',
      claude: ''
    })
    writeFileSync(file, legacy)
    const { getSettings } = await import('./settings')
    const s = getSettings()
    expect(s).toMatchObject({
      version: 2,
      workspace: '',
      importSource: '',
      python: 'D:/old checkout/.venv/Scripts/python.exe',
      pack: 'D:/old checkout/pack.zip',
      jar: 'client.jar',
      variantCap: 3
    })
    expect(s).not.toHaveProperty('repo')
    expect(readFileSync(file, 'utf8')).toBe(legacy)
    expect(readdirSync(state.dir)).toEqual(['settings.json'])
  })

  it('falls back per field instead of failing to start on an invalid value', async () => {
    vi.resetModules()
    state.dir = mkdtempSync(join(tmpdir(), 'studio settings invalid '))
    const file = join(state.dir, 'settings.json')
    const raw = JSON.stringify({ version: 1, workspace: 'kept', claude: 7, variantCap: 9 })
    writeFileSync(file, raw)
    const { getSettings } = await import('./settings')
    expect(getSettings()).toMatchObject({
      version: 2,
      workspace: 'kept',
      claude: '',
      variantCap: 3
    })
    expect(readFileSync(file, 'utf8')).toBe(raw)
  })

  it('fills linter defaults on legacy and partial settings and saves rule toggles', async () => {
    vi.resetModules()
    state.dir = mkdtempSync(join(tmpdir(), 'studio settings linter '))
    const file = join(state.dir, 'settings.json')
    writeFileSync(
      file,
      JSON.stringify({
        version: 2,
        workspace: 'workspace',
        linter: { enabled: false, rules: { dark: false, floating: true } }
      })
    )
    const { getSettings, setSettings } = await import('./settings')
    const s = getSettings()
    expect(s.linter).toEqual({
      enabled: false,
      rules: {
        floating: true,
        unattached: true,
        gravity: true,
        halves: true,
        fire: true,
        leaves: true,
        invalid: true,
        dark: false,
        see_through: true,
        groove: true
      }
    })
    setSettings({
      ...s,
      linter: { enabled: true, rules: { ...s.linter.rules, gravity: false } }
    })
    expect(JSON.parse(readFileSync(file, 'utf8')).linter.rules.gravity).toBe(false)
  })

  it('applies BS_* env overrides in development and ignores them when packaged', async () => {
    vi.resetModules()
    state.dir = mkdtempSync(join(tmpdir(), 'studio settings env '))
    vi.stubEnv('BS_WORKSPACE', 'D:\\Dev\\Workspace')
    vi.stubEnv('BS_PROVIDER', 'codex')
    vi.stubEnv('BS_SETUP_COMPLETED', 'true')
    const devSettings = await import('./settings')
    expect(devSettings.getSettings()).toMatchObject({
      workspace: 'D:\\Dev\\Workspace',
      provider: 'codex',
      setup: { step: 'verify', completed: true }
    })

    vi.resetModules()
    state.packaged = true
    const packagedSettings = await import('./settings')
    expect(packagedSettings.getSettings()).toMatchObject({
      workspace: '',
      provider: 'claude',
      setup: { step: 'welcome', completed: false }
    })
  })
})

it('looks for the Minecraft jar once per version in 5 seconds, not on every resolved() call', async () => {
  vi.resetModules()
  vi.useFakeTimers()
  state.dir = mkdtempSync(join(tmpdir(), 'studio settings jar '))
  const findJar = vi.fn((_appData: string, version = 'default') => `${version}.jar`)
  vi.doMock('../runtime/detect', () => ({ findClaude: () => null, findJar }))
  const { getSettings, resolved } = await import('./settings')
  const jar = (version?: string): string => resolved(getSettings(), version).jar
  expect([jar(), jar(), jar()].every((p) => p.endsWith('default.jar'))).toBe(true)
  expect(findJar).toHaveBeenCalledTimes(1)
  expect(jar('1.12.2')).toMatch(/1\.12\.2\.jar$/)
  expect(jar('1.12.2')).toMatch(/1\.12\.2\.jar$/)
  expect(findJar).toHaveBeenCalledTimes(2)
  vi.advanceTimersByTime(5001)
  jar()
  expect(findJar).toHaveBeenCalledTimes(3)
})
