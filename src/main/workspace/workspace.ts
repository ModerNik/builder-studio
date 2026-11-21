import { lstat, mkdir, mkdtemp, readFile, rm, rmdir, writeFile } from 'fs/promises'
import { dirname, isAbsolute, join, resolve } from 'path'
import { NewBuildNameSchema, type Settings } from '@shared/api'
import { command, installedGit } from '../runtime/runtime'
import { insideRepo } from '../agent/permissions'
import { canonicalPath } from './paths'

/** A real write probe, without changing any existing workspace file. */
export async function validateWorkspace(
  workspace: string,
  protectedPaths: string[] = [],
  create = false
): Promise<void> {
  if (!workspace) throw new Error('Choose a workspace folder in Setup or Settings')
  await noLinks(workspace)
  const canonical = canonicalPath(workspace)
  const protectedRoots = protectedPaths.filter(Boolean).map(canonicalPath)
  if (protectedRoots.some((p) => insideRepo(p, canonical) || insideRepo(canonical, p)))
    throw new Error('Keep the workspace separate from application resources, runtime and cache')
  if (create) await mkdir(workspace, { recursive: true })
  if (!(await lstat(workspace)).isDirectory()) throw new Error('Workspace must be a directory')
  const probe = await mkdtemp(join(workspace, '.builder-write-'))
  try {
    await writeFile(join(probe, 'check'), '', { flag: 'wx' })
  } finally {
    await rm(join(probe, 'check'), { force: true })
    await rmdir(probe)
  }
}

/** Reject links in every existing ancestor, including junctions and dangling links. */
export async function noLinks(path: string): Promise<void> {
  if (!isAbsolute(path)) throw new Error('Select an absolute path')
  for (let p = resolve(path); ; p = dirname(p)) {
    const info = await lstat(p).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'ENOENT') throw e
      return null
    })
    if (info?.isSymbolicLink()) throw new Error(`Links and junctions are not supported: ${p}`)
    if (p === dirname(p)) break
  }
}

export const WORKSPACE_IGNORE = `# Builder Studio workspace data
**/out/
**/__pycache__/
**/.cache/
**/.pytest_cache/
**/.mypy_cache/
**/.ruff_cache/
**/.diff/
**/.venv/
/assets/
/.builder-import-*/
/.claude/
/.codex/
/.env*
*.pyc
`

/** Never reset a repository, inherit a parent repository, or change a global identity. */
export async function bootstrapWorkspace(workspace: string, managedGit = ''): Promise<void> {
  await noLinks(workspace)
  const git = installedGit(managedGit)
  if (!git) throw new Error('Git is unavailable. Install portable Git in Settings, then retry.')
  await mkdir(workspace, { recursive: true })
  if (!(await lstat(workspace)).isDirectory()) throw new Error('Workspace must be a directory')
  await noLinks(join(workspace, '.git'))
  const repository = await lstat(join(workspace, '.git')).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'ENOENT') throw e
    return null
  })
  if (!repository) await command(git, ['init', '--', workspace])
  // A separate exclude file also protects existing repositories without editing their .gitignore.
  const exclude = await command(git, ['rev-parse', '--git-path', 'info/exclude'], {
    cwd: workspace
  })
  const file = resolve(workspace, exclude)
  await noLinks(file)
  const old = await readFile(file, 'utf8').catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'ENOENT') throw e
    return ''
  })
  if (!old.includes('# Builder Studio workspace data'))
    await writeFile(file, `${old}\n${WORKSPACE_IGNORE}`, { flag: 'a' })
  for (const [key, value] of [
    ['user.name', 'Builder Studio User'],
    ['user.email', 'user@builder-studio.invalid']
  ]) {
    const existing = await command(git, ['config', '--get', key], { cwd: workspace }).catch(
      () => ''
    )
    if (!existing) await command(git, ['config', '--local', key, value], { cwd: workspace })
  }
}

/** The engine owns the scaffold and collision guard; the app supplies the resolved environment. */
export async function createBuild(
  s: Settings,
  name: string,
  env: NodeJS.ProcessEnv,
  schematicStage?: string
): Promise<string> {
  NewBuildNameSchema.parse(name)
  if (!s.workspace) throw new Error('Select a workspace in Settings first')
  await noLinks(join(s.workspace, 'builds', name))
  await bootstrapWorkspace(s.workspace, s.git)
  try {
    await command(s.python, ['-c', 'import mcb, schematica, tools.new_build'], {
      cwd: s.workspace,
      env
    })
  } catch (e) {
    throw new Error(`Build runtime unavailable. Install or repair the engine in Settings. ${e}`, {
      cause: e
    })
  }
  await command(
    s.python,
    [
      '-m',
      'tools.new_build',
      name,
      ...(schematicStage ? ['--schematic-stage', schematicStage] : [])
    ],
    { cwd: s.workspace, env }
  )
  return name
}
