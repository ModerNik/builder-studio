import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
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

it('maps flexible display names with spaces and symbols to safe slugs and writes project.json', async () => {
  const s = settings()
  const env = { MCB_WORKSPACE: s.workspace, MCB_RESOURCES: 'installed resources' }
  mocks.command.mockImplementation(async (_file: string, args: string[]) => {
    if (args[0] === 'rev-parse') return '.git/info/exclude'
    if (args[0] === '-m' && args[1] === 'tools.new_build') {
      const dir = join(s.workspace, 'builds', args[2])
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'build.py'), '# stub\n')
    }
    return ''
  })
  const slug = await createBuild(s, 'Winter Castle #2: Gate & Tower!', env)
  expect(slug).toBe('winter_castle_2_gate_tower')
  expect(mocks.command).toHaveBeenCalledWith(
    'runtime-python.exe',
    ['-m', 'tools.new_build', 'winter_castle_2_gate_tower'],
    { cwd: s.workspace, env }
  )
  expect(
    JSON.parse(readFileSync(join(s.workspace, 'builds', slug, 'project.json'), 'utf8'))
  ).toEqual({
    name: 'Winter Castle #2: Gate & Tower!'
  })
  // Case-insensitive duplicate display name is rejected
  await expect(createBuild(s, 'winter castle #2: gate & tower!', env)).rejects.toThrow(
    'already exists'
  )
  // Distinct display name that normalizes to the same slug gets a unique suffix
  const slug2 = await createBuild(s, 'Winter Castle 2 — Gate/Tower', env)
  expect(slug2).toBe('winter_castle_2_gate_tower_2')
  expect(existsSync(join(s.workspace, 'builds', slug2, 'project.json'))).toBe(true)
})

it('rejects empty/control-char/overlong names and absent workspaces', async () => {
  const s = settings()
  for (const name of ['', '   ', 'line\nbreak', 'tab\tname', 'a'.repeat(101)])
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
  mocks.command.mockImplementation(async (_file: string, args: string[]) => {
    if (args[0] === '-m') throw new Error('already exists')
    return args[0] === 'rev-parse' ? '.git/info/exclude' : ''
  })
  await expect(createBuild(s, 'starter', {})).rejects.toThrow('already exists')
  expect(mocks.command).toHaveBeenCalledWith(
    'runtime-python.exe',
    ['-m', 'tools.new_build', 'starter'],
    { cwd: s.workspace, env: {} }
  )
})
