import { beforeEach, expect, it, vi } from 'vitest'
import { SettingsSchema, type Settings, type Requirement } from '@shared/api'
import type { McpDeps } from './agent/mcp'
import { handlers } from './agent/mcp'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { insideRepo } from './agent/permissions'

const state = vi.hoisted(() => ({
  theme: { themeSource: 'system', shouldUseDarkColors: true, on: vi.fn() },
  setTitleBarOverlay: vi.fn(),
  handlers: new Map<string, (event: unknown, arg: unknown) => unknown>(),
  settings: null as Settings | null,
  sender: {},
  jobs: [] as { state: string }[],
  agent: 'off',
  auth: false,
  variants: {} as Record<string, { status: string }>,
  reviews: [] as unknown[],
  runtimeBusy: false,
  gitRoot: '',
  watch: vi.fn(async () => {}),
  dispose: vi.fn(async () => {}),
  bootstrap: vi.fn(async () => {}),
  prepareFolders: vi.fn(async () => {}),
  install: vi.fn(async () => {}),
  runtimeSave: null as ((s: Settings) => void) | null,
  create: vi.fn(async () => 'starter'),
  preview: vi.fn(async () => ({})),
  run: vi.fn(async () => 'D:/new workspace'),
  cancel: vi.fn(),
  recover: vi.fn(async () => {}),
  select: vi.fn(),
  clear: vi.fn(),
  unavailable: new Set<Requirement>(),
  validate: vi.fn<(workspace: string, protectedPaths?: string[]) => Promise<void>>(),
  jobRun: vi.fn(() => 1),
  minecraftVersion: '1.12.2',
  checkOutput: 'Minecraft target validated',
  writeAtomic: vi.fn(),
  bridgeCall: vi.fn(async () => ({})),
  send: vi.fn(async () => {}),
  variantStart: vi.fn(async () => {}),
  tools: null as McpDeps | null
}))
vi.mock('electron', () => ({
  app: {
    whenReady: () => Promise.resolve(),
    on: vi.fn(),
    getPath: () => 'D:/app-data',
    getAppPath: () => process.cwd(),
    getVersion: () => '1.0.3',
    isPackaged: false
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: vi.fn(),
    decryptString: vi.fn()
  },
  BrowserWindow: class {
    webContents = Object.assign(state.sender, {
      send: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      setZoomFactor: vi.fn(),
      on: vi.fn()
    })
    on = vi.fn()
    loadFile = vi.fn()
    isMinimized = (): boolean => false
    focus = vi.fn()
    setBackgroundColor = vi.fn()
    setTitleBarOverlay = state.setTitleBarOverlay
  },
  nativeTheme: state.theme,
  ipcMain: {
    handle: (name: string, handler: (event: unknown, arg: unknown) => unknown) =>
      state.handlers.set(name, handler)
  },
  net: { fetch: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  shell: { openExternal: vi.fn() }
}))
vi.mock('@electron-toolkit/utils', () => ({
  electronApp: { setAppUserModelId: vi.fn() },
  is: { dev: false }
}))
vi.mock('./app/settings', () => ({
  getSettings: () => state.settings,
  resolved: (s = state.settings) => s,
  projectSettings: () => state.settings,
  setSettings: (s: Settings) => (state.settings = s),
  pythonEnv: () => ({ MCB_WORKSPACE: state.settings!.workspace })
}))
vi.mock('./workspace/projects', () => ({
  buildDir: (workspace: string, name: string) => join(workspace, 'builds', name),
  projectMinecraftVersion: () => state.minecraftVersion,
  draftMinecraftVersion: () => '26.3',
  listBuilds: async () => [
    { name: 'starter', versions: [{ path: 'builds/starter/out/draft.litematic' }] }
  ],
  ProjectService: class {
    watch = state.watch
    dispose = state.dispose
  }
}))
vi.mock('./engine/jobs', () => ({
  JobService: class {
    list = (): typeof state.jobs => state.jobs
    clear = state.clear
    run = state.jobRun
  }
}))
vi.mock('./engine/bridge', () => ({
  PythonBridge: class {
    dispose = vi.fn()
    call = state.bridgeCall
  }
}))
vi.mock('./agent/provider-agent', () => ({
  ProviderAgent: class {
    constructor(d: { tools: typeof state.tools }) {
      state.tools = d.tools
    }
    state = (): { primary: { status: string }; threads: object } => ({
      primary: { status: state.agent },
      threads: {}
    })
    get authenticating(): boolean {
      return state.auth
    }
    busy = (): boolean => state.agent === 'running' || state.auth
    select = state.select
    close = vi.fn()
    closeAll = vi.fn()
    send = state.send
    diagnose = async (): Promise<{ ok: boolean; detail: string }[]> => [
      { ok: !state.unavailable.has('ai'), detail: 'provider login needed' }
    ]
  }
}))
vi.mock('./agent/variants', () => ({
  VariantService: class {
    state = (): typeof state.variants => state.variants
    reset = vi.fn()
    start = state.variantStart
  }
}))
vi.mock('./workspace/review', () => ({
  writeAtomic: state.writeAtomic,
  ReviewQueue: class {
    list = (): typeof state.reviews => state.reviews
  }
}))
vi.mock('./app/protocols', () => ({ registerSchemes: vi.fn(), handleProtocols: vi.fn() }))
vi.mock('./agent/mcp', async (original) => ({
  ...(await original<typeof import('./agent/mcp')>()),
  startMcp: () => ({ close: vi.fn() })
}))
vi.mock('./app/updater', () => ({ startUpdater: vi.fn() }))
vi.mock('./runtime/runtime', () => ({
  RuntimeService: class {
    constructor(d: { save: (s: Settings) => void }) {
      state.runtimeSave = d.save
    }
    install = state.install
    cancel = state.cancel
    get state(): { busy: boolean } {
      return { busy: state.runtimeBusy }
    }
  },
  packagedSource: () => ({ delivery: async () => ({ mode: 'bundled' }) }),
  installedGit: () => (state.unavailable.has('git') ? '' : 'git.exe'),
  command: async (_file: string, args: string[]) =>
    args.includes('--validate-target')
      ? state.checkOutput
      : args.includes('--show-toplevel')
        ? state.gitRoot || state.settings!.workspace
        : 'configured',
  engineCheck: async () => {
    if (state.unavailable.has('engine')) throw new Error('Install engine')
  },
  browserCheck: async () => {
    if (state.unavailable.has('browser')) throw new Error('Install Chromium')
  },
  packCheck: async () => {
    if (state.unavailable.has('pack')) throw new Error('Select a texture pack')
  }
}))
vi.mock('./runtime/setup', async (original) => ({
  ...(await original<typeof import('./runtime/setup')>()),
  prepareFolders: state.prepareFolders
}))
vi.mock('./workspace/workspace', () => ({
  noLinks: async () => {},
  bootstrapWorkspace: state.bootstrap,
  createBuild: state.create,
  validateWorkspace: state.validate
}))
vi.mock('./workspace/imports', () => ({
  ImportService: class {
    state = { busy: false, stage: 'idle', copied: 0, total: 0 }
    preview = state.preview
    run = state.run
    cancel = state.cancel
    recover = state.recover
  }
}))

async function invoke(channel: string, arg?: unknown): Promise<unknown> {
  return state.handlers.get(channel)!({ sender: state.sender }, arg)
}
beforeEach(async () => {
  vi.clearAllMocks()
  vi.resetModules()
  state.handlers.clear()
  state.theme.themeSource = 'system'
  state.theme.shouldUseDarkColors = true
  state.settings = SettingsSchema.parse({
    workspace: 'D:/old workspace',
    resources: 'D:/resources',
    runtime: 'D:/runtime',
    runtimeHome: 'D:/runtime-storage',
    cache: 'D:/cache',
    python: 'python.exe',
    pack: '',
    jar: '',
    schematics: '',
    claude: '',
    provider: 'ollama',
    codex: 'codex.exe',
    ollamaModel: 'existing-model',
    agentAllow: { starter: ['Read'] }
  })
  state.jobs = []
  state.agent = 'off'
  state.auth = false
  state.variants = {}
  state.reviews = []
  state.runtimeBusy = false
  state.gitRoot = ''
  state.minecraftVersion = '1.12.2'
  state.checkOutput = 'Minecraft target validated'
  state.unavailable.clear()
  state.validate.mockImplementation(async (workspace, protectedPaths = []) => {
    if (!workspace || state.unavailable.has('workspace'))
      throw new Error('Choose a writable workspace')
    if (protectedPaths.some((p) => p && (insideRepo(p, workspace) || insideRepo(workspace, p))))
      throw new Error('Keep the workspace separate from application resources, runtime and cache')
  })
  state.run.mockResolvedValue('D:/new workspace')
  await import('./index')
  await vi.waitFor(() => expect(state.handlers.has('workspace:import')).toBe(true))
})

it('upgrades only after the generator validates and rejects the same or an older target', async () => {
  await expect(invoke('builds:upgrade', { name: 'starter', version: '1.12.1' })).rejects.toThrow(
    'newer'
  )
  await expect(invoke('builds:upgrade', { name: 'starter', version: '1.12.2' })).rejects.toThrow(
    'newer'
  )
  state.checkOutput = ''
  await expect(invoke('builds:upgrade', { name: 'starter', version: '1.13' })).rejects.toThrow(
    'mcb.cli.run'
  )
  expect(state.writeAtomic).not.toHaveBeenCalled()
  state.checkOutput = 'Minecraft target validated'
  await expect(
    invoke('builds:upgrade', { name: 'starter', version: '1.13' })
  ).resolves.toBeUndefined()
  expect(state.writeAtomic).toHaveBeenCalledWith(
    join(state.settings!.workspace, 'builds', 'starter', 'minecraft.json'),
    '{"minecraftVersion":"1.13"}\n'
  )
})

it.skipIf(process.platform === 'darwin')(
  'paints native caption symbols for explicit themes and live system changes',
  async () => {
    const setTheme = (theme: Settings['appearance']['theme']): Promise<unknown> =>
      invoke('settings:set', {
        ...state.settings,
        appearance: { ...state.settings!.appearance, theme, scale: 1.25 }
      })

    await setTheme('light')
    expect(state.theme.themeSource).toBe('light')
    expect(state.setTitleBarOverlay).toHaveBeenLastCalledWith({
      color: '#f2f2f3',
      symbolColor: '#17181b',
      height: 54
    })

    state.theme.shouldUseDarkColors = false
    await setTheme('dark')
    expect(state.theme.themeSource).toBe('dark')
    expect(state.setTitleBarOverlay).toHaveBeenLastCalledWith({
      color: '#121316',
      symbolColor: '#ededef',
      height: 54
    })

    await setTheme('system')
    expect(state.theme.themeSource).toBe('system')
    expect(state.setTitleBarOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ color: '#f2f2f3' })
    )
    state.theme.shouldUseDarkColors = true
    const updateTheme = state.theme.on.mock.calls.find(([event]) => event === 'updated')![1]
    updateTheme()
    expect(state.setTitleBarOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ color: '#121316' })
    )
  }
)

