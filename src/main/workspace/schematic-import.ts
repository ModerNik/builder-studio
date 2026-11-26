import { randomUUID } from 'crypto'
import { copyFile, lstat, mkdir, mkdtemp, readdir, rename, rm, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, parse } from 'path'
import {
  NewBuildNameSchema,
  SchematicInfoSchema,
  SchematicInspectionSchema,
  type BlockCoordinates,
  type SchematicCommit,
  type SchematicInspection,
  type SchematicSession,
  type Settings
} from '@shared/api'
import { buildDir } from './projects'
import { under } from './paths'
import { command } from '../runtime/runtime'
import { createBuild, noLinks } from './workspace'

const MAX_FILE = 32 * 1024 * 1024
const SUFFIXES = new Set(['.litematic', '.schem', '.nbt', '.schematic'])
const PARTS = ['data', 'schematics']
const UPGRADE = 'Install an engine with schematic import support in Settings → Build tools.'
const STANDARD = 'This build needs the standard mcb.cli.run entry point for schematic placement.'

interface Staged {
  info: SchematicSession
  stage: string
  settings: Settings
  source: string
  build?: string
  snapshot?: 'base' | 'verify'
  snapshotVersion: number
  preview?: SchematicInspection
  abort: AbortController
  running?: Promise<unknown>
  publishing?: boolean
}

export async function requireSchematicEngine(s: Settings, env: NodeJS.ProcessEnv): Promise<void> {
  try {
    await command(
      s.python,
      ['-c', 'from importlib.util import find_spec; assert find_spec("mcb.schematic_import")'],
      {
        cwd: s.workspace,
        env
      }
    )
  } catch (error) {
    throw new Error(UPGRADE, { cause: error })
  }
}

export async function hasSchematicParts(workspace: string, build: string): Promise<boolean> {
  const dir = under(workspace, `builds/${build}/data/schematics`)
  if (!dir) return false
  return (
    await readdir(dir).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'ENOENT') throw e
      return []
    })
  ).some((name) => /^\d{6}$/.test(name))
}

export class SchematicImports {
  private session: Staged | undefined
  private choosing = false

  constructor(
    private options: {
      settings: () => Settings
      env: (settings: Settings) => NodeJS.ProcessEnv
      target?: (build?: string, version?: string) => Settings
      chooseFile: () => Promise<string | null>
      command?: typeof command
    }
  ) {}

  private url(id: string, file: string, version = 0): string {
    return `build://cache/schematic-imports/${id}/${file}.litematic?v=${version}`
  }

  private async run(args: string[], s: Settings, signal?: AbortSignal): Promise<string> {
    try {
      return await (this.options.command ?? command)(s.python, args, {
        cwd: s.workspace,
        env: this.options.env(s),
        signal
      })
    } catch (error) {
      // command() prefixes the interpreter path, which hides the engine's own message
      const prefix = `${s.python}: `
      if (error instanceof Error && error.message.startsWith(prefix))
        throw new Error(error.message.slice(prefix.length).trim(), { cause: error })
      throw error
    }
  }

  async choose(build?: string, version?: string): Promise<SchematicSession | null> {
    if (this.choosing || this.session?.publishing) throw new Error('An import is already open')
    this.choosing = true
    try {
      const file = await this.options.chooseFile()
      if (!file) return null
      const suffix = extname(file).toLowerCase()
      if (!SUFFIXES.has(suffix))
        throw new Error('Choose a .litematic, .schem, .nbt or .schematic file')
      await noLinks(file).catch((error) => {
        throw new Error('Choose a file outside links and junctions', { cause: error })
      })
      const source = await lstat(file).catch((error) => {
        throw new Error('The selected schematic is no longer available', { cause: error })
      })
      if (!source.isFile() || source.size > MAX_FILE)
        throw new Error('Choose a schematic file up to 32 MiB')
      const s = this.options.target?.(build, version) ?? this.options.settings()
      if (build) await noLinks(join(buildDir(s.workspace, build), 'build.py'))
      const id = randomUUID()
      const root = join(s.cache, 'schematic-imports')
      await noLinks(root)
      await mkdir(root, { recursive: true })
      // Quitting mid-import leaves its stage behind; a day's margin spares another window's live import.
      for (const name of await readdir(root)) {
        const old = join(root, name)
        if ((await lstat(old)).mtimeMs < Date.now() - 86_400_000)
          await rm(old, { recursive: true, force: true })
      }
      const stage = join(root, id)
      await mkdir(stage)
      try {
        const stdout = await this.run(['-m', 'mcb.schematic_import', 'prepare', file, stage], s)
        const info = SchematicInfoSchema.parse(JSON.parse(stdout))
        if (this.session) await this.cancel(this.session.info.id)
        const result = {
          ...info,
          id,
          name: basename(file),
          sourceUrl: this.url(id, 'blocks'),
          minecraftVersion: s.minecraftVersion
        }
        this.session = {
          info: result,
          stage,
          settings: s,
          source: 'source' + suffix,
          build,
          snapshotVersion: 0,
          abort: new AbortController()
        }
        return result
      } catch (error) {
        await rm(stage, { recursive: true, force: true })
        if (String(error).includes('No module named mcb.schematic_import'))
          throw new Error(UPGRADE, { cause: error })
        if (error instanceof Error && error.message.includes(file))
          throw new Error(error.message.replaceAll(file, 'the selected file'), { cause: error })
        throw error
      }
    } finally {
      this.choosing = false
    }
  }

