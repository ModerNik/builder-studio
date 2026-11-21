import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, expect, it, vi } from 'vitest'
import { SettingsSchema, type Settings } from '@shared/api'
import { createBuild } from './workspace'

const mocks = vi.hoisted(() => ({
  command: vi.fn<(file: string, args: string[], options?: unknown) => Promise<string>>(
    async () => ''
  )
}))
vi.mock('../runtime/runtime', () => ({
  installedGit: () => 'managed-git.exe',
  command: mocks.command
}))
const roots: string[] = []
afterEach(() => {
  vi.resetAllMocks()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function settings(): Settings {
  const root = mkdtempSync(join(tmpdir(), 'studio new build '))
  roots.push(root)
  mkdirSync(join(root, '.git/info'), { recursive: true })
  mocks.command.mockImplementation(async (_file: string, args: string[]) =>
    args[0] === 'rev-parse' ? '.git/info/exclude' : ''
  )
  return SettingsSchema.parse({
    workspace: root,
    python: 'runtime-python.exe',
    pack: '',
    jar: '',
    schematics: '',
    claude: ''
  })
}

it('uses the engine module with the resolved workspace environment and no duplicate template', async () => {
  const s = settings()
  const env = { MCB_WORKSPACE: s.workspace, MCB_RESOURCES: 'installed resources' }
  expect(await createBuild(s, 'starter', env)).toBe('starter')
  expect(mocks.command).toHaveBeenCalledWith(
    'runtime-python.exe',
    ['-m', 'tools.new_build', 'starter'],
    { cwd: s.workspace, env }
  )
})

it('rejects invalid names, reserved device names, paths and absent workspaces', async () => {
  const s = settings()
  for (const name of [
    '../escape',
    'UPPER',
    'bad-name',
    'con',
    'aux',
    'nul',
    'com1',
    'lpt9',
    '',
    'a'.repeat(101)
  ])
    await expect(createBuild(s, name, {})).rejects.toThrow()
  await expect(createBuild({ ...s, workspace: '' }, 'starter', {})).rejects.toThrow('workspace')
  expect(mocks.command).not.toHaveBeenCalled()
})

it('reports unavailable engine requirements before invoking the scaffold', async () => {
  const s = settings()
  mocks.command.mockImplementation(async (_file: string, args: string[]) => {
    if (args[0] === '-c') throw new Error('No module named mcb')
    return args[0] === 'rev-parse' ? '.git/info/exclude' : ''
  })
  await expect(createBuild(s, 'starter', {})).rejects.toThrow('Build runtime unavailable')
  expect(mocks.command.mock.calls.some((call) => call[1][0] === '-m')).toBe(false)
})

it('preserves a collision reported by the engine', async () => {
  const s = settings()
  mkdirSync(join(s.workspace, 'builds/starter'), { recursive: true })
  writeFileSync(join(s.workspace, 'builds/starter/build.py'), 'keep')
  mocks.command.mockImplementation(async (_file: string, args: string[]) => {
    if (args[0] === '-m') throw new Error('already exists')
    return args[0] === 'rev-parse' ? '.git/info/exclude' : ''
  })
  await expect(createBuild(s, 'starter', {})).rejects.toThrow('already exists')
})