it('rejects workspace actions during jobs, live sessions, authentication, variants, reviews and runtime installation', async () => {
  const preview = { source: 'D:/source', destination: 'D:/destination', assets: true }
  state.jobs = [{ state: 'running' }]
  await expect(invoke('workspace:preview', preview)).rejects.toThrow('Close agent')
  state.jobs = []
  state.agent = 'running'
  await expect(invoke('builds:create', 'starter')).rejects.toThrow('Close agent')
  state.agent = 'off'
  state.auth = true
  await expect(invoke('workspace:bootstrap')).rejects.toThrow('Close agent')
  state.auth = false
  state.variants = { A: { status: 'idle' } }
  await expect(invoke('workspace:recover', 'D:/destination')).rejects.toThrow('Close agent')
  state.variants = {}
  state.reviews = [{}]
  await expect(invoke('workspace:preview', preview)).rejects.toThrow('Close agent')
  state.reviews = []
  state.runtimeBusy = true
  await expect(invoke('builds:create', 'starter')).rejects.toThrow('runtime installation')
  await expect(invoke('builds:list')).resolves.toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'starter' })])
  )
  expect(state.preview).not.toHaveBeenCalled()
  expect(state.create).not.toHaveBeenCalled()
})

it('guards concurrent IPC and companion requests, permits cancellation, then activates through existing settings lifecycle', async () => {
  let finish!: (destination: string) => void
  state.run.mockReturnValueOnce(
    new Promise((done) => {
      finish = done
    })
  )
  const pending = invoke('workspace:import', '56efb773-4f9a-4af1-aa28-2deacb1e58c6')
  await vi.waitFor(() => expect(state.run).toHaveBeenCalled())
  for (const [channel, arg] of [
    ['jobs:run', {}],
    ['agent:send', {}],
    ['agent:login', undefined],
    ['runtime:install', 'git'],
    ['settings:set', state.settings],
    ['builds:create', 'starter']
  ])
    await expect(invoke(channel as string, arg)).rejects.toThrow('workspace operation')
  expect(() =>
    state.tools!.ask({ build: 'starter', question: '?', variants: [], parts: [] })
  ).toThrow('workspace operation')
  await invoke('workspace:cancel')
  expect(state.cancel).toHaveBeenCalled()
  finish('D:/new workspace')
  await pending
  expect(state.settings).toMatchObject({
    workspace: 'D:/new workspace',
    provider: 'ollama',
    codex: 'codex.exe',
    ollamaModel: 'existing-model',
    agentAllow: {}
  })
  expect(state.bootstrap).toHaveBeenCalledWith('D:/new workspace', '')
  expect(state.watch).toHaveBeenLastCalledWith('D:/new workspace')
  expect(state.select).toHaveBeenCalled()
  expect(state.clear).toHaveBeenCalled()
})

