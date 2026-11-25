import { randomUUID } from 'crypto'
import { constants, createWriteStream, type BigIntStats } from 'fs'
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rmdir,
  rm,
  statfs,
  unlink,
  writeFile
} from 'fs/promises'
import { dirname, extname, isAbsolute, join, relative, sep } from 'path'
import { Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { z } from 'zod'
import type { ImportPreview, ImportRequest, ImportState } from '@shared/api'
import { noLinks } from './workspace'
import { canonicalPath } from './paths'

const PREFIX = '.builder-import-'
const excluded = (name: string): boolean =>
  /^(\.git|\.venv|venv|engine|node_modules|__pycache__|\.cache|\.claude|\.codex|\.agents|\.ssh|\.aws|\.azure|\.config|mcb\.toml|\.gitconfig|\.npmrc|auth\.json|settings\.local\.json)$/i.test(
    name
  ) ||
  /^(\.env(?:\.|$)|credentials(?:\.|$))/i.test(name) ||
  /\.(pyc|pyo|pem|key)$/i.test(name)
const overlaps = (a: string, b: string): boolean => {
  const contains = (x: string, y: string): boolean => {
    const r = relative(x, y)
    return !r || (r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r))
  }
  return contains(a, b) || contains(b, a)
}
const missing = (e: NodeJS.ErrnoException): null => {
  if (e.code !== 'ENOENT') throw e
  return null
}
const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))
// a file that makes its folder a build, as projects.ts listBuilds reads them
const BUILD_FILE = /^(builds\/(?:_(?!archive\/)[^/]+\/)?(?!_)[^/]+)\/(?:build\.py|DESIGN\.md)$/

async function nearestExistingAncestor(path: string): Promise<string> {
  for (let p = path; ; p = dirname(p)) {
    const info = await lstat(p).catch(missing)
    if (info) {
      if (!info.isDirectory()) throw new Error('Destination parent must be a directory')
      return await realpath(p)
    }
    if (p === dirname(p)) throw new Error('Destination drive or parent folder does not exist')
  }
}

/** Records each directory level that does not yet exist so a failed run can remove only what it created. */
async function missingAncestors(path: string): Promise<string[]> {
  const created: string[] = []
  for (let p = path; ; p = dirname(p)) {
    const info = await lstat(p).catch(missing)
    if (info) break
    created.push(p)
    if (p === dirname(p)) break
  }
  return created
}

/** Imports activate files as hard links: refuse a drive without them before anything is copied. */
async function checkHardLinks(dir: string): Promise<void> {
  const probe = join(dir, `.builder-linkcheck-${randomUUID()}`)
  await writeFile(probe, '', { flag: 'wx' })
  try {
    await link(probe, `${probe}.link`)
    await unlink(`${probe}.link`)
  } catch (e) {
    throw new Error(
      `The destination drive can't hold hard links, which the import needs (NTFS can; FAT32 and exFAT can't). Choose a folder on an NTFS drive. (${errorText(e)})`,
      { cause: e }
    )
  } finally {
    await unlink(probe).catch(() => {})
  }
}
const identity = (s: BigIntStats): string => `${s.dev}:${s.ino}`
const snapshot = (s: BigIntStats): string => `${identity(s)}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`
interface Entry {
  path: string
  directory: boolean
  size: number
  snapshot: string
}
interface Plan {
  preview: ImportPreview
  entries: Entry[]
  destExists: boolean
}

const Rel = z
  .string()
  .refine(
    (p) =>
      /^(builds|assets)(\/|$)/.test(p) &&
      !p.split(/[\\/]/).some((s) => !s || s === '.' || s === '..') &&
      !p.includes('\\') &&
      !p.includes(':')
  )
const Journal = z.object({
  version: z.literal(1),
  committed: z.boolean(),
  files: z.array(Rel),
  directories: z.array(z.object({ path: Rel, identity: z.string().regex(/^\d+:\d+$/) }))
})
type Journal = z.infer<typeof Journal>

/** One operation owns its stage. Destination files are exclusive hard links to staged files. */
export class ImportService {
  state: ImportState = { busy: false, stage: 'idle', copied: 0, total: 0 }
  private controller: AbortController | null = null
  private plan: Plan | null = null

