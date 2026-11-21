import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, expect, it, vi } from 'vitest'
import { bootstrapWorkspace } from './workspace'
import { command, installedGit } from '../runtime/runtime'

const roots: string[] = []
afterEach(() => {
  vi.unstubAllEnvs()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function workspace(): string {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'studio git сборка ')))
  roots.push(root)
  return root
}

it('initializes a fresh workspace with exclusions, no source history and a local fallback identity', async () => {
  const root = workspace()
  const global = join(root, 'global.gitconfig')
  writeFileSync(global, '')
  vi.stubEnv('GIT_CONFIG_GLOBAL', global)
  vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1')
  const git = installedGit()
  const s = join(root, 'workspace')
  await bootstrapWorkspace(s)
  expect(await command(git, ['rev-parse', '--show-toplevel'], { cwd: s })).toBe(
    s.replaceAll('\\', '/')
  )
  await expect(command(git, ['rev-parse', 'HEAD'], { cwd: s })).rejects.toThrow()
  const config = readFileSync(join(s, '.git/config'), 'utf8')
  expect(config).toContain('Builder Studio User')
  expect(config).toContain('user@builder-studio.invalid')
  expect(readFileSync(global, 'utf8')).toBe('')
  const paths = [
    'builds/starter/out/proto.litematic',
    'assets/library/a.schem',
    '.cache/x',
    '.venv/x',
    'builds/starter/__pycache__/x.pyc',
    '.builder-import-ABC123/data',
    '.claude/history',
    '.codex/history',
    '.env.local'
  ]
  for (const path of paths)
    expect(await command(git, ['check-ignore', '--', path], { cwd: s })).toBe(path)
  await expect(
    command(git, ['check-ignore', '--', 'builds/starter/data/site.json'], { cwd: s })
  ).rejects.toThrow()
  await bootstrapWorkspace(s)
  expect(
    readFileSync(join(s, '.git/info/exclude'), 'utf8').match(/Builder Studio workspace data/g)
  ).toHaveLength(1)
})

it('keeps inherited identity and fills only a missing email in local config', async () => {
  const root = workspace()
  const global = join(root, 'global.gitconfig')
  const content = '[user]\n\tname = Existing global name\n'
  writeFileSync(global, content)
  vi.stubEnv('GIT_CONFIG_GLOBAL', global)
  vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1')
  const dir = join(root, 'workspace')
  await bootstrapWorkspace(dir)
  const local = readFileSync(join(dir, '.git/config'), 'utf8')
  expect(local).not.toContain('name =')
  expect(local).toContain('user@builder-studio.invalid')
  expect(readFileSync(global, 'utf8')).toBe(content)
})

it('preserves an existing repository, its identity, tracked files and custom ignores', async () => {
  const s = workspace()
  const git = installedGit()
  await command(git, ['init', '--', s])
  await command(git, ['config', '--local', 'user.name', 'Existing User'], { cwd: s })
  await command(git, ['config', '--local', 'user.email', 'existing@example.test'], { cwd: s })
  writeFileSync(join(s, '.gitignore'), 'custom-output/\n')
  writeFileSync(join(s, 'keep.txt'), 'keep')
  await command(git, ['add', '.'], { cwd: s })
  await command(git, ['commit', '-m', 'fixture'], { cwd: s })
  const head = await command(git, ['rev-parse', 'HEAD'], { cwd: s })
  const config = readFileSync(join(s, '.git/config'), 'utf8')
  await bootstrapWorkspace(s)
  expect(await command(git, ['rev-parse', 'HEAD'], { cwd: s })).toBe(head)
  expect(readFileSync(join(s, '.git/config'), 'utf8')).toBe(config)
  expect(readFileSync(join(s, '.gitignore'), 'utf8')).toBe('custom-output/\n')
  expect(readFileSync(join(s, 'keep.txt'), 'utf8')).toBe('keep')
})

it('creates a workspace repository inside a parent repo instead of using parent history', async () => {
  const parent = workspace()
  const git = installedGit()
  await command(git, ['init', '--', parent])
  const child = join(parent, 'child')
  mkdirSync(child)
  await bootstrapWorkspace(child)
  expect(existsSync(join(child, '.git'))).toBe(true)
  expect(await command(git, ['rev-parse', '--show-toplevel'], { cwd: child })).toBe(
    child.replaceAll('\\', '/')
  )
})

it('uses the managed Git fallback and reports missing Git without global changes', async () => {
  const s = workspace()
  const managed = installedGit()
  expect(managed).toBeTruthy()
  vi.stubEnv('PATH', '')
  await expect(bootstrapWorkspace(s)).rejects.toThrow('Git is unavailable')
  expect(existsSync(join(s, '.git'))).toBe(false)
  await bootstrapWorkspace(s, managed)
  expect(existsSync(join(s, '.git'))).toBe(true)
})