it('keeps settings on import failure and releases the operation lock for retry', async () => {
  state.run.mockRejectedValueOnce(new Error('copy failed'))
  await expect(invoke('workspace:import', '56efb773-4f9a-4af1-aa28-2deacb1e58c6')).rejects.toThrow(
    'copy failed'
  )
  expect(state.settings!.workspace).toBe('D:/old workspace')
  expect(state.bootstrap).not.toHaveBeenCalled()
  expect(state.watch).toHaveBeenLastCalledWith('D:/old workspace')
  await expect(invoke('builds:create', 'starter')).resolves.toBe('starter')
  await expect(invoke('builds:create', 'Castle #2 (v1)')).resolves.toBe('starter')
  expect(state.create).toHaveBeenLastCalledWith(
    expect.anything(),
    'Castle #2 (v1)',
    expect.anything()
  )
  await expect(invoke('builds:create', 'a'.repeat(101))).rejects.toThrow()
  await expect(invoke('builds:create', 'line\nbreak')).rejects.toThrow()
})

it('requires usable tools, permits setup without textures or AI, and reopens without resetting configuration', async () => {
  state.settings!.schematics = process.cwd()
  state.unavailable = new Set(['engine', 'pack', 'browser', 'git', 'ai'])
  const original = { ...state.settings! }
  await invoke('setup:progress', { step: 'minecraft', completed: false })
  expect(state.settings!.setup).toEqual({ step: 'minecraft', completed: false })
  await expect(invoke('setup:progress', { step: 'verify', completed: true })).rejects.toThrow(
    'Install engine'
  )
  expect(state.settings!.setup.completed).toBe(false)
  await expect(invoke('setup:progress', { step: 'ai', completed: false })).resolves.toBeDefined()
  state.unavailable = new Set(['ai', 'pack'])
  await invoke('setup:progress', { step: 'verify', completed: true })
  expect(state.settings!.setup.completed).toBe(true)
  await invoke('setup:progress', { step: 'welcome', completed: false })
  expect(state.settings).toMatchObject({
    ...original,
    setup: { step: 'welcome', completed: false }
  })
  expect(state.run).not.toHaveBeenCalled()
  expect(state.bootstrap).not.toHaveBeenCalled()
  state.unavailable.add('workspace')
  await expect(invoke('setup:progress', { step: 'verify', completed: true })).rejects.toThrow(
    'writable workspace'
  )
  expect(state.settings!.setup.completed).toBe(false)
  state.unavailable.clear()
  state.bootstrap.mockRejectedValueOnce(new Error('Git can be repaired later'))
  await expect(
    invoke('settings:set', { ...state.settings, workspace: 'D:/new workspace' })
  ).resolves.toMatchObject({ workspace: 'D:/new workspace' })
  state.settings!.workspace = ''
  await expect(
    invoke('settings:set', { ...state.settings, setup: { step: 'verify', completed: true } })
  ).rejects.toThrow('Ready step')
})

