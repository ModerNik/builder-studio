import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, expect, it, vi } from 'vitest'
import { SettingsSchema, type Settings } from '@shared/api'
import { SchematicImports } from './schematic-import'
import type { command } from '../runtime/runtime'

const roots: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

interface Fixture {
  root: string
  workspace: string
  cache: string
  settings: Settings
  calls: string[][]
  run: typeof command
  service: SchematicImports
}

function fixture(
  options: {
    chooseFile?: () => Promise<string | null>
    failAt?: string
    changed?: boolean
  } = {}
): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'studio schematic import '))
  roots.push(root)
  const workspace = join(root, 'workspace')
  const cache = join(root, 'cache')
  const source = join(root, 'castle.schem')
  mkdirSync(workspace)
  mkdirSync(join(workspace, 'builds', 'castle'), { recursive: true })
  writeFileSync(join(workspace, 'builds', 'castle', 'build.py'), '')
  mkdirSync(cache)
  writeFileSync(source, 'fixture schematic')
  const settings: Settings = SettingsSchema.parse({
    workspace,
    cache,
    python: 'python.exe',
    pack: '',
    jar: '',
    schematics: '',
    claude: ''
  })
  const calls: string[][] = []
  let snapshots = 0
  const run = vi.fn<typeof command>(async (_file, args) => {
    calls.push(args)
    if (args[0] === '-m' && args[1] === 'mcb.schematic_import' && args[2] === 'prepare') {
      const stage = args[4]
      if (options.failAt === 'prepare') throw new Error('prepare write failed')
      if (options.failAt === 'invalid')
        throw new Error('python.exe: Invalid schematic: Truncated NBT\r\n')
      writeFileSync(join(stage, 'source.schem'), 'staged source')
      writeFileSync(join(stage, 'blocks.litematic'), 'normalized blocks')
      return JSON.stringify({ size: [2, 3, 2], blocks: 12, warnings: [] })
    }
    if (args[0]?.startsWith('builds/') && args.includes('--placement-snapshot')) {
      if (options.failAt === 'snapshot') throw new Error('snapshot write failed')
      const prefix = args[args.indexOf('--placement-snapshot') + 1]
      writeFileSync(`${prefix}.litematic`, 'placement snapshot')
      snapshots++
      return ''
    }
    if (args[0] === '-m' && args[1] === 'mcb.schematic_import' && args[2] === 'inspect') {
      const revision = args.slice(-3).join(',') + (options.changed ? '/' + snapshots : '')
      return JSON.stringify({ revision, overlaps: [], blocks: 12 })
    }
    if (args.includes('--schematic-stage')) {
      if (options.failAt === 'publish') throw new Error('publication failed')
      return ''
    }
    return ''
  })
  const service = new SchematicImports({
    settings: () => settings,
    env: () => ({ MCB_WORKSPACE: workspace }),
    chooseFile: options.chooseFile ?? (async () => source),
    command: run
  })
  return { root, workspace, cache, settings, calls, run, service }
}

it('returns null when the file picker is cancelled without starting an import', async () => {
  const f = fixture({ chooseFile: async () => null })
  await expect(f.service.choose()).resolves.toBeNull()
  expect(f.run).not.toHaveBeenCalled()
})

it('rejects commit when a newer inspection changes the preview revision', async () => {
  const f = fixture()
  const session = await f.service.choose('castle')
  expect(session).not.toBeNull()
  const preview = await f.service.inspect({ id: session!.id, position: [0, 0, 0] })
  await f.service.inspect({ id: session!.id, position: [1, 0, 0] })

  await expect(
    f.service.commit({
      id: session!.id,
      name: 'castle',
      position: [0, 0, 0],
      revision: preview.revision
    })
  ).rejects.toThrow(/stale|changed|inspect/i)
  expect(f.calls.some((args) => args.includes('--schematic-stage'))).toBe(false)
})

