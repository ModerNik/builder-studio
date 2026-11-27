import { afterEach, expect, it, vi, type Mock } from 'vitest'
import { SettingsSchema, type Requirement, type Settings } from '@shared/api'
import { jobFeature } from '@shared/availability'
import { AvailabilityService, type Passes } from './availability'
import { jobArgs } from '../engine/jobs'

vi.mock('../app/settings', () => ({}))
afterEach(() => vi.useRealTimers())
function fixture(): {
  service: AvailabilityService
  probe: Mock<(name: Requirement) => Promise<string>>
  changed: Mock<() => void>
  missing: Set<Requirement>
  update(patch: Partial<Settings>): void
} {
  let settings = SettingsSchema.parse({
    workspace: 'workspace',
    python: '',
    jar: '',
    pack: '',
    schematics: '',
    claude: ''
  })
  const missing = new Set<Requirement>([
    'engine',
    'pack',
    'browser',
    'export',
    'ai',
    'git',
    'identity'
  ])
  const probe = vi.fn(async (name: Requirement) => {
    if (missing.has(name)) throw new Error(`Missing ${name}`)
    return `${name} validated`
  })
  const changed = vi.fn()
  const service = new AvailabilityService({ settings: () => settings, probe, changed })
  return {
    service,
    probe,
    changed,
    missing,
    update: (patch: Partial<typeof settings>) => {
      settings = { ...settings, ...patch }
    }
  }
}

it('allows browsing with every optional dependency absent and returns shared repair actions', async () => {
  const f = fixture()
  await expect(f.service.require('browse')).resolves.toBeUndefined()
  const state = await f.service.get()
  expect(state.features.browse).toEqual({ ok: true, missing: [] })
  expect(state.features.render.missing).toEqual(['engine', 'pack', 'browser'])
  expect(state.requirements.engine.repair).toBe('runtime')
  await expect(f.service.require('render')).rejects.toThrow('Settings → runtime')
})

it('deduplicates checks, expires them, and rechecks repairs and location changes', async () => {
  vi.useFakeTimers()
  const f = fixture()
  await Promise.all([f.service.get(), f.service.get()])
  expect(f.probe).toHaveBeenCalledTimes(8)
  await f.service.get()
  expect(f.probe).toHaveBeenCalledTimes(8)
  vi.advanceTimersByTime(60_001)
  await f.service.get()
  expect(f.probe).toHaveBeenCalledTimes(15) // only the 7 failures; the pass holds
  f.missing.delete('engine')
  expect((await f.service.get(true)).features.engine.ok).toBe(true)
  f.update({ runtime: 'replacement runtime', pack: 'replacement pack' })
  await f.service.get()
  // the AI check is keyed on its own settings only
  expect(f.probe).toHaveBeenCalledTimes(30)
  vi.advanceTimersByTime(15 * 60_000 + 1)
  await f.service.get()
  expect(f.probe).toHaveBeenCalledTimes(38)
  f.service.invalidate()
  expect(f.changed).toHaveBeenCalledOnce()
})

it('keeps a passed AI check across unrelated changes and re-probes on its settings or an explicit check', async () => {
  vi.useFakeTimers()
  const f = fixture()
  f.missing.delete('ai')
  const aiProbes = (): number => f.probe.mock.calls.filter(([name]) => name === 'ai').length
  await f.service.get()
  vi.advanceTimersByTime(10 * 60_000)
  f.update({ runtime: 'replacement runtime' })
  f.service.invalidate(true, true)
  await f.service.get()
  expect(aiProbes()).toBe(1)
  f.update({ claude: 'other claude.exe' })
  await f.service.get()
  expect(aiProbes()).toBe(2)
  await f.service.get(true)
  expect(aiProbes()).toBe(3)
  f.service.invalidate()
  await f.service.get()
  expect(aiProbes()).toBe(4)
  f.missing.add('ai')
  f.service.invalidate()
  await f.service.get()
  vi.advanceTimersByTime(60_001)
  await f.service.get()
  expect(aiProbes()).toBe(6) // a failure is re-checked as often as before
})

it('rejects results from checks that overlap a location change or explicit invalidation', async () => {
  const f = fixture()
  let finish!: () => void
  f.probe.mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        finish = () => resolve('old workspace')
      })
  )
  const pending = f.service.require('browse')
  f.update({ workspace: 'different workspace' })
  finish()
  await expect(pending).rejects.toThrow('Configuration changed')
  f.probe.mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        finish = () => resolve('workspace')
      })
  )
  const again = f.service.require('browse')
  f.service.invalidate()
  finish()
  await expect(again).rejects.toThrow('Configuration changed')
  f.probe.mockImplementation(async (name) => {
    if (name === 'export') f.update({ runtime: 'changed between engine and export checks' })
    return 'validated'
  })
  await expect(f.service.require('engine', 'export')).rejects.toThrow('Configuration changed')
})

it('dispatches no-preview proto to the existing engine flag and requires rendering for other previews', () => {
  const proto = { part: 'proto' as const, build: 'starter', noRender: true }
  expect(jobArgs(proto)).toEqual(['builds/starter/build.py', 'proto', '--no-render'])
  expect(jobFeature(proto)).toBe('proto')
  expect(jobFeature({ ...proto, noRender: false })).toBe('render')
  expect(jobFeature({ build: 'starter', part: 'full' })).toBe('render')
  expect(jobFeature({ build: 'starter', part: 'full', noRender: true })).toBe('engine')
})

it('ignores UI-only settings and reuses a passed slow check once on the next launch', async () => {
  const f = fixture()
  f.missing.delete('engine')
  const engineProbes = (): number => f.probe.mock.calls.filter(([name]) => name === 'engine').length
  await f.service.get()
  f.update({ appearance: { theme: 'light', scale: 1.25 }, variantCap: 5 })
  await f.service.get()
  expect(engineProbes()).toBe(1)

  let disk: Passes = {}
  const store = { read: () => disk, write: (p: Passes) => void (disk = structuredClone(p)) }
  let stamp = 'python 1'
  const launch = (): AvailabilityService =>
    new AvailabilityService({
      settings: () =>
        SettingsSchema.parse({
          workspace: 'w',
          python: '',
          jar: '',
          pack: '',
          schematics: '',
          claude: ''
        }),
      probe: f.probe,
      changed: vi.fn(),
      fingerprint: (r) => (r === 'engine' ? stamp : undefined),
      store
    })
  await launch().get()
  expect(engineProbes()).toBe(2)
  expect(Object.keys(disk)).toEqual(['engine'])
  const second = launch()
  await second.get()
  expect(engineProbes()).toBe(2) // restored from the last launch
  await second.get(true)
  expect(engineProbes()).toBe(3) // an explicit re-check still probes
  stamp = 'python 2'
  await launch().get()
  expect(engineProbes()).toBe(4) // the interpreter changed on disk
  f.missing.add('engine')
  await launch().get(true)
  expect(disk).toEqual({}) // a failure forgets the pass
})

it('sign-in changes re-check only the AI provider', async () => {
  const f = fixture()
  await f.service.get()
  f.probe.mockClear()
  f.service.invalidateAi()
  await f.service.get()
  expect(f.probe.mock.calls.map(([name]) => name)).toEqual(['ai'])
  expect(f.changed).toHaveBeenCalledOnce()
})
