import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, expect, it, vi } from 'vitest'
import { SettingsSchema } from '@shared/api'
import { prepareFolders, prepareTools, protectedStorage } from './setup'
import { validateWorkspace } from '../workspace/workspace'
import { ImportService } from '../workspace/imports'

const roots: string[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

it('creates default folders without altering data and permits only the dedicated workspace subtree', async () => {
  const root = await mkdtemp(join(tmpdir(), 'setup folders '))
  roots.push(root)
  const profile = join(root, 'profile')
  const workspace = join(profile, 'workspace')
  const settings = SettingsSchema.parse({
    workspace,
    python: '',
    jar: '',
    pack: '',
    claude: '',
    resources: join(root, 'resources'),
    runtimeHome: join(profile, 'runtime'),
    runtime: join(profile, 'runtime/current'),
    cache: join(profile, 'cache'),
    assets: join(workspace, 'assets'),
    schematics: join(profile, 'schematics')
  })
  await prepareFolders(settings, profile)
  await writeFile(join(workspace, 'keep'), 'project')
  await prepareFolders(settings, profile)
  expect(await readFile(join(workspace, 'keep'), 'utf8')).toBe('project')
  for (const destination of [
    profile,
    join(profile, 'providers'),
    join(profile, 'cache'),
    join(profile, 'runtime'),
    join(profile, 'workspace-sibling'),
    root
  ]) {
    await expect(
      validateWorkspace(destination, protectedStorage(settings, profile, destination), true)
    ).rejects.toThrow('separate')
  }
  const child = join(workspace, 'imported')
  await validateWorkspace(child, protectedStorage(settings, profile, child), true)
  const source = join(root, 'source')
  await mkdir(join(source, 'builds/test'), { recursive: true })
  await writeFile(join(source, 'builds/test/build.py'), '# existing build')
  const imports = new ImportService(
    (destination) => protectedStorage(settings, profile, destination),
    () => {}
  )
  const preview = await imports.preview({ source, destination: child, assets: true })
  expect(preview).toBeTruthy()
  await mkdir(join(profile, 'providers'), { recursive: true })
  await expect(
    imports.preview({ source, destination: join(profile, 'providers'), assets: true })
  ).rejects.toThrow('overlaps application storage')
  const custom = {
    ...settings,
    workspace: join(root, 'custom'),
    assets: join(root, 'assets'),
    schematics: join(root, 'exports'),
    runtimeHome: join(root, 'tools'),
    cache: join(root, 'cache')
  }
  await prepareFolders(custom, profile)
  await mkdir(join(root, 'bad'), { recursive: true })
  await writeFile(join(root, 'bad/file'), '')
  await expect(
    prepareFolders({ ...custom, assets: join(root, 'bad/file') }, profile)
  ).rejects.toThrow()
})

it('retries from failed tools, keeps completed installations, and initializes history last', async () => {
  const ready = new Set(['git'])
  const order: string[] = []
  const check = async (tool: string): Promise<void> => {
    if (!ready.has(tool)) throw new Error('missing')
  }
  const install = vi.fn(async (tool: string) => {
    order.push(tool)
    if (tool === 'browser' && order.length === 2) throw new Error('offline')
    ready.add(tool)
  })
  const history = vi.fn(async () => {
    order.push('history')
  })
  await expect(prepareTools(check, install, history, new AbortController().signal)).rejects.toThrow(
    'offline'
  )
  expect(history).not.toHaveBeenCalled()
  await prepareTools(check, install, history, new AbortController().signal)
  expect(order).toEqual(['engine', 'browser', 'browser', 'history'])
  const cancel = new AbortController()
  const checks = vi.fn(async () => {
    cancel.abort()
  })
  await expect(prepareTools(checks, install, history, cancel.signal)).rejects.toThrow()
  expect(checks).toHaveBeenCalledTimes(1)
})
