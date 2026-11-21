import { join, resolve } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { SettingsSchema, type Settings } from '@shared/api'
import { DEFAULT_PACK, resolveLocations, runtimeEnv } from './locations'

const settings = (): Settings =>
  SettingsSchema.parse({
    workspace: 'workspace проекты',
    python: '',
    pack: '',
    jar: '',
    schematics: '',
    claude: ''
  })
const defaults = {
  resources: resolve('installed ресурсы'),
  runtime: resolve('runtime среда'),
  cache: resolve('cache кэш'),
  claude: 'claude.exe'
}

describe('resolved locations', () => {
  it('uses only the selected release’s overrides and passes the target to Python', () => {
    const s = resolveLocations(
      {
        ...settings(),
        minecraftVersion: '1.12.2',
        jar: 'legacy-26.3.jar',
        pack: 'legacy-26.3.zip',
        minecraftFiles: { '1.12.2': { jar: 'chosen.jar' } }
      },
      defaults
    )
    expect(s.jar).toBe(join(s.workspace, 'chosen.jar'))
    expect(s.pack).toMatch(/vanilla-1\.12\.2-r3-\w+\.zip$/)
    expect(runtimeEnv(s).SCHEMATICA_MC_VERSION).toBe('1.12.2')
  })

  it('resolves a fresh profile and detected Minecraft into the engine environment, preserving overrides', () => {
    const profile = resolve('profile')
    const automatic = {
      ...defaults,
      workspace: join(profile, 'workspace'),
      schematics: join(profile, 'schematics'),
      jar: join(profile, 'minecraft.jar')
    }
    const s = resolveLocations({ ...settings(), workspace: '' }, automatic)
    expect(s.workspace).toBe(automatic.workspace)
    expect(s.assets).toBe(join(s.workspace, 'assets'))
    expect(runtimeEnv(s).MCB_MC_JAR).toBe(automatic.jar)
    expect(runtimeEnv(s).MCB_SCHEMATICS).toBe(automatic.schematics)
    const custom = resolveLocations(
      {
        ...settings(),
        runtimeHome: join(profile, 'tools'),
        jar: 'chosen.jar',
        schematics: 'exports'
      },
      automatic
    )
    expect(custom.runtime).toBe(join(profile, 'tools/current'))
    expect(custom.jar).toBe(join(custom.workspace, 'chosen.jar'))
    expect(custom.schematics).toBe(join(custom.workspace, 'exports'))
  })
  it('separates resources, runtime, cache and workspace without deriving code from user data', () => {
    const s = resolveLocations(settings(), defaults)
    expect(s.workspace).toBe(resolve('workspace проекты'))
    expect(s.resources).toBe(defaults.resources)
    expect(s.python).toBe(join(defaults.runtime, 'python.exe'))
    expect(s.pack).toBe(join(defaults.cache, DEFAULT_PACK))
    expect(s.assets).toBe(join(s.workspace, 'assets'))
    expect(new Set([s.workspace, s.resources, s.runtime, s.cache]).size).toBe(4)
    const env = runtimeEnv(s)
    expect(env.MCB_WORKSPACE).toBe(s.workspace)
    expect(env.MCB_RESOURCES).toBe(s.resources)
    expect(env.MCB_RUNTIME).toBe(s.runtime)
    expect(env.MCB_CACHE).toBe(s.cache)
    expect(env.MCB_ASSETS).toBe(s.assets)
    expect(env.MCB_PYTHON).toBe(s.python)
    expect(env.SCHEMATICA_MINECRAFT_DATA).toBe(
      join(s.resources, '.claude/skills/schematica/minecraft_data')
    )
  })

  it('honors explicit locations and drops inherited checkout paths and machine destinations', () => {
    vi.stubEnv('PYTHONPATH', 'old checkout/lib')
    vi.stubEnv('MCB_SCHEMATICS', 'old finals')
    vi.stubEnv('MCB_MC_JAR', 'old jar')
    try {
      const s = resolveLocations(
        {
          ...settings(),
          resources: resolve('other resources'),
          cache: resolve('other cache'),
          runtime: resolve('other runtime'),
          assets: resolve('external assets'),
          python: 'custom python.exe',
          pack: 'custom pack.zip'
        },
        defaults
      )
      const env = runtimeEnv(s)
      expect(env.PYTHONPATH).toBe(s.workspace)
      expect(env.MCB_SCHEMATICS).toBe('')
      expect(env.MCB_MC_JAR).toBe('')
      expect(s.python).toBe('custom python.exe')
      expect(env.MCB_PACK).toBe(join(s.workspace, 'custom pack.zip'))
      expect(s.assets).toBe(resolve('external assets'))
      vi.stubEnv('SCHEMATICA_MINECRAFT_DATA', resolve('custom block data'))
      expect(runtimeEnv(s).SCHEMATICA_MINECRAFT_DATA).toBe(resolve('custom block data'))
      expect(
        runtimeEnv({ ...s, python: join(s.runtime, 'python.exe') }).SCHEMATICA_MINECRAFT_DATA
      ).toBe(join(s.resources, '.claude/skills/schematica/minecraft_data'))
      expect(env.PYTHONUTF8).toBe('1')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