it('deduplicates automatic preparation, blocks mutations, and releases the lock after cancellation', async () => {
  let finish!: () => void
  state.prepareFolders.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        finish = done
      })
  )
  const first = invoke('setup:prepare')
  const second = invoke('setup:prepare')
  await vi.waitFor(() => expect(state.prepareFolders).toHaveBeenCalledTimes(1))
  await expect(invoke('settings:set', state.settings)).rejects.toThrow('runtime installation')
  await invoke('runtime:cancel')
  finish()
  await expect(first).rejects.toThrow()
  await expect(second).rejects.toThrow()
  expect(state.bootstrap).not.toHaveBeenCalled()
  await expect(invoke('setup:prepare')).resolves.toBeUndefined()
  expect(state.bootstrap).toHaveBeenCalledTimes(1)
})

it('saves installed tools without converting automatic folders and Minecraft detection into overrides', () => {
  const before = { ...state.settings! }
  state.runtimeSave!({
    ...before,
    runtime: 'D:/new-engine',
    python: '',
    assets: 'D:/detected-assets',
    jar: 'D:/detected.jar',
    schematics: 'D:/detected-exports'
  })
  expect(state.settings).toEqual({ ...before, runtime: 'D:/new-engine', python: '' })
})

it.each([NaN, 0, 2.5, 7, '3'])(
  'rejects variantCap %s in plain words without saving',
  async (cap) => {
    const original = state.settings
    await expect(invoke('settings:set', { ...state.settings, variantCap: cap })).rejects.toThrow(
      'Parallel variants must be a whole number from 2 to 6.'
    )
    expect(state.settings).toBe(original)
    await expect(
      invoke('settings:set', { ...state.settings, variantCap: 5 })
    ).resolves.toMatchObject({ variantCap: 5 })
  }
)

