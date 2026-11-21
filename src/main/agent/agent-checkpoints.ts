import { randomUUID } from 'crypto'
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'fs'
import { dirname, join, relative, resolve, sep } from 'path'
import { canonicalPath } from '../workspace/paths'
import { buildDir } from '../workspace/projects'

type File = { data: Buffer; mode: number }
type Snapshot = Map<string, File>
type Change = { before: File | undefined; after: File | undefined }
type Checkpoint = { root: string; session: string; turn: string; changes: Map<string, Change> }
const MAX_BYTES = 8 * 1024 * 1024
const EXCLUDED = new Set(['out', 'attachments', 'refs', 'review'])
const same = (a: File | undefined, b: File | undefined): boolean =>
  a === b || (!!a && !!b && a.mode === b.mode && a.data.equals(b.data))

function scan(root: string): Snapshot {
  const files: Snapshot = new Map()
  let bytes = 0
  let entries = 0
  if (relative(resolve(root), canonicalPath(root)))
    throw new Error('The build path contains a link.')
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = entry.name.toLowerCase()
      if (name.startsWith('.') || name === '__pycache__' || (dir === root && EXCLUDED.has(name)))
        continue
      const path = join(dir, entry.name)
      const stat = lstatSync(path)
      if (++entries > 2000) throw new Error('This build has too many files for checkpoints.')
      if (stat.isDirectory()) visit(path)
      if (!stat.isFile() || stat.nlink !== 1) continue
      bytes += stat.size
      if (bytes > MAX_BYTES) throw new Error('This build is too large for file checkpoints.')
      files.set(relative(root, path), { data: readFileSync(path), mode: stat.mode })
    }
  }
  visit(root)
  return files
}

function checkedPath(root: string, name: string): string {
  const path = join(root, name)
  if (relative(path, canonicalPath(path))) throw new Error(`File path changed: ${name}`)
  for (let parent = path; parent !== root; parent = dirname(parent)) {
    const stat = lstatSync(parent, { throwIfNoEntry: false })
    if (stat && (parent === path ? !stat.isFile() || stat.nlink !== 1 : !stat.isDirectory()))
      throw new Error(`File path changed: ${name}`)
  }
  return path
}

function write(root: string, name: string, content: File | undefined): void {
  const path = checkedPath(root, name)
  if (!content) return rmSync(path, { force: true })
  mkdirSync(dirname(path), { recursive: true })
  const tmp = join(dirname(path), `.rewind-${randomUUID()}`)
  try {
    writeFileSync(tmp, content.data, { mode: content.mode, flag: 'wx' })
    renameSync(tmp, path)
  } finally {
    rmSync(tmp, { force: true })
  }
}

/** A bounded undo log for the current app session. Capture sources only, including files changed by shell tools. */
export class AgentCheckpoints {
  private pending = new Map<string, { root: string; before: Snapshot | null }>()
  // shortcut: keep eight turns in memory, move checkpoints to disk if persistent file undo is needed.
  private log: Checkpoint[] = []

  start(thread: string, workspace: string, build: string, isolated: boolean): void {
    if (this.pending.has(thread)) isolated = false
    this.cancel(thread)
    try {
      const root = buildDir(workspace, build)
      for (const other of this.pending.values()) {
        if (other.root !== root) continue
        other.before = null
        isolated = false
      }
      this.pending.set(thread, { root, before: isolated ? scan(root) : null })
    } catch {
      // Chat can continue when a source directory cannot be checkpointed.
    }
  }

  finish(thread: string, session: string, turn: string): void {
    const pending = this.pending.get(thread)
    this.cancel(thread)
    if (!pending?.before) return
    try {
      const { root, before } = pending
      const after = scan(root)
      const changes = new Map<string, Change>()
      for (const name of new Set([...before.keys(), ...after.keys()])) {
        const old = before.get(name)
        const current = after.get(name)
        if (!same(old, current)) changes.set(name, { before: old, after: current })
      }
      this.log = [...this.log.slice(-7), { root, session, turn, changes }]
    } catch {
      // Incomplete captures cannot be rewound.
    }
  }

  cancel(thread: string): void {
    this.pending.delete(thread)
  }

  plan(
    workspace: string,
    build: string,
    session: string,
    turns: string[]
  ): {
    files: string[]
    apply(): void
  } {
    const root = buildDir(workspace, build)
    if (!turns.length) throw new Error('Choose a turn to restore.')
    if ([...this.pending.values()].some((p) => p.root === root))
      throw new Error('Wait for active turns on this build to finish.')
    const current = scan(root)
    const changes = new Map<string, Change>()
    for (const turn of turns.toReversed()) {
      const entry = this.log.find(
        (e) => e.root === root && e.session === session && e.turn === turn
      )
      if (!entry)
        throw new Error('A file checkpoint is unavailable for one or more of these turns.')
      for (const [name, change] of entry.changes) {
        const expected = changes.has(name) ? changes.get(name)!.before : current.get(name)
        if (!same(change.after, expected))
          throw new Error(`A newer edit to ${name} would be overwritten.`)
        changes.set(name, { before: change.before, after: current.get(name) })
      }
    }
    const paths = [...changes].filter(([, c]) => !same(c.before, c.after))
    for (const [name] of paths) checkedPath(root, name)
    return {
      files: paths.map(([name]) => name.split(sep).join('/')).sort(),
      apply: () => {
        const applied: typeof paths = []
        try {
          for (const [name, change] of paths) {
            write(root, name, change.before)
            applied.push([name, change])
          }
        } catch (e) {
          const failed: string[] = []
          for (const [name, change] of applied.reverse()) {
            try {
              write(root, name, change.after)
            } catch {
              failed.push(name)
            }
          }
          if (failed.length)
            throw new Error(`File rewind stopped and could not roll back: ${failed.join(', ')}`, {
              cause: e
            })
          throw e
        }
      }
    }
  }
}