  private get(id: string): Staged {
    const stage = this.session
    if (!stage || stage.info.id !== id) throw new Error('Choose the schematic again')
    const s =
      this.options.target?.(stage.build, stage.info.minecraftVersion) ?? this.options.settings()
    if (
      s.workspace !== stage.settings.workspace ||
      s.cache !== stage.settings.cache ||
      s.python !== stage.settings.python ||
      s.minecraftVersion !== stage.settings.minecraftVersion
    )
      throw new Error('Settings changed. Choose the schematic again.')
    if (stage.running || this.choosing) throw new Error('Wait for the current import operation')
    return stage
  }

  private async operate<T>(stage: Staged, run: () => Promise<T>): Promise<T> {
    const pending = run()
    stage.running = pending
    try {
      return await pending
    } finally {
      stage.running = undefined
    }
  }

  private async snapshot(stage: Staged, file: 'base' | 'verify'): Promise<void> {
    const build = stage.build!
    await noLinks(join(buildDir(stage.settings.workspace, build), 'build.py'))
    const prefix = join(stage.stage, file)
    // An earlier snapshot must not pass the existence check below if this run writes nothing.
    await Promise.all(['.litematic', '.npz'].map((ext) => rm(prefix + ext, { force: true })))
    try {
      await this.run(
        [`builds/${build}/build.py`, 'check', '--placement-snapshot', prefix],
        stage.settings,
        stage.abort.signal
      )
    } catch (error) {
      if (
        String(error).includes('unrecognized arguments') ||
        String(error).includes('invalid choice')
      )
        throw new Error(STANDARD, { cause: error })
      throw error
    }
    if (!(await lstat(prefix + '.litematic').catch(() => null))?.isFile()) throw new Error(STANDARD)
  }

  private async inspectAt(
    stage: Staged,
    file: 'base' | 'verify',
    position: BlockCoordinates
  ): Promise<SchematicInspection> {
    const stdout = await this.run(
      [
        '-m',
        'mcb.schematic_import',
        'inspect',
        stage.stage,
        join(stage.stage, file),
        ...position.map(String)
      ],
      stage.settings,
      stage.abort.signal
    )
    return {
      ...SchematicInspectionSchema.parse(JSON.parse(stdout)),
      baseUrl: this.url(stage.info.id, file, stage.snapshotVersion)
    }
  }

  async inspect({
    id,
    position
  }: {
    id: string
    position: BlockCoordinates
  }): Promise<SchematicInspection> {
    const stage = this.get(id)
    if (!stage.build) throw new Error('Placement requires an existing build')
    return this.operate(stage, async () => {
      if (!stage.snapshot) {
        await this.snapshot(stage, 'base')
        stage.snapshot = 'base'
      }
      const result = await this.inspectAt(stage, stage.snapshot, position)
      stage.preview = result
      return result
    })
  }