  constructor(
    private protectedRoots: (destination: string) => string[],
    private emit: (state: ImportState) => void
  ) {}

  private update(next: Partial<ImportState>): void {
    this.state = { ...this.state, ...next }
    this.emit(this.state)
  }

  private async destination(
    path: string
  ): Promise<{ path: string; exists: boolean; statRoot: string }> {
    await noLinks(path)
    const info = await lstat(path).catch(missing)
    if (info) {
      const dest = await realpath(path)
      if (!info.isDirectory()) throw new Error('Destination must be a directory')
      for (const root of this.protectedRoots(dest).filter(Boolean))
        if (overlaps(dest, canonicalPath(root)))
          throw new Error(`Workspace overlaps application storage: ${root}`)
      return { path: dest, exists: true, statRoot: dest }
    }
    const statRoot = await nearestExistingAncestor(path)
    const dest = canonicalPath(path)
    for (const root of this.protectedRoots(dest).filter(Boolean))
      if (overlaps(dest, canonicalPath(root)))
        throw new Error(`Workspace overlaps application storage: ${root}`)
    return { path: dest, exists: false, statRoot }
  }

  private async scan(request: ImportRequest, signal: AbortSignal): Promise<Plan> {
    signal.throwIfAborted()
    const destInfo = await this.destination(request.destination)
    const destination = destInfo.path
    await noLinks(request.source)
    const sourceInfo = await lstat(request.source).catch(missing)
    if (!sourceInfo) throw new Error(`Source folder does not exist: ${request.source}`)
    if (!sourceInfo.isDirectory()) throw new Error('Source must be a directory')
    const source = await realpath(request.source)
    if (overlaps(source, destination)) throw new Error('Source and destination must not overlap')
    if (destInfo.exists && (await readdir(destination)).some((n) => n.startsWith(PREFIX)))
      throw new Error('Interrupted import found. Recover this destination before retrying.')
    const buildsInfo = await lstat(join(source, 'builds')).catch(missing)
    if (!buildsInfo?.isDirectory())
      throw new Error(
        `No builds folder found in ${source}. Choose a workspace folder that contains a builds subfolder.`
      )
    const entries: Entry[] = []
    const warnings: string[] = []
    const walk = async (path: string): Promise<void> => {
      signal.throwIfAborted()
      const from = join(source, path)
      await noLinks(from)
      const s = await lstat(from, { bigint: true })
      const directory = s.isDirectory()
      if (!directory && !s.isFile()) throw new Error(`Unsupported source file: ${path}`)
      const to = join(destination, path)
      await noLinks(to)
      const existing = await lstat(to).catch(missing)
      if (existing && (!directory || !existing.isDirectory()))
        throw new Error(`Destination already exists: ${path}`)
      entries.push({ path, directory, size: Number(s.size), snapshot: snapshot(s) })
      if (directory) {
        for (const name of (await readdir(from)).sort())
          if (!excluded(name)) await walk(`${path}/${name}`)
      } else if (/^\.(py|md|json|toml|txt|ya?ml|csv|ini)$/i.test(extname(path))) {
        // shortcut: inspect common text files up to 4 MiB; add format-aware scanning when broader path analysis is needed.
        if (s.size > 4 * 1024 * 1024) {
          warnings.push(`${path}: too large for absolute-path inspection; check manually`)
        } else {
          const lines = (await readFile(from, 'utf8')).split(/\r?\n/)
          lines.forEach((line, i) => {
            const paths =
              line.match(
                /[A-Za-z]:[\\/][^"'<>\r\n)\]]*|\\\\[^"'<>\r\n)\]]+|(?<=["'])\/(?!\/)[^"'\r\n]+/g
              ) ?? []
            for (const value of paths) warnings.push(`${path}:${i + 1}: ${value}`)
          })
        }
      }
    }
    await walk('builds')
    if (request.assets && (await lstat(join(source, 'assets')).catch(missing))) await walk('assets')
    const files = entries.filter((e) => !e.directory)
    const disk = await statfs(destInfo.statRoot)
    const bytes = files.reduce((n, e) => n + e.size, 0)
    const required =
      files.reduce((n, e) => n + Math.ceil(e.size / disk.bsize) * disk.bsize, 1024 * 1024) +
      entries.length * disk.bsize
    return {
      preview: {
        ...request,
        source,
        destination,
        id: randomUUID(),
        builds: new Set(files.map((e) => BUILD_FILE.exec(e.path)?.[1]).filter(Boolean)).size,
        files: files.length,
        bytes,
        required,
        available: disk.bavail * disk.bsize,
        warnings
      },
      entries,
      destExists: destInfo.exists
    }
  }

