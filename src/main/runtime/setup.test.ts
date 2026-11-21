import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, expect, it, vi } from 'vitest'
import { validateWorkspace } from '../workspace/workspace'

const state = vi.hoisted(() => ({ dir: '' }))
vi.mock('electron', () => ({
  app: { getPath: () => state.dir, getAppPath: () => process.cwd(), isPackaged: false }
}))
afterEach(() => {
  if (state.dir) rmSync(state.dir, { recursive: true, force: true })
})

it('starts fresh, resumes saved setup after reload and reopens without losing settings or projects', async () => {
  state.dir = mkdtempSync(join(tmpdir(), 'studio setup '))
  vi.resetModules()
  let settings = await import('../app/settings')
  expect(settings.getSettings().setup).toEqual({ step: 'welcome', completed: false })
  const workspace = join(state.dir, 'projects')
  mkdirSync(workspace)
  writeFileSync(join(workspace, 'keep.txt'), 'existing project')
  settings.setSettings({
    ...settings.getSettings(),
    workspace,
    importSource: 'old checkout',
    provider: 'ollama',
    ollamaModel: 'existing model',
    setup: { step: 'minecraft', completed: false }
  })
  vi.resetModules()
  settings = await import('../app/settings')
  const resumed = settings.getSettings()
  expect(resumed.setup).toEqual({ step: 'minecraft', completed: false })
  settings.setSettings({ ...resumed, setup: { step: 'verify', completed: true } })
  settings.setSettings({ ...settings.getSettings(), setup: { step: 'welcome', completed: false } })
  expect(settings.getSettings()).toMatchObject({
    workspace,
    importSource: 'old checkout',
    provider: 'ollama',
    ollamaModel: 'existing model'
  })
  expect(readFileSync(join(workspace, 'keep.txt'), 'utf8')).toBe('existing project')
})

it('validates or creates only an absolute writable workspace separate from application storage', async () => {
  state.dir = mkdtempSync(join(tmpdir(), 'studio workspace validation '))
  const workspace = join(state.dir, 'workspace')
  await expect(validateWorkspace('', [], true)).rejects.toThrow('Choose a workspace')
  await expect(validateWorkspace('relative', [], true)).rejects.toThrow('absolute')
  await expect(validateWorkspace(workspace, [state.dir], true)).rejects.toThrow('separate')
  await validateWorkspace(workspace, [], true)
  expect(readdirSync(workspace)).toEqual([])
  writeFileSync(join(workspace, 'existing'), 'keep')
  await validateWorkspace(workspace)
  expect(readdirSync(workspace)).toEqual(['existing'])
  await expect(validateWorkspace(join(workspace, 'existing'))).rejects.toThrow('directory')
  await expect(validateWorkspace(join(state.dir, 'missing'))).rejects.toThrow()
})
