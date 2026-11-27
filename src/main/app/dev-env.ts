// Development-only .env loader and settings overrides; never active in packaged builds.
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseEnv } from 'util'
import {
  MinecraftVersionSchema,
  ProviderSchema,
  SETUP_STEPS,
  SettingsSchema,
  UI_SCALES,
  type Settings
} from '@shared/api'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'

/** Highest-to-lowest precedence, matching Vite's development env lookup. */
export const DEV_ENV_FILES = [
  '.env.development.local',
  '.env.development',
  '.env.local',
  '.env'
] as const

type StringSettingKey = {
  [K in keyof Settings]-?: Settings[K] extends string ? K : never
}[keyof Settings]

const STRING_SETTINGS: ReadonlyArray<readonly [envKey: string, settingKey: StringSettingKey]> = [
  ['BS_WORKSPACE', 'workspace'],
  ['BS_ASSETS', 'assets'],
  ['BS_RESOURCES', 'resources'],
  ['BS_RUNTIME', 'runtime'],
  ['BS_RUNTIME_HOME', 'runtimeHome'],
  ['BS_PREVIOUS_RUNTIME', 'previousRuntime'],
  ['BS_CACHE', 'cache'],
  ['BS_PYTHON', 'python'],
  ['BS_BROWSER', 'browser'],
  ['BS_GIT', 'git'],
  ['BS_IMPORT_SOURCE', 'importSource'],
  ['BS_SCHEMATICS', 'schematics'],
  ['BS_SAVES', 'saves'],
  ['BS_JAR', 'jar'],
  ['BS_PACK', 'pack'],
  ['BS_CLAUDE', 'claude'],
  ['BS_CODEX', 'codex'],
  ['BS_GIT_BASH', 'gitBash'],
  ['BS_OLLAMA_ENDPOINT', 'ollamaEndpoint'],
  ['BS_OLLAMA_MODEL', 'ollamaModel']
]

/**
 * Loads local .env* files from `dir` into `env` without overwriting keys already set in the shell
 * or in a higher-priority file.
 */
export function loadDevEnv(dir: string, env: NodeJS.ProcessEnv = process.env): string[] {
  const loaded: string[] = []
  for (const name of DEV_ENV_FILES) {
    const file = join(dir, name)
    if (!existsSync(file)) continue
    const raw = readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
    const parsed = parseEnv(raw)
    for (const [key, value] of Object.entries(parsed)) {
      if (value !== undefined && !(key in env)) env[key] = value
    }
    loaded.push(file)
  }
  return loaded
}

function readValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim()
  return value ? value : undefined
}

function parseBool(raw: string | undefined): boolean | undefined {
  if (!raw) return undefined
  const normalized = raw.toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Applies non-empty `BS_*` development environment variables onto raw settings before Zod parsing.
 * Invalid values are ignored so a typo in `.env` never blocks startup.
 */
export function applyDevEnvSettings(
  base: Record<string, unknown>,
  env: NodeJS.ProcessEnv = process.env
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base }

  for (const [envKey, settingKey] of STRING_SETTINGS) {
    const value = readValue(env, envKey)
    if (value !== undefined) next[settingKey] = value
  }

  const mcVersionRaw = readValue(env, 'BS_MINECRAFT_VERSION')
  if (mcVersionRaw !== undefined) {
    const parsed = MinecraftVersionSchema.safeParse(mcVersionRaw)
    if (parsed.success) {
      next.minecraftVersion = parsed.data
      const jar = readValue(env, 'BS_JAR')
      const pack = readValue(env, 'BS_PACK')
      if (parsed.data !== DEFAULT_MINECRAFT_VERSION && (jar !== undefined || pack !== undefined)) {
        const existingFiles = isRecord(next.minecraftFiles) ? next.minecraftFiles : {}
        const entry = existingFiles[parsed.data]
        const existingVersion: Record<string, unknown> = isRecord(entry) ? entry : {}
        next.minecraftFiles = {
          ...existingFiles,
          [parsed.data]: {
            ...existingVersion,
            ...(jar !== undefined ? { jar } : {}),
            ...(pack !== undefined ? { pack } : {})
          }
        }
      }
    }
  }

  const providerRaw = readValue(env, 'BS_PROVIDER')
  if (providerRaw !== undefined) {
    const parsed = ProviderSchema.safeParse(providerRaw)
    if (parsed.success) next.provider = parsed.data
  }

  const capRaw = readValue(env, 'BS_VARIANT_CAP')
  if (capRaw !== undefined) {
    const parsed = SettingsSchema.shape.variantCap.safeParse(Number(capRaw))
    if (parsed.success) next.variantCap = parsed.data
  }

  const completed = parseBool(readValue(env, 'BS_SETUP_COMPLETED'))
  const stepRaw = readValue(env, 'BS_SETUP_STEP')
  const step =
    stepRaw !== undefined && (SETUP_STEPS as readonly string[]).includes(stepRaw)
      ? stepRaw
      : undefined
  if (completed !== undefined || step !== undefined) {
    const existingSetup = isRecord(next.setup) ? next.setup : { step: 'welcome', completed: false }
    next.setup = {
      ...existingSetup,
      ...(completed !== undefined ? { completed } : {}),
      ...(step !== undefined
        ? { step }
        : completed !== undefined
          ? { step: completed ? 'verify' : 'welcome' }
          : {})
    }
  }

  const themeRaw = readValue(env, 'BS_THEME')
  const theme =
    themeRaw === 'dark' || themeRaw === 'light' || themeRaw === 'system' ? themeRaw : undefined
  const scaleRaw = readValue(env, 'BS_SCALE')
  const scaleNum = scaleRaw !== undefined ? Number(scaleRaw) : NaN
  const scale =
    Number.isFinite(scaleNum) && scaleNum >= UI_SCALES[0] && scaleNum <= UI_SCALES.at(-1)!
      ? scaleNum
      : undefined
  if (theme !== undefined || scale !== undefined) {
    const existingAppearance = isRecord(next.appearance)
      ? next.appearance
      : { theme: 'dark', scale: 1 }
    next.appearance = {
      ...existingAppearance,
      ...(theme !== undefined ? { theme } : {}),
      ...(scale !== undefined ? { scale } : {})
    }
  }

  return next
}