  async preview(request: ImportRequest): Promise<ImportPreview> {
    if (this.state.busy) throw new Error('An import is already running')
    this.plan = null
    this.controller = new AbortController()
    this.update({ busy: true, stage: 'scanning', copied: 0, total: 0, error: undefined })
    try {
      const plan = await this.scan(request, this.controller.signal)
      if (plan.destExists) await checkHardLinks(plan.preview.destination)
      this.plan = plan
      this.update({ stage: 'preview ready' })
      return plan.preview
    } catch (e) {
      // Preview errors belong to the active preview promise, not persistent singleton import state.
      this.update({
        stage: this.controller.signal.aborted ? 'cancelled' : 'idle',
        error: undefined
      })
      throw e
    } finally {
      this.controller = null
      this.update({ busy: false })
    }
  }

  cancel(): void {
    this.controller?.abort(new Error('Import cancelled'))
  }

  async run(id: string): Promise<string> {
    if (this.state.busy) throw new Error('An import is already running')
    const plan = this.plan
    if (!plan || plan.preview.id !== id) throw new Error('Preview the import again')
    this.plan = null
    const controller = (this.controller = new AbortController())
    const signal = controller.signal
    let stage = ''
    let journalReady = false
    let createdDestDirs: string[] = []
    this.update({
      busy: true,
      stage: 'validating',
      copied: 0,
      total: plan.preview.bytes,
      error: undefined
    })
    try {
      const current = await this.scan(plan.preview, signal)
      if (JSON.stringify(plan.entries) !== JSON.stringify(current.entries))
        throw new Error('Source changed since preview. Preview again.')
      if (current.preview.available < current.preview.required)
        throw new Error('Insufficient disk space')
      signal.throwIfAborted()
      const { source, destination } = plan.preview
      if (!current.destExists) {
        createdDestDirs = await missingAncestors(destination)
        await mkdir(destination, { recursive: true })
      }
      if (!plan.destExists || !current.destExists) await checkHardLinks(destination)
      stage = await mkdtemp(join(destination, PREFIX))
      const journal: Journal = {
        version: 1,
        committed: false,
        files: plan.entries.filter((e) => !e.directory).map((e) => e.path),
        directories: []
      }
      const save = async (): Promise<void> => {
        await writeFile(join(stage, 'journal.tmp'), JSON.stringify(journal))
        await rename(join(stage, 'journal.tmp'), join(stage, 'journal.json'))
      }
      await save()
      journalReady = true
      this.update({ stage: 'copying' })
      let copied = 0
      let lastProgress = 0
      for (const entry of plan.entries) {
        signal.throwIfAborted()
        const from = join(source, entry.path)
        const staged = join(stage, 'data', entry.path)
        await noLinks(from)
        if (entry.directory) {
          await mkdir(staged, { recursive: true })
          continue
        }
        const input = await open(from, constants.O_RDONLY | (constants.O_NOFOLLOW || 0))
        try {
          if (snapshot(await input.stat({ bigint: true })) !== entry.snapshot)
            throw new Error(`Source changed: ${entry.path}`)
          await pipeline(
            input.createReadStream({ autoClose: false }),
            new Transform({
              transform: (chunk, _encoding, done) => {
                copied += chunk.length
                if (Date.now() - lastProgress >= 100) {
                  this.update({ copied })
                  lastProgress = Date.now()
                }
                done(null, chunk)
              }
            }),
            createWriteStream(staged, { flags: 'wx' }),
            { signal }
          )
          if (snapshot(await input.stat({ bigint: true })) !== entry.snapshot)
            throw new Error(`Source changed: ${entry.path}`)
        } finally {
          await input.close()
        }
      }
      for (const entry of plan.entries) {
        signal.throwIfAborted()
        const from = join(source, entry.path)
        await noLinks(from)
        if (snapshot(await lstat(from, { bigint: true })) !== entry.snapshot)
          throw new Error(`Source changed: ${entry.path}`)
      }
      this.update({ stage: 'activating', copied })
      for (const entry of plan.entries) {
        signal.throwIfAborted()
        const to = join(destination, entry.path)
        await noLinks(to)
        if (entry.directory) {
          try {
            await mkdir(to)
            journal.directories.push({
              path: entry.path,
              identity: identity(await lstat(to, { bigint: true }))
            })
            await save()
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'EEXIST' || !(await lstat(to)).isDirectory())
              throw e
          }
        } else {
          // link() fails on an existing file and makes rollback ownership provable by inode.
          try {
            await link(join(stage, 'data', entry.path), to)
          } catch (e) {
            throw new Error(
              `Could not activate ${entry.path}: ${errorText(e)}. Destination must support hard links and allow file creation.`,
              { cause: e }
            )
          }
        }
      }
      signal.throwIfAborted()
      journal.committed = true
      await save()
      await this.cleanup(destination, stage)
      stage = ''
      createdDestDirs = []
      this.update({ stage: 'done' })
      return destination
    } catch (e) {
      let error = errorText(e)
      if (stage) {
        try {
          if (journalReady) await this.cleanup(plan.preview.destination, stage)
          else {
            await noLinks(stage)
            await rm(stage, { recursive: true })
          }
        } catch (cleanup) {
          error += `; recovery required: ${errorText(cleanup)}`
        }
      }
      for (const dir of createdDestDirs) {
        await rmdir(dir).catch(() => {})
      }
      this.update({ stage: signal.aborted ? 'cancelled' : 'failed', error })
      throw new Error(error, { cause: e })
    } finally {
      this.controller = null
      this.update({ busy: false })
    }
  }

  private async cleanup(destination: string, stage: string): Promise<void> {
    if (dirname(stage) !== destination || !stage.split(sep).at(-1)?.startsWith(PREFIX))
      throw new Error('Invalid recovery directory')
    await noLinks(stage)
    await noLinks(join(stage, 'journal.json'))
    if ((await readdir(stage)).length === 0) {
      await rmdir(stage)
      return
    }
    const journal = Journal.parse(JSON.parse(await readFile(join(stage, 'journal.json'), 'utf8')))
    if (!journal.committed) {
      for (const path of journal.files) {
        const staged = join(stage, 'data', path)
        const to = join(destination, path)
        await noLinks(staged)
        await noLinks(to)
        const a = await lstat(staged, { bigint: true }).catch(missing)
        const b = await lstat(to, { bigint: true }).catch(missing)
        if (a?.isFile() && b?.isFile() && identity(a) === identity(b)) await unlink(to)
      }
      for (const dir of journal.directories.toReversed()) {
        const to = join(destination, dir.path)
        await noLinks(to)
        const info = await lstat(to, { bigint: true }).catch(missing)
        if (info?.isDirectory() && identity(info) === dir.identity)
          await rmdir(to).catch((e: NodeJS.ErrnoException) => {
            if (e.code !== 'ENOTEMPTY' && e.code !== 'EEXIST') throw e
          })
      }
    }
    await rm(stage, { recursive: true })
  }

  async recover(path: string): Promise<void> {
    if (this.state.busy) throw new Error('An import is already running')
    this.update({ busy: true, stage: 'recovering', error: undefined })
    try {
      const destInfo = await this.destination(path)
      if (destInfo.exists) {
        for (const name of await readdir(destInfo.path)) {
          if (!name.startsWith(PREFIX)) continue
          const stage = join(destInfo.path, name)
          await this.cleanup(destInfo.path, stage)
        }
      }
      this.update({ stage: 'recovered', error: undefined })
    } catch (e) {
      this.update({ stage: 'failed', error: errorText(e) })
      throw e
    } finally {
      this.update({ busy: false })
    }
  }
}
