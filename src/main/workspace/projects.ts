// ProjectService: builds/* read straight from the repo (DESIGN.md, out/), refreshed by a chokidar watch.
import { watch, type FSWatcher } from 'chokidar'
import { existsSync, readFileSync } from 'fs'
import { mkdir, readdir, readFile, rename, stat } from 'fs/promises'
import { dirname, join, posix } from 'path'
import { ProjectMetaSchema, ProjectNameSchema, type BuildSummary, type Round } from '@shared/api'
import { normalizeProjectName } from '@shared/project-name'
import { DEFAULT_MINECRAFT_VERSION, isMinecraftVersion } from '@shared/minecraft'
import { toolPath, under, writeAtomic } from './paths'

const PROJECT_META_FILE = 'project.json'
const ISO_VIEWS = ['preview.png', 'iso_se.png', 'iso_sw.png', 'iso_ne.png', 'iso_nw.png'] as const

export function readProjectDisplayName(repo: string, name: string): string {
  try {
    const file = toolPath(repo, posix.join('builds', name, PROJECT_META_FILE))
    const parsed = ProjectMetaSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
    if (parsed.success) return parsed.data.name
  } catch {
    // missing or malformed metadata falls back to the folder name
  }
  return name
}

export function writeProjectDisplayName(repo: string, name: string, displayName: string): string {
  const clean = ProjectNameSchema.parse(displayName)
  buildDir(repo, name)
  const file = toolPath(repo, posix.join('builds', name, PROJECT_META_FILE))
  writeAtomic(file, JSON.stringify({ name: clean }, null, 2) + '\n')
  return clean
}

export function readMinecraftVersion(path: string): string {
  let content: string
  try {
    content = readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return DEFAULT_MINECRAFT_VERSION
    throw error
  }
  const value = JSON.parse(content)?.minecraftVersion
  if (typeof value !== 'string' || !isMinecraftVersion(value))
    throw new Error('This project or draft uses an unsupported Minecraft version')
  return value
}

export function projectMinecraftVersion(repo: string, name: string): string {
  buildDir(repo, name)
  return readMinecraftVersion(toolPath(repo, `builds/${name}/minecraft.json`))
}

export function draftMinecraftVersion(repo: string, path: string): string {
  if (!path.endsWith('.litematic')) return DEFAULT_MINECRAFT_VERSION
  return readMinecraftVersion(toolPath(repo, path.replace(/\.litematic$/, '.minecraft.json')))
}

/** Where a draft's (0, 0, 0) sits in build coordinates: the engine records it in <stem>.minecraft.json. */
export function draftOrigin(repo: string, path: string): [number, number, number] | undefined {
  try {
    const sidecar = toolPath(repo, path.replace(/\.litematic$/, '.minecraft.json'))
    const origin = JSON.parse(readFileSync(sidecar, 'utf8'))?.origin
    return Array.isArray(origin) && origin.length === 3 && origin.every(Number.isInteger)
      ? (origin as [number, number, number])
      : undefined
  } catch {
    return undefined
  }
}

