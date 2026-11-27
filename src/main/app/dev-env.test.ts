import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { SettingsSchema } from '@shared/api'
import { applyDevEnvSettings, loadDevEnv } from './dev-env'

let dir = ''
afterEach(() => {
  if (dir) {
    rmSync(dir, { recursive: true, force: true })
    dir = ''
  }
})

describe('loadDevEnv', () => {
  it('loads .env files in precedence order without overwriting shell variables', () => {
    dir = mkdtempSync(join(tmpdir(), 'studio-dev-env-'))
    writeFileSync(
      join(dir, '.env'),
      '\uFEFFBS_WORKSPACE=D:\\Files\\Games\\Minecraft\\new\\tab\nBS_PROVIDER=claude\nBS_SAVES=D:\\Saves\n'
    )
    writeFileSync(join(dir, '.env.local'), 'BS_PROVIDER=codex\nBS_CACHE=C:\\Cache\\local\n')
    writeFileSync(join(dir, '.env.development'), 'BS_CACHE=C:\\Cache\\dev\n')
    writeFileSync(join(dir, '.env.development.local'), 'BS_SAVES=D:\\Saves\\dev-local\n')

    const env: NodeJS.ProcessEnv = { BS_WORKSPACE: 'D:\\Shell\\Workspace' }
    const loaded = loadDevEnv(dir, env)

    expect(loaded).toHaveLength(4)
    expect(env.BS_WORKSPACE).toBe('D:\\Shell\\Workspace')
    expect(env.BS_PROVIDER).toBe('codex')
    expect(env.BS_CACHE).toBe('C:\\Cache\\dev')
    expect(env.BS_SAVES).toBe('D:\\Saves\\dev-local')
  })

  it('preserves Windows backslashes and ignores missing files', () => {
    dir = mkdtempSync(join(tmpdir(), 'studio-dev-env-win-'))
    writeFileSync(
      join(dir, '.env'),
      "BS_WORKSPACE=D:\\Files\\new\\test\\repo\nBS_PACK='C:\\Users\\name\\packs\\vanilla.zip'\n"
    )

    const env: NodeJS.ProcessEnv = {}
    const loaded = loadDevEnv(dir, env)

    expect(loaded).toEqual([join(dir, '.env')])
    expect(env.BS_WORKSPACE).toBe('D:\\Files\\new\\test\\repo')
    expect(env.BS_PACK).toBe('C:\\Users\\name\\packs\\vanilla.zip')
  })
})

describe('applyDevEnvSettings', () => {
  const base = (): Record<string, unknown> => ({
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
  })

  it('applies all supported setup settings and skips blank values', () => {
    const merged = applyDevEnvSettings(base(), {
      BS_SETUP_COMPLETED: 'true',
      BS_WORKSPACE: 'D:\\Files\\Games\\Minecraft\\builder-studio',
      BS_ASSETS: 'D:\\Files\\Games\\Minecraft\\builder-studio\\assets',
      BS_RESOURCES: 'C:\\Programs\\builder-studio\\resources\\engine',
      BS_RUNTIME_HOME: 'C:\\AppData\\builder-studio\\runtime',
      BS_RUNTIME: 'C:\\AppData\\builder-studio\\runtime\\engine-1',
      BS_PREVIOUS_RUNTIME: 'C:\\AppData\\builder-studio\\runtime\\engine-0',
      BS_CACHE: 'C:\\AppData\\builder-studio\\cache',
      BS_IMPORT_SOURCE: 'D:\\Code\\ai-builder',
      BS_SCHEMATICS: 'D:\\Files\\schematics',
      BS_SAVES: 'D:\\Files\\saves',
      BS_JAR: 'C:\\Modrinth\\1.21.11',
      BS_PACK: 'C:\\AppData\\cache\\packs\\vanilla.zip',
      BS_CLAUDE: 'C:\\Users\\me\\.local\\bin\\claude.exe',
      BS_PROVIDER: 'codex',
      BS_CODEX: '',
      BS_OLLAMA_ENDPOINT: 'http://127.0.0.1:11434',
      BS_OLLAMA_MODEL: 'qwen3:14b',
      BS_VARIANT_CAP: '4',
      BS_THEME: 'light',
      BS_SCALE: '1.25'
    })

    const parsed = SettingsSchema.parse(merged)
    expect(parsed).toMatchObject({
      workspace: 'D:\\Files\\Games\\Minecraft\\builder-studio',
      assets: 'D:\\Files\\Games\\Minecraft\\builder-studio\\assets',
      resources: 'C:\\Programs\\builder-studio\\resources\\engine',
      runtimeHome: 'C:\\AppData\\builder-studio\\runtime',
      runtime: 'C:\\AppData\\builder-studio\\runtime\\engine-1',
      previousRuntime: 'C:\\AppData\\builder-studio\\runtime\\engine-0',
      cache: 'C:\\AppData\\builder-studio\\cache',
      importSource: 'D:\\Code\\ai-builder',
      schematics: 'D:\\Files\\schematics',
      saves: 'D:\\Files\\saves',
      jar: 'C:\\Modrinth\\1.21.11',
      pack: 'C:\\AppData\\cache\\packs\\vanilla.zip',
      claude: 'C:\\Users\\me\\.local\\bin\\claude.exe',
      provider: 'codex',
      codex: '',
      ollamaModel: 'qwen3:14b',
      variantCap: 4,
      setup: { step: 'verify', completed: true },
      appearance: { theme: 'light', scale: 1.25 }
    })
  })

  it('populates minecraftFiles when BS_MINECRAFT_VERSION targets a non-default release', () => {
    const merged = applyDevEnvSettings(base(), {
      BS_MINECRAFT_VERSION: '1.21.11',
      BS_JAR: 'C:\\Modrinth\\1.21.11\\client.jar',
      BS_PACK: 'C:\\Packs\\1.21.11.zip'
    })
    const parsed = SettingsSchema.parse(merged)
    expect(parsed.minecraftVersion).toBe('1.21.11')
    expect(parsed.minecraftFiles).toEqual({
      '1.21.11': {
        jar: 'C:\\Modrinth\\1.21.11\\client.jar',
        pack: 'C:\\Packs\\1.21.11.zip'
      }
    })
  })

  it('ignores invalid enum, boolean and numeric values instead of failing', () => {
    const merged = applyDevEnvSettings(base(), {
      BS_SETUP_COMPLETED: 'maybe',
      BS_SETUP_STEP: 'bogus',
      BS_MINECRAFT_VERSION: 'not-a-version',
      BS_PROVIDER: 'unknown',
      BS_VARIANT_CAP: '99',
      BS_THEME: 'neon',
      BS_SCALE: '9'
    })
    const parsed = SettingsSchema.parse(merged)
    expect(parsed.setup).toEqual({ step: 'welcome', completed: false })
    expect(parsed.minecraftVersion).toBeUndefined()
    expect(parsed.provider).toBe('claude')
    expect(parsed.variantCap).toBe(3)
    expect(parsed.appearance).toEqual({ theme: 'dark', scale: 1 })
  })
})
