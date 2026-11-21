import { createHash } from 'crypto'
import { statSync } from 'fs'
import { delimiter, dirname, join, resolve } from 'path'
import type { Settings } from '@shared/api'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'

/** The Minecraft version the engine targets (mcb.config.MC_VERSION). */
export const MC_VERSION = DEFAULT_MINECRAFT_VERSION
/** The engine's default pack under the cache (mcb.locations.PACK); r2 flattens sprite objects. */
export const DEFAULT_PACK = join('packs', `vanilla-${MC_VERSION}-r2.zip`)

export function fileRevision(path: string): string {
  const stat = statSync(path, { throwIfNoEntry: false })
  return createHash('sha256')
    .update(JSON.stringify([path, stat?.size, stat?.mtimeMs]))
    .digest('hex')
    .slice(0, 16)
}

export interface LocationDefaults {
  workspace?: string
  schematics?: string
  jar?: string
  resources: string
  runtime: string
  cache: string
  claude: string
}

export function resolveLocations(s: Settings, defaults: LocationDefaults): Settings {
  const workspace =
    s.workspace || defaults.workspace ? resolve(s.workspace || defaults.workspace!) : ''
  const runtime = resolve(
    s.runtime || (s.runtimeHome ? join(s.runtimeHome, 'current') : defaults.runtime)
  )
  const cache = resolve(s.cache || defaults.cache)
  const version = s.minecraftVersion ?? MC_VERSION
  const files = s.minecraftFiles?.[version]
  const jarPath = files?.jar ?? (version === MC_VERSION ? s.jar : '')
  const jar = jarPath ? resolve(workspace || '.', jarPath) : defaults.jar || ''
  const pack = files?.pack ?? (version === MC_VERSION ? s.pack : '')
  return {
    ...s,
    workspace,
    resources: resolve(s.resources || defaults.resources),
    runtime,
    runtimeHome: resolve(s.runtimeHome || dirname(defaults.runtime)),
    cache,
    assets: s.assets
      ? resolve(workspace || '.', s.assets)
      : workspace
        ? join(workspace, 'assets')
        : '',
    python: s.python
      ? /[\\/]/.test(s.python)
        ? resolve(workspace || '.', s.python)
        : s.python
      : join(runtime, 'python.exe'),
    pack: pack
      ? resolve(workspace || '.', pack)
      : join(
          cache,
          jar
            ? join('packs', `vanilla-${version}-r3-${fileRevision(jar)}.zip`)
            : version === MC_VERSION
              ? DEFAULT_PACK
              : join('packs', `vanilla-${version}-r3.zip`)
        ),
    jar,
    saves: s.saves ? resolve(workspace || '.', s.saves) : '',
    schematics: s.schematics ? resolve(workspace || '.', s.schematics) : defaults.schematics || '',
    claude: s.claude || defaults.claude
  }
}

/** One environment for jobs, bridge and agent-launched commands. Never inherit a checkout's PYTHONPATH. */
export function runtimeEnv(s: Settings): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PYTHONHOME: '',
    PYTHONNOUSERSITE: '1',
    MPLCONFIGDIR: join(s.cache, 'matplotlib'),
    PATH: s.git
      ? [process.env.PATH, join(s.git, '..')].filter(Boolean).join(delimiter)
      : process.env.PATH,
    PLAYWRIGHT_BROWSERS_PATH: s.browser || join(s.cache, 'browsers'),
    PYTHONPATH: s.workspace,
    PYTHONUTF8: '1',
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    PYTHONDONTWRITEBYTECODE: '1',
    MCB_EVENTS: '1',
    MCB_WORKSPACE: s.workspace,
    MCB_RESOURCES: s.resources,
    MCB_RUNTIME: s.runtime,
    MCB_CACHE: s.cache,
    MCB_ASSETS: s.assets,
    MCB_PACK: s.pack,
    MCB_PYTHON: s.python,
    MCB_SCHEMATICS: s.schematics,
    MCB_MC_JAR: s.jar,
    SCHEMATICA_MC_VERSION: s.minecraftVersion ?? MC_VERSION,
    SCHEMATICA_MINECRAFT_DATA:
      (s.python !== join(s.runtime, 'python.exe') && process.env.SCHEMATICA_MINECRAFT_DATA) ||
      join(s.resources, '.claude/skills/schematica/minecraft_data')
  }
}
