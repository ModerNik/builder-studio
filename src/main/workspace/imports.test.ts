import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'fs'
import * as fs from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, expect, it, vi } from 'vitest'
import { ImportService } from './imports'
import { validateWorkspace } from './workspace'
import type { ImportRequest, ImportState } from '@shared/api'

vi.mock('fs/promises', async (original) => {
  const actual = await original<typeof import('fs/promises')>()
  return {
    ...actual,
    statfs: vi.fn(actual.statfs),
    open: vi.fn(actual.open),
    link: vi.fn(actual.link)
  }
})

const roots: string[] = []
afterEach(() => {
  vi.resetAllMocks()
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true })
})
function put(root: string, path: string, content = path): void {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}
function fixture(emit: (s: ImportState) => void = () => {}): {
  base: string
  source: string
  destination: string
  service: ImportService
  request: ImportRequest
} {
  const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'studio import сборка ')))
  roots.push(base)
  const source = join(base, 'source checkout')
  const destination = join(base, 'destination workspace')
  mkdirSync(destination)
  put(
    source,
    'builds/alpha/build.py',
    'from builds.beta import helper\nOLD = "C:/outside/file"\nUNIX = "/home/me/data"'
  )
  put(source, 'builds/alpha/DESIGN.md')
  put(source, 'builds/alpha/data/site.json')
  put(source, 'builds/alpha/review/round_1.json')
  put(source, 'builds/alpha/refs/image.png')
  put(source, 'builds/alpha/out/proto.litematic')
  put(source, 'builds/beta/helper.py')
  put(source, 'builds/_archive/old/build.py')
  put(source, 'assets/library/item.schem')
  put(source, 'root_helper.py')
  for (const path of [
    '.git/config',
    '.venv/python.exe',
    'engine/lib/mcb.py',
    '.claude/history.json',
    'mcb.toml'
  ])
    put(source, path)
  for (const path of [
    '.git/config',
    '.venv/python.exe',
    'engine/code.py',
    '.codex/history',
    '.env',
    '.env.local',
    'credentials.json',
    'auth.json',
    'private.key',
    '__pycache__/x.pyc',
    'mcb.toml'
  ])
    put(source, `builds/alpha/${path}`)
  const service = new ImportService(() => [], emit)
  return { base, source, destination, service, request: { source, destination, assets: true } }
}
function tree(root: string): Record<string, string> {
  const result: Record<string, string> = {}
  const walk = (path: string): void => {
    for (const entry of readdirSync(join(root, path), { withFileTypes: true })) {
      const p = path ? `${path}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(p)
      else result[p] = readFileSync(join(root, p)).toString('hex')
    }
  }
  walk('')
  return result
}

it('previews and imports archives, dependencies, support files and optional assets without changing source', async () => {
  const f = fixture()
  const before = tree(f.source)
  put(f.destination, 'keep.txt', 'existing')
  const preview = await f.service.preview(f.request)
  expect(preview).toMatchObject({
    source: f.source,
    destination: f.destination,
    builds: 1, // alpha; beta has no build.py or DESIGN.md, _archive is skipped
    files: 9,
    assets: true
  })
  expect(preview.required).toBeGreaterThan(preview.bytes)
  expect(preview.warnings).toEqual([
    'builds/alpha/build.py:2: C:/outside/file',
    'builds/alpha/build.py:3: /home/me/data'
  ])
  expect(tree(f.destination)).toEqual({ 'keep.txt': Buffer.from('existing').toString('hex') })
  expect(await f.service.run(preview.id)).toBe(f.destination)
  expect(Object.keys(tree(f.destination)).sort()).toEqual([
    'assets/library/item.schem',
    'builds/_archive/old/build.py',
    'builds/alpha/DESIGN.md',
    'builds/alpha/build.py',
    'builds/alpha/data/site.json',
    'builds/alpha/out/proto.litematic',
    'builds/alpha/refs/image.png',
    'builds/alpha/review/round_1.json',
    'builds/beta/helper.py',
    'keep.txt'
  ])
  expect(tree(f.source)).toEqual(before)
  expect(readFileSync(join(f.destination, 'builds/alpha/build.py'), 'utf8')).toContain(
    'from builds.beta import helper'
  )
  expect(lstatSync(join(f.destination, 'builds/alpha/build.py')).ino).not.toBe(
    lstatSync(join(f.source, 'builds/alpha/build.py')).ino
  )
  expect(f.service.state).toMatchObject({ busy: false, stage: 'done', copied: preview.bytes })
})

it('leaves the assets group out when unchecked', async () => {
  const f = fixture()
  const preview = await f.service.preview({ ...f.request, assets: false })
  expect(preview.files).toBe(8)
  await f.service.run(preview.id)
  expect(existsSync(join(f.destination, 'assets'))).toBe(false)
})

it('refuses collisions at preview and rechecks before copying', async () => {
  const f = fixture()
  put(f.destination, 'builds/alpha/build.py', 'keep')
  await expect(f.service.preview(f.request)).rejects.toThrow('already exists')
  expect(readFileSync(join(f.destination, 'builds/alpha/build.py'), 'utf8')).toBe('keep')
  rmSync(join(f.destination, 'builds'), { recursive: true })
  const preview = await f.service.preview(f.request)
  put(f.destination, 'builds/beta/helper.py', 'new destination file')
  await expect(f.service.run(preview.id)).rejects.toThrow('already exists')
  expect(Object.keys(tree(f.destination))).toEqual(['builds/beta/helper.py'])
})

it('rejects source/destination overlap, relative paths, application storage and missing builds', async () => {
  const f = fixture()
  for (const destination of [f.source, join(f.source, 'builds'), f.base])
    await expect(f.service.preview({ ...f.request, destination })).rejects.toThrow('overlap')
  await expect(f.service.preview({ ...f.request, source: '.' })).rejects.toThrow('absolute')
  await expect(
    new ImportService(
      () => [f.destination],
      () => {}
    ).preview(f.request)
  ).rejects.toThrow('application storage')
  await expect(
    f.service.preview({ ...f.request, source: f.destination, destination: f.source })
  ).rejects.toThrow()
})

it('rejects junctions in selected trees and ancestors and ignores unselected assets', async () => {
  const f = fixture()
  const linked = join(f.base, 'linked')
  symlinkSync(f.source, linked, process.platform === 'win32' ? 'junction' : 'dir')
  await expect(f.service.preview({ ...f.request, source: linked })).rejects.toThrow('Links')
  await expect(f.service.preview({ ...f.request, source: join(linked, 'builds') })).rejects.toThrow(
    'Links'
  )
  symlinkSync(
    f.source,
    join(f.destination, 'builds'),
    process.platform === 'win32' ? 'junction' : 'dir'
  )
  await expect(f.service.preview(f.request)).rejects.toThrow('Links')
  rmSync(join(f.destination, 'builds'))
  symlinkSync(
    f.destination,
    join(f.source, 'builds/alpha/link'),
    process.platform === 'win32' ? 'junction' : 'dir'
  )
  await expect(f.service.preview(f.request)).rejects.toThrow('Links')
  rmSync(join(f.source, 'builds/alpha/link'))
  rmSync(join(f.source, 'assets'), { recursive: true })
  symlinkSync(
    f.destination,
    join(f.source, 'assets'),
    process.platform === 'win32' ? 'junction' : 'dir'
  )
  const preview = await f.service.preview({ ...f.request, assets: false })
  await f.service.run(preview.id)
  expect(existsSync(join(f.destination, 'assets'))).toBe(false)
})

it('detects source changes after preview and refuses stale tokens', async () => {
  const f = fixture()
  const preview = await f.service.preview(f.request)
  put(f.source, 'builds/alpha/build.py', 'changed')
  await expect(f.service.run(preview.id)).rejects.toThrow('Source changed')
  await expect(f.service.run(preview.id)).rejects.toThrow('Preview')
  expect(tree(f.destination)).toEqual({})
})

it('checks available disk space again and leaves both trees intact on failure', async () => {
  const f = fixture()
  const before = tree(f.source)
  const preview = await f.service.preview(f.request)
  const disk = await fs.statfs(f.destination)
  vi.mocked(fs.statfs).mockResolvedValueOnce({ ...disk, bavail: 0 })
  await expect(f.service.run(preview.id)).rejects.toThrow('disk space')
  expect(tree(f.destination)).toEqual({})
  expect(tree(f.source)).toEqual(before)
})

it('cancels during staging, removes its stage and preserves existing destination/source files', async () => {
  const f = fixture((s) => {
    if (s.stage === 'copying' && s.copied > 0) f.service.cancel()
  })
  const service = f.service
  const before = tree(f.source)
  put(f.destination, 'keep.txt')
  const preview = await service.preview(f.request)
  await expect(service.run(preview.id)).rejects.toThrow(/cancel|abort/i)
  expect(readdirSync(f.destination)).toEqual(['keep.txt'])
  expect(tree(f.source)).toEqual(before)
  expect(service.state).toMatchObject({ busy: false, stage: 'cancelled' })
})

it('rolls back partially activated files and keeps a racing collision and existing directories', async () => {
  const f = fixture((s) => {
    if (s.stage === 'activating') put(f.destination, 'builds/beta/helper.py', 'racing file')
  })
  mkdirSync(join(f.destination, 'builds/alpha'), { recursive: true })
  const before = tree(f.source)
  const preview = await f.service.preview(f.request)
  await expect(f.service.run(preview.id)).rejects.toThrow(/exist/i)
  expect(tree(f.destination)).toEqual({
    'builds/beta/helper.py': Buffer.from('racing file').toString('hex')
  })
  expect(existsSync(join(f.destination, 'builds/alpha'))).toBe(true)
  expect(existsSync(join(f.destination, 'assets'))).toBe(false)
  expect(tree(f.source)).toEqual(before)
})

it('refuses a destination without hard links at preview and leaves it untouched', async () => {
  const f = fixture()
  vi.mocked(fs.link).mockRejectedValueOnce(
    Object.assign(new Error('operation not permitted'), { code: 'EPERM' })
  )
  await expect(f.service.preview(f.request)).rejects.toThrow("can't hold hard links")
  expect(readdirSync(f.destination)).toEqual([])
  await expect(f.service.run('any')).rejects.toThrow('Preview the import again')
})

it('reports ENOSPC during copying and cleans only the attempt', async () => {
  const f = fixture()
  const preview = await f.service.preview(f.request)
  vi.mocked(fs.open).mockRejectedValueOnce(
    Object.assign(new Error('disk full'), { code: 'ENOSPC' })
  )
  await expect(f.service.run(preview.id)).rejects.toThrow('disk full')
  expect(readdirSync(f.destination)).toEqual([])
})

it('cancels after a file activates and rolls back the exclusive links', async () => {
  const f = fixture()
  const preview = await f.service.preview(f.request)
  vi.mocked(fs.link).mockImplementationOnce(async (from, to) => {
    linkSync(from, to)
    f.service.cancel()
  })
  await expect(f.service.run(preview.id)).rejects.toThrow(/cancel|abort/i)
  expect(readdirSync(f.destination)).toEqual([])
})

it('cancels scanning and rejects concurrent operations', async () => {
  const f = fixture((s) => {
    if (s.stage === 'scanning') f.service.cancel()
  })
  const scanning = f.service.preview(f.request)
  await Promise.all([
    expect(f.service.preview(f.request)).rejects.toThrow('already running'),
    expect(f.service.recover(f.destination)).rejects.toThrow('already running'),
    expect(scanning).rejects.toThrow(/cancel/i)
  ])
  expect(readdirSync(f.destination)).toEqual([])
})

it('recovers a crash immediately after creating an empty stage', async () => {
  const f = fixture()
  mkdirSync(join(f.destination, '.builder-import-ABC123'))
  await f.service.recover(f.destination)
  expect(readdirSync(f.destination)).toEqual([])
})

function interrupted(destination: string, committed = false): string {
  const stage = join(destination, '.builder-import-ABC123')
  put(stage, 'data/builds/partial/build.py', 'imported')
  put(stage, 'data/builds/partial/replaced.py', 'old imported')
  mkdirSync(join(destination, 'builds/partial'), { recursive: true })
  linkSync(
    join(stage, 'data/builds/partial/build.py'),
    join(destination, 'builds/partial/build.py')
  )
  put(destination, 'builds/partial/replaced.py', 'user replacement')
  const info = lstatSync(join(destination, 'builds/partial'), { bigint: true })
  put(
    stage,
    'journal.json',
    JSON.stringify({
      version: 1,
      committed,
      files: ['builds/partial/build.py', 'builds/partial/replaced.py'],
      directories: [{ path: 'builds/partial', identity: `${info.dev}:${info.ino}` }]
    })
  )
  return stage
}

it('recovers an interrupted activation using staged ownership and preserves replacements', async () => {
  const f = fixture()
  const stage = interrupted(f.destination)
  await expect(f.service.preview(f.request)).rejects.toThrow('Interrupted import')
  await f.service.recover(f.destination)
  expect(existsSync(stage)).toBe(false)
  expect(tree(f.destination)).toEqual({
    'builds/partial/replaced.py': Buffer.from('user replacement').toString('hex')
  })
})

it('finishes cleanup of a committed attempt without undoing imported files', async () => {
  const f = fixture()
  interrupted(f.destination, true)
  await f.service.recover(f.destination)
  expect(Object.keys(tree(f.destination))).toEqual([
    'builds/partial/build.py',
    'builds/partial/replaced.py'
  ])
})

it('refuses corrupt recovery paths instead of deleting unrelated data', async () => {
  const f = fixture()
  const stage = interrupted(f.destination)
  const file = join(stage, 'journal.json')
  const journal = JSON.parse(readFileSync(file, 'utf8'))
  journal.files.push('builds/../../keep.txt')
  put(f.destination, 'keep.txt', 'keep')
  writeFileSync(file, JSON.stringify(journal))
  await expect(f.service.recover(f.destination)).rejects.toThrow()
  expect(readFileSync(join(f.destination, 'keep.txt'), 'utf8')).toBe('keep')
  expect(existsSync(stage)).toBe(true)
})

it('rejects protected storage aliases before importing or creating a workspace', async () => {
  const f = fixture()
  const alias = join(f.base, 'protected storage alias')
  symlinkSync(f.destination, alias, process.platform === 'win32' ? 'junction' : 'dir')
  const service = new ImportService(
    () => [alias],
    () => {}
  )
  await expect(service.preview(f.request)).rejects.toThrow('application storage')
  const workspace = join(f.destination, 'new workspace')
  await expect(validateWorkspace(workspace, [alias], true)).rejects.toThrow('separate')
  expect(existsSync(workspace)).toBe(false)
})
