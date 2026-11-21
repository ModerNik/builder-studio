// App settings and resolved locations; the workspace contains user data only.
import { app } from 'electron'
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { SettingsSchema, type PathCheck, type Settings } from '@shared/api'
import { resolveLocations, runtimeEnv } from './locations'
import { projectMinecraftVersion } from '../workspace/projects'
import { findClaude, findJar } from '../runtime/detect'

const file = (): string => join(app.getPath('userData'), 'settings.json')

const EMPTY: Settings = {
  version: 2,
  workspace: '',
  setup: { step: 'welcome', completed: false },
  saves: '',
  resources: '',
  runtime: '',
  runtimeHome: '',
  previousRuntime: '',
  browser: '',
  git: '',
  cache: '',
  assets: '',
  importSource: '',
  python: '',
  schematics: '',
  jar: '',
  claude: '',
  provider: 'claude',
  codex: '',
  gitBash: '',
  ollamaEndpoint: 'http://127.0.0.1:11434',
  ollamaModel: '',
  pack: '',
  agentAllow: {},
  variantCap: 3,
  appearance: { theme: 'dark', scale: 1 }
}
let current: Settings | undefined

export function getSettings(): Settings {
  if (!current) {
    try {
      const raw = { ...EMPTY, ...JSON.parse(readFileSync(file(), 'utf8')) }
      // Older or hand-edited files keep every valid field; invalid ones use defaults in memory only.
      const r = SettingsSchema.safeParse(raw)
      current = r.success
        ? r.data
        : SettingsSchema.parse({
            ...raw,
            ...Object.fromEntries(
              r.error.issues.map((i) => [i.path[0], EMPTY[i.path[0] as keyof Settings]])
            )
          })
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      current = { ...EMPTY }
    }
  }
  return current
}

export function setSettings(s: Settings): Settings {
  const next = SettingsSchema.parse(s)
  const json = JSON.stringify(next, null, 2)
  const tmp = file() + '.tmp'
  writeFileSync(tmp, json)
  try {
    renameSync(tmp, file())
  } catch {
    // seen as EXDEV under a sandboxed/virtualised AppData: write in place instead
    writeFileSync(file(), json)
    rmSync(tmp, { force: true })
  }
  return (current = next)
}

// shortcut: a PATH scan costs ~4 ms and resolved() runs on every IPC call, so the result lives 5 s; a new install shows up within that.
let claude = { at: 0, path: '' }
const detectedClaude = (): string => {
  if (Date.now() - claude.at > 5000) claude = { at: Date.now(), path: findClaude() ?? '' }
  return claude.path
}
// Same shortcut for the jar: findJar reads launcher folders synchronously, once per Minecraft version.
const jars = new Map<string | undefined, { at: number; path: string }>()
const detectedJar = (version?: string): string => {
  let jar = jars.get(version)
  if (!jar || Date.now() - jar.at > 5000) {
    jar = { at: Date.now(), path: findJar(app.getPath('appData'), version) || '' }
    jars.set(version, jar)
  }
  return jar.path
}

/** Installed resources are outside ASAR so Python and the local screenshot server can read them. */
export function resolved(s = getSettings(), version = s.minecraftVersion): Settings {
  return resolveLocations(
    { ...s, minecraftVersion: version },
    {
      workspace: join(app.getPath('userData'), 'workspace'),
      schematics: join(app.getPath('userData'), 'schematics'),
      jar: detectedJar(version),
      resources: app.isPackaged
        ? join(process.resourcesPath, 'engine')
        : join(app.getAppPath(), 'out/runtime/engine/resources'),
      runtime: join(app.getPath('userData'), 'runtime', 'current'),
      cache: join(app.getPath('userData'), 'cache'),
      claude: s.claude ? '' : detectedClaude()
    }
  )
}

export function checkPaths(): PathCheck[] {
  const r = resolved()
  return (
    [
      'workspace',
      'resources',
      'runtime',
      'runtimeHome',
      'cache',
      'assets',
      'python',
      'schematics',
      'jar',
      'claude',
      'pack'
    ] as const
  ).map((name) => ({ name, path: r[name], ok: !!r[name] && existsSync(r[name]) }))
}

export function pythonEnv(s = resolved()): NodeJS.ProcessEnv {
  return runtimeEnv(s)
}

export function projectSettings(name: string): Settings {
  return resolved(getSettings(), projectMinecraftVersion(resolved().workspace, name))
}
