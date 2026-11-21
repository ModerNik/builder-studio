import { mkdir } from 'fs/promises'
import { join } from 'path'
import type { Settings } from '@shared/api'
import { canonicalPath } from '../workspace/paths'
import { insideRepo } from '../agent/permissions'
import { noLinks, validateWorkspace } from '../workspace/workspace'

/** Only the dedicated workspace subtree is exempt from the app-data boundary. */
export function protectedStorage(s: Settings, userData: string, workspace = s.workspace): string[] {
  const allowed = insideRepo(canonicalPath(join(userData, 'workspace')), canonicalPath(workspace))
  return [
    s.resources,
    s.runtime,
    s.runtimeHome,
    s.cache,
    join(userData, 'runtime'),
    join(userData, 'cache'),
    ...(allowed ? [] : [userData])
  ]
}

export async function prepareFolders(s: Settings, userData: string): Promise<void> {
  await validateWorkspace(s.workspace, protectedStorage(s, userData), true)
  for (const folder of new Set([s.assets, s.schematics, s.runtimeHome, s.cache])) {
    await noLinks(folder)
    await mkdir(folder, { recursive: true })
    await validateWorkspace(folder)
  }
}

/** Retry checks each tool again; already completed installations are kept. */
export async function prepareTools(
  check: (tool: 'engine' | 'git' | 'browser') => Promise<void>,
  install: (tool: 'engine' | 'git' | 'browser') => Promise<void>,
  history: () => Promise<void>,
  signal: AbortSignal
): Promise<void> {
  for (const tool of ['engine', 'git', 'browser'] as const) {
    signal.throwIfAborted()
    try {
      await check(tool)
    } catch {
      signal.throwIfAborted()
      await install(tool)
      await check(tool)
    }
  }
  signal.throwIfAborted()
  await history()
}