/** The `## Status` bullets, the `### Round N: title` headings and the `### Shipped <stem> (date)` headings Export adds. */
export function parseDesign(md: string): { status: string[]; rounds: Round[]; shipped: string[] } {
  const status: string[] = []
  const rounds: Round[] = []
  const shipped: string[] = []
  let inStatus = false
  for (const line of md.split(/\r?\n/)) {
    if (/^##\s/.test(line)) inStatus = /^##\s+Status\b/i.test(line)
    else if (inStatus && line.trim()) {
      if (/^\s*[-*]\s/.test(line)) status.push(line.replace(/^\s*[-*]\s+/, ''))
      else if (status.length) status[status.length - 1] += ' ' + line.trim() // wrapped bullet
    }
    const r = /^###\s+Round\s+(\d+)\s*[:.\-–—]?\s*(.*)$/i.exec(line)
    if (r) rounds.push({ n: Number(r[1]), title: r[2].trim() })
    const s = /^###\s+Shipped\s+(.+?)(?:\s+\(\d{4}-\d{2}-\d{2}\))?\s*$/.exec(line)
    if (s) shipped.push(s[1].trim())
  }
  return { status, rounds, shipped }
}

async function dirs(p: string): Promise<string[]> {
  const entries = await readdir(p, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== '__pycache__')
    .map((e) => e.name)
}

/** One unreadable or newer version file must not hide every project; running it still fails in projectSettings. */
function listedVersion(read: () => string): string | undefined {
  try {
    return read()
  } catch {
    return undefined
  }
}

async function findIsoRender(
  out: string,
  rel: (...p: string[]) => string,
  renders: Set<string>,
  stem: string
): Promise<{ path: string; mtime: number } | undefined> {
  for (const dir of [`${stem}_3d`, `${stem}_ctx`]) {
    if (!renders.has(dir)) continue
    const fullDir = join(out, dir)
    for (const file of ISO_VIEWS) {
      const s = await stat(join(fullDir, file)).catch(() => null)
      if (s?.isFile()) return { path: rel('out', dir, file), mtime: s.mtimeMs }
    }
    const entries = await readdir(fullDir, { withFileTypes: true }).catch(() => [])
    const extra = entries
      .filter((e) => e.isFile() && /^iso_.*\.png$/i.test(e.name))
      .map((e) => e.name)
      .sort()[0]
    if (extra) {
      const s = await stat(join(fullDir, extra)).catch(() => null)
      if (s?.isFile()) return { path: rel('out', dir, extra), mtime: s.mtimeMs }
    }
  }
  return undefined
}

async function summary(repo: string, name: string): Promise<BuildSummary> {
  const dir = join(repo, 'builds', name)
  const displayName = readProjectDisplayName(repo, name)
  const minecraftVersion = listedVersion(() => projectMinecraftVersion(repo, name))
  const design = await readFile(join(dir, 'DESIGN.md'), 'utf8').catch(() => '')
  const out = join(dir, 'out')
  const rel = (...p: string[]): string => posix.join('builds', name, ...p)
  const files = await readdir(out, { withFileTypes: true }).catch(() => [])
  const versions: BuildSummary['versions'] = []
  let sheet: { path: string; mtime: number } | undefined
  await Promise.all(
    files.map(async (f) => {
      if (f.isFile() && f.name.endsWith('.litematic')) {
        const s = await stat(join(out, f.name))
        const path = rel('out', f.name)
        versions.push({
          path,
          mtime: s.mtimeMs,
          size: s.size,
          minecraftVersion: listedVersion(() => draftMinecraftVersion(repo, path)),
          origin: draftOrigin(repo, path)
        })
      } else if (f.isDirectory() && !f.name.startsWith('.')) {
        const s = await stat(join(out, f.name, 'sheet.png')).catch(() => null)
        if (s && (!sheet || s.mtimeMs > sheet.mtime))
          sheet = { path: rel('out', f.name, 'sheet.png'), mtime: s.mtimeMs }
      }
    })
  )
  const renders = new Set(files.filter((f) => f.isDirectory()).map((f) => f.name))
  const tagged = new Set(files.filter((f) => f.isFile()).map((f) => f.name))
  for (const v of versions) {
    const stem = posix.basename(v.path, '.litematic')
    if (tagged.has(`${stem}.parts.npz`)) v.parts = true
    const dir = [`${stem}_3d`, `${stem}_ctx`].find(
      (d) => renders.has(d) && existsSync(join(out, d, 'sheet.png'))
    )
    if (dir) v.sheet = rel('out', dir, 'sheet.png')
  }
  versions.sort((a, b) => b.mtime - a.mtime)
  const parsed = parseDesign(design)
  const previewCandidates = [
    ...[...parsed.shipped].reverse(),
    posix.basename(name),
    'full',
    ...versions.map((v) => posix.basename(v.path, '.litematic'))
  ]
  const seen = new Set<string>()
  let preview: { path: string; mtime: number } | undefined
  // Custom Render Studio thumbnails (preview.png) take priority over auto-rendered iso views
  for (const dir of renders) {
    if (!dir.endsWith('_3d') && !dir.endsWith('_ctx')) continue
    const s = await stat(join(out, dir, 'preview.png')).catch(() => null)
    if (s?.isFile() && (!preview || s.mtimeMs > preview.mtime))
      preview = { path: rel('out', dir, 'preview.png'), mtime: s.mtimeMs }
  }
  if (!preview) {
    for (const stem of previewCandidates) {
      if (!stem || seen.has(stem)) continue
      seen.add(stem)
      preview = await findIsoRender(out, rel, renders, stem)
      if (preview) break
    }
  }
  const mtime = Math.max(0, versions[0]?.mtime ?? 0, sheet?.mtime ?? 0, preview?.mtime ?? 0)
  return {
    name,
    displayName,
    minecraftVersion,
    ...parsed,
    preview: preview?.path,
    previewMtime: preview?.mtime,
    sheet: sheet?.path,
    versions,
    mtime
  }
}

/** builds/<name> with a build.py or DESIGN.md; folders starting with _ hold more builds one level down. */
export async function listBuilds(repo: string): Promise<BuildSummary[]> {
  if (!repo) return []
  const root = join(repo, 'builds')
  const names: string[] = []
  for (const d of await dirs(root)) {
    if (d === ARCHIVE) continue
    if (d.startsWith('_')) names.push(...(await dirs(join(root, d))).map((s) => `${d}/${s}`))
    else names.push(d)
  }
  const real = names.filter((n) =>
    ['build.py', 'DESIGN.md'].some((f) => existsSync(join(root, n, f)))
  )
  return (await Promise.all(real.map((n) => summary(repo, n)))).sort((a, b) => b.mtime - a.mtime)
}

const ARCHIVE = '_archive'
const BUILD = /^(_[\w.-]+\/)?[\w.-]+$/ // castle, _examples/showcase

/** Sends a file or folder to the Recycle Bin (Electron's shell.trashItem; injected so tests can run in node). */
export type Trash = (path: string) => Promise<void>

export function buildDir(repo: string, name: string): string {
  const dir =
    BUILD.test(name) && !name.startsWith(ARCHIVE) ? under(repo, posix.join('builds', name)) : null
  if (!dir || !existsSync(dir)) throw new Error(`no build ${name}`)
  return dir
}

/** builds/<b>/out/<stem>.litematic, its <stem>_3d/ and _ctx/ renders, its <stem>.parts.npz op tags and the
 *  .parts/<stem>/ files cut from them to the Recycle Bin. */
export async function deleteVersion(repo: string, path: string, trash: Trash): Promise<void> {
  const m = /^builds\/((?:_[\w.-]+\/)?[\w.-]+)\/out\/([\w.-]+)\.litematic$/.exec(path)
  const file = m && under(repo, path)
  if (!file || !existsSync(file)) throw new Error(`no version ${path}`)
  await trash(file)
  const beside = [
    `${m[2]}_3d`,
    `${m[2]}_ctx`,
    `${m[2]}.parts.npz`,
    `${m[2]}.minecraft.json`,
    `.parts/${m[2]}`
  ]
  for (const p of beside.map((s) => join(dirname(file), s))) if (existsSync(p)) await trash(p)
}

/** Updates the project's display name in project.json while keeping its folder stable; returns its build id. */
export async function renameBuild(repo: string, name: string, to: string): Promise<string> {
  const clean = ProjectNameSchema.parse(to)
  buildDir(repo, name)
  const existing = await listBuilds(repo)
  const target = normalizeProjectName(clean)
  if (existing.some((b) => b.name !== name && normalizeProjectName(b.displayName) === target))
    throw new Error(`${clean} already exists`)
  writeProjectDisplayName(repo, name, clean)
  return name
}

/** Keeps the sources: out/ (drafts and renders) to the Recycle Bin, the rest to builds/_archive/<name>. */
export async function archiveBuild(repo: string, name: string, trash: Trash): Promise<string> {
  const dir = buildDir(repo, name)
  const out = join(dir, 'out')
  let target = join(repo, 'builds', ARCHIVE, posix.basename(name))
  if (existsSync(target)) target += '_' + new Date().toISOString().slice(0, 19).replace(/\D/g, '')
  if (existsSync(out)) await trash(out)
  await mkdir(dirname(target), { recursive: true })
  await rename(dir, target)
  return target
}

/** Bytes under builds/<name>/out, for the delete dialog. */
export async function outSize(repo: string, name: string): Promise<number> {
  const walk = async (p: string): Promise<number> => {
    const entries = await readdir(p, { withFileTypes: true }).catch(() => [])
    const sizes = await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? walk(join(p, e.name))
          : stat(join(p, e.name)).then(
              (s) => s.size,
              () => 0
            )
      )
    )
    return sizes.reduce((a, b) => a + b, 0)
  }
  return walk(join(buildDir(repo, name), 'out'))
}

export class ProjectService {
  private watcher: FSWatcher | null = null
  private timer: NodeJS.Timeout | undefined

  constructor(private changed: () => void) {}

  async watch(repo: string): Promise<void> {
    await this.dispose()
    if (!repo || !existsSync(join(repo, 'builds'))) return
    this.watcher = watch(join(repo, 'builds'), {
      ignoreInitial: true,
      depth: 3, // builds/<name>/out/<stem>_3d/sheet.png
      awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
      ignored: (p) => /[\\/](__pycache__|\.cache|\.diff|\.parts|node_modules)([\\/]|$)/.test(p)
    })
    this.watcher.on('all', () => {
      clearTimeout(this.timer)
      this.timer = setTimeout(this.changed, 300)
    })
  }

  async dispose(): Promise<void> {
    clearTimeout(this.timer)
    const watcher = this.watcher
    this.watcher = null
    await watcher?.close()
  }
}