it.each(['resources', 'runtime', 'runtimeHome', 'cache'] as const)(
  'rejects moving %s into the current workspace without changing saved settings',
  async (key) => {
    const original = state.settings
    await expect(
      invoke('settings:set', { ...state.settings, [key]: join(state.settings!.workspace, key) })
    ).rejects.toThrow('separate')
    expect(state.settings).toBe(original)
    expect(state.bootstrap).not.toHaveBeenCalled()
  }
)

it('enforces engine, rendering, provider and export prerequisites through IPC', async () => {
  state.unavailable = new Set(['engine', 'pack', 'browser', 'ai'])
  await expect(invoke('jobs:run', { build: 'starter', part: 'check' })).rejects.toThrow(
    'Install engine'
  )
  await expect(invoke('bridge:call', { method: 'lint' })).rejects.toThrow('Install engine')
  await expect(invoke('builds:create', 'starter')).rejects.toThrow('Install engine')
  await expect(
    invoke('agent:send', {
      thread: '56efb773-4f9a-4af1-aa28-2deacb1e58c6',
      send: {
        provider: 'ollama',
        build: 'starter',
        text: 'hello',
        resume: null,
        model: null,
        effort: null
      }
    })
  ).rejects.toThrow('provider login needed')
  await expect(invoke('ship:finalize', { job: 1, dry: false })).rejects.toThrow('export folder')
  expect(state.jobRun).not.toHaveBeenCalled()
  expect(state.bridgeCall).not.toHaveBeenCalled()
  expect(state.send).not.toHaveBeenCalled()
  state.unavailable.delete('engine')
  state.unavailable.delete('ai')
  await invoke('availability:get', true)
  await expect(invoke('jobs:run', { build: 'starter', part: 'proto' })).rejects.toThrow(
    'texture pack'
  )
  await expect(invoke('bridge:call', { method: 'render' })).rejects.toThrow('texture pack')
  await expect(
    invoke('jobs:run', { build: 'starter', part: 'proto', noRender: true })
  ).resolves.toBe(1)
  expect(state.jobRun).toHaveBeenCalledWith(
    expect.objectContaining({ noRender: true }),
    state.settings
  )
  await expect(
    invoke('variants:start', {
      build: 'starter',
      lanes: [{ lane: 'A', text: 'hello' }],
      from: null,
      model: null,
      effort: null
    })
  ).resolves.toBeUndefined()
  expect(state.variantStart).toHaveBeenCalled()
  state.gitRoot = 'D:/parent repository'
  await invoke('availability:get', true)
  await expect(
    invoke('ship:commit', { build: 'starter', message: 'save', dry: false })
  ).rejects.toThrow('parent repository')
})

it('gates companion and application viewer tools while keeping existing sheets available without Python', async () => {
  state.unavailable = new Set(['engine', 'pack', 'browser'])
  const root = mkdtempSync(join(tmpdir(), 'studio companion '))
  try {
    state.settings!.workspace = root
    mkdirSync(join(root, 'builds/starter/out'), { recursive: true })
    writeFileSync(join(root, 'builds/starter/out/sheet.png'), 'existing sheet')
    const h = handlers(state.tools!)
    await expect(h.show({ path: 'builds/starter/out/draft.litematic' })).rejects.toThrow(
      'texture pack'
    )
    await expect(
      h.request_review({ build: 'starter', question: '?', variants: ['draft'] })
    ).rejects.toThrow('texture pack')
    await expect(h.sheet({ path: 'builds/starter/out/sheet.png' })).resolves.toMatchObject({
      content: [{ type: 'text', text: expect.stringContaining('showing') }]
    })
    expect(state.bridgeCall).not.toHaveBeenCalled()
    expect(state.tools!.status()).toMatchObject({ jobs: [], reviews: [] })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