it('requires a fresh review when the build changes between placement and confirmation', async () => {
  const f = fixture({ changed: true })
  const session = (await f.service.choose('castle'))!
  const position = [0, 0, 0] as [number, number, number]
  const preview = await f.service.inspect({ id: session.id, position })
  await expect(
    f.service.commit({ id: session.id, position, revision: preview.revision })
  ).rejects.toThrow(/review the updated preview/i)
  expect(existsSync(join(f.workspace, 'builds', 'castle', 'data'))).toBe(false)
  const next = await f.service.inspect({ id: session.id, position })
  expect(next.revision).not.toBe(preview.revision)
  expect(next.baseUrl).not.toBe(preview.baseUrl)
})

it('publishes independent numbered parts and cleans a cancelled staged source', async () => {
  const f = fixture()
  const position = [-2, 0, 0] as [number, number, number]
  for (const entry of ['000001', '000002']) {
    const session = (await f.service.choose('castle'))!
    const { revision } = await f.service.inspect({ id: session.id, position })
    await expect(f.service.commit({ id: session.id, position, revision })).resolves.toEqual({
      build: 'castle',
      part: `castle-part${Number(entry)}`
    })
    const folder = join(f.workspace, 'builds', 'castle', 'data', 'schematics', entry)
    expect(JSON.parse(readFileSync(join(folder, 'part.json'), 'utf8'))).toMatchObject({
      version: 1,
      name: 'castle',
      position,
      replace: []
    })
    expect(readFileSync(join(folder, 'source.schem'), 'utf8')).toBe('staged source')
  }
  const session = (await f.service.choose('castle'))!
  await f.service.cancel(session.id)
  expect(existsSync(join(f.cache, 'schematic-imports', session.id))).toBe(false)
  expect(existsSync(join(f.workspace, 'builds', 'castle', 'data', 'schematics', '000003'))).toBe(
    false
  )
})

it('surfaces a failed snapshot write and does not publish the staged schematic', async () => {
  const f = fixture({ failAt: 'snapshot' })
  const session = await f.service.choose('castle')
  expect(session).not.toBeNull()
  await expect(f.service.inspect({ id: session!.id, position: [0, 0, 0] })).rejects.toThrow(
    'snapshot write failed'
  )
  expect(f.calls.some((args) => args.includes('--schematic-stage'))).toBe(false)
})

it('rejects a schematic reached through a link before invoking the engine', async () => {
  const f = fixture()
  const sourceDir = join(f.root, 'source folder')
  const linkedDir = join(f.root, 'linked folder')
  mkdirSync(sourceDir)
  writeFileSync(join(sourceDir, 'castle.schem'), 'fixture schematic')
  symlinkSync(sourceDir, linkedDir, process.platform === 'win32' ? 'junction' : 'dir')
  const linkedService = new SchematicImports({
    settings: () => f.settings,
    env: () => ({ MCB_WORKSPACE: f.workspace }),
    chooseFile: async () => join(linkedDir, 'castle.schem'),
    command: f.run
  })

  await expect(linkedService.choose()).rejects.toThrow(/link|junction/i)
  expect(f.run).not.toHaveBeenCalled()
})

it('clears import stages left over from an earlier run, but not recent ones', async () => {
  const f = fixture()
  const root = join(f.cache, 'schematic-imports')
  mkdirSync(join(root, 'stale'), { recursive: true })
  mkdirSync(join(root, 'recent'))
  const old = new Date(Date.now() - 2 * 86_400_000)
  utimesSync(join(root, 'stale'), old, old)

  await f.service.choose()

  expect(existsSync(join(root, 'stale'))).toBe(false)
  expect(existsSync(join(root, 'recent'))).toBe(true)
})

it('shows the engine message without the interpreter path when a file is invalid', async () => {
  const f = fixture({ failAt: 'invalid' })
  await expect(f.service.choose('castle')).rejects.toThrow(/^Invalid schematic: Truncated NBT$/)
})
