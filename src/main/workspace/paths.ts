import { dirname, isAbsolute, relative, resolve, sep } from 'path'
import { existsSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'fs'

/** tmp + rename, so a reader (the agent, the watcher) never sees half a file. */
export function writeAtomic(file: string, text: string): void {
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, text)
  try {
    renameSync(tmp, file)
  } catch (e) {
    rmSync(tmp, { force: true })
    throw e
  }
}

export interface FileRoots {
  workspace: string
  resources: string
  cache: string
  assets: string
}

/** Keep existing workspace URLs; external bridge paths must fall within one of these scoped mounts. */
export function servedFile(url: string, roots: FileRoots): string | null {
  try {
    const u = new URL(url)
    const path = decodeURIComponent(u.pathname.replace(/^\/+/, ''))
    const mounts = {
      repo: roots.workspace,
      resource: roots.resources,
      cache: roots.cache,
      assets: roots.assets
    }
    for (const [host, root] of Object.entries(mounts)) {
      if (!root || (u.host !== host && u.host !== 'local')) continue
      const rel = u.host === 'local' ? relative(root, path) : path
      const file = under(root, rel)
      if (!file) continue
      const posix = rel.split(sep).join('/')
      if (
        host === 'resource' &&
        !['lib/mcb/data/block_colors.json', 'docs/catalog.md'].includes(posix)
      )
        continue
      if (
        host === 'cache' &&
        !/^(site|swatches|catalog|renders)\/.+\.(png|heights|md)$/.test(posix) &&
        !/^schematic-imports\/[a-f0-9-]{36}\/(blocks|base|verify)\.litematic$/.test(posix)
      )
        continue
      const real = realpathSync(file)
      if (under(realpathSync(root), relative(realpathSync(root), real)) && statSync(real).isFile())
        return real
    }
  } catch {
    // Malformed URLs, missing files and symlinks out of the mount are never served.
  }
  return null
}

/** `rel` resolved under `root`, or null when it would escape it (`..`, absolute paths, other drives). */
export function under(root: string, rel: string): string | null {
  if (!root || rel.split(/[\\/]/).includes('..') || isAbsolute(rel) || /^[a-zA-Z]:/.test(rel))
    return null
  const full = resolve(root, rel)
  const r = relative(resolve(root), full)
  return r && !r.startsWith('..' + sep) && r !== '..' && !isAbsolute(r) ? full : null
}

/** Resolve existing ancestors too, so Windows short-path aliases cannot bypass root comparisons. */
export function canonicalPath(path: string): string {
  const full = resolve(path)
  let existing = full
  while (!existsSync(existing) && dirname(existing) !== existing) existing = dirname(existing)
  return resolve(realpathSync.native(existing), relative(existing, full))
}

/** Application tools must also reject existing junctions/symlinks, including a missing file's parent. */
export function toolPath(root: string, rel: string): string {
  const file = under(root, rel)
  if (!file) throw new Error('Application tool path must stay inside the workspace')
  let existing = file
  while (!existsSync(existing) && dirname(existing) !== existing) existing = dirname(existing)
  const realRoot = realpathSync(root)
  const real = realpathSync(existing)
  if (real !== realRoot && !under(realRoot, relative(realRoot, real)))
    throw new Error('Application tool path escapes the workspace through a link')
  return file
}