  async commit(input: SchematicCommit): Promise<{ build: string; part?: string }> {
    const stage = this.get(input.id)
    if (stage.info.warnings.length && !input.acceptWarnings)
      throw new Error('Confirm which data the generated versions will carry')
    stage.publishing = true
    try {
      const result = await this.operate(stage, async () => {
        const meta = {
          version: 1,
          name: parse(stage.info.name).name,
          source: stage.source,
          minecraftVersion: stage.info.minecraftVersion,
          sourceDataVersion: stage.info.sourceDataVersion,
          size: stage.info.size,
          position: input.position ?? [0, 0, 0],
          replace: input.replace ?? []
        }
        if (!stage.build) {
          const name = NewBuildNameSchema.parse(input.name)
          meta.position = [0, 0, 0]
          meta.replace = []
          await writeFile(join(stage.stage, 'part.json'), JSON.stringify(meta))
          const created = await createBuild(
            stage.settings,
            name,
            this.options.env(stage.settings),
            stage.stage
          )
          return { build: created }
        }
        if (!input.position || !stage.preview || input.revision !== stage.preview.revision)
          throw new Error('The placement preview is stale. Inspect the position again.')
        const check = stage.snapshot === 'base' ? 'verify' : 'base'
        await this.snapshot(stage, check)
        const fresh = await this.inspectAt(stage, check, input.position)
        if (fresh.revision !== input.revision) {
          stage.snapshot = check
          stage.snapshotVersion++
          stage.preview = undefined
          throw new Error(
            'The build or placement changed. Review the updated preview before importing.'
          )
        }
        const owners = new Set(fresh.overlaps.map((o) => o.owner))
        if (meta.replace.some((owner) => !owners.has(owner)))
          throw new Error('Review the current overlaps')
        const kept = fresh.overlaps.filter((o) => !meta.replace.includes(o.owner))
        if (kept.reduce((count, row) => count + row.count, 0) >= fresh.blocks)
          throw new Error('Move the schematic or let it win an overlap so it adds blocks')
        const part = await this.publishPart(stage, stage.build, meta)
        // the draft's version name: "tower-part2" for the second part, from tower.schem
        // a leading - or . would read as a CLI flag or a hidden file
        const stem =
          meta.name
            .replace(/[^\w.-]+/g, '_')
            .replace(/^[.-]+/, '')
            .slice(0, 40) || 'import'
        return { build: stage.build, part: `${stem}-part${Number(part)}` }
      })
      this.session = undefined
      await rm(stage.stage, { recursive: true, force: true }).catch(() => {})
      return result
    } finally {
      stage.publishing = false
    }
  }

  /** Publishes the next numbered part folder and returns its number ("000002"). */
  private async publishPart(stage: Staged, build: string, meta: object): Promise<string> {
    const dir = join(buildDir(stage.settings.workspace, build), ...PARTS)
    await noLinks(dir)
    const exists = async (path: string): Promise<boolean> =>
      lstat(path)
        .then((entry) => {
          if (!entry.isDirectory()) throw new Error('The schematic destination must be a folder')
          return true
        })
        .catch((e: NodeJS.ErrnoException) => {
          if (e.code !== 'ENOENT') throw e
          return false
        })
    const hasDir = await exists(dir)
    const hasData = hasDir || (await exists(dirname(dir)))
    const entries = hasDir ? await readdir(dir) : []
    const next =
      entries.reduce((max, name) => (/^\d{6}$/.test(name) ? Math.max(max, Number(name)) : max), 0) +
      1
    if (next > 999999) throw new Error('This build has reached the schematic part limit')
    const part = String(next).padStart(6, '0')
    const target = hasDir ? join(dir, part) : hasData ? dir : dirname(dir)
    const temp = await mkdtemp(join(stage.settings.workspace, '.builder-import-'))
    try {
      const staged = join(temp, 'publish')
      const leaf = hasDir ? staged : hasData ? join(staged, part) : join(staged, 'schematics', part)
      await mkdir(leaf, { recursive: true })
      await copyFile(join(stage.stage, stage.source), join(leaf, stage.source))
      await copyFile(join(stage.stage, 'blocks.litematic'), join(leaf, 'blocks.litematic'))
      await writeFile(join(leaf, 'part.json'), JSON.stringify(meta))
      await rename(staged, target)
    } finally {
      await rm(temp, { recursive: true, force: true })
    }
    return part
  }

  async cancel(id: string): Promise<void> {
    const stage = this.session
    if (!stage || stage.info.id !== id || stage.publishing) return
    this.session = undefined
    stage.abort.abort()
    await stage.running?.catch(() => {})
    await rm(stage.stage, { recursive: true, force: true })
  }
}
