import { app, BrowserWindow, dialog, nativeTheme, net, safeStorage, shell } from 'electron'
import { delimiter, join, relative, resolve } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { type Settings, type AppState, type JobUpdate, UI_SCALES } from '@shared/api'
import { PythonBridge } from './engine/bridge'
import { JobService } from './engine/jobs'
import { buildDir, draftMinecraftVersion, listBuilds, ProjectService } from './workspace/projects'
import { handleProtocols, registerSchemes } from './app/protocols'
import { existsSync, constants } from 'fs'
import { access, readFile, stat } from 'fs/promises'
import { appendGist, ReviewQueue, writeAtomic } from './workspace/review'
import { getSettings, projectSettings, pythonEnv, resolved, setSettings } from './app/settings'
import { startMcp, type McpDeps } from './agent/mcp'
import { agentResources } from './agent/agent-resources'
import { VariantService } from './agent/variants'
import { startUpdater } from './app/updater'
import { ProviderAgent } from './agent/provider-agent'
import { ApiKeyStore } from './agent/api-key'
import { toolPath, under } from './workspace/paths'
import {
  browserCheck,
  command,
  engineCheck,
  installedGit,
  packCheck,
  packagedSource,
  RuntimeService
} from './runtime/runtime'
import { validateWorkspace } from './workspace/workspace'
import { ImportService } from './workspace/imports'
import { SchematicImports } from './workspace/schematic-import'
import { AvailabilityService } from './runtime/availability'
import { protectedStorage } from './runtime/setup'
import { createHandle } from './ipc/guard'
import { registerSetup } from './ipc/setup'
import { registerWorkspace } from './ipc/workspace'
import { registerReview } from './ipc/review'
import { registerAgent } from './ipc/agent'
import { registerVariants } from './ipc/variants'
import { registerRefs } from './ipc/refs'
import { registerEditor } from './ipc/editor'

registerSchemes()

// BS_USER_DATA=out/test-profile runs on a throwaway profile (settings, runtime, cache) instead of the real one;
// set before anything below reads userData
if (process.env['BS_USER_DATA']) app.setPath('userData', resolve(process.env['BS_USER_DATA']))

/** What changes while the app runs; the IPC handlers in ./ipc read and write it through the context. */
const state = {
  win: null as BrowserWindow | null,
  appState: null as AppState | null,
  workspaceBusy: false,
  preparing: undefined as Promise<void> | undefined,
  preparation: undefined as AbortController | undefined
}
const broadcast = (channel: string, payload?: unknown): void =>
  state.win?.webContents.send(channel, payload)

const jobs = new JobService((u: JobUpdate) => broadcast('jobs:update', u))
const bridge = new PythonBridge()
const partsBridge = new PythonBridge(true)
const versionBridges = new Map<string, PythonBridge>()

function bridgeFor(method: string, version?: string): PythonBridge {
  const parts = ['parts', 'part_file', 'part_colors'].includes(method)
  if (!version) return parts ? partsBridge : bridge
  const key = `${version}:${parts}`
  const existing = versionBridges.get(key)
  if (existing) {
    versionBridges.delete(key)
    versionBridges.set(key, existing)
    return existing
  }
  for (const [id, worker] of versionBridges) {
    if (versionBridges.size < 4) break
    if (!worker.busy) {
      worker.dispose()
      versionBridges.delete(id)
    }
  }
  if (versionBridges.size >= 4) throw new Error('Wait for a Minecraft version worker to finish')
  const worker = new PythonBridge(parts, () => resolved(getSettings(), version))
  versionBridges.set(key, worker)
  return worker
}
const disposeBridges = (): void => {
  bridge.dispose()
  partsBridge.dispose()
  for (const worker of versionBridges.values()) worker.dispose()
  versionBridges.clear()
}
const projects = new ProjectService(() => broadcast('builds:changed'))
const reviews = new ReviewQueue(
  (req) => {
    broadcast('review:request', req)
    if (state.win?.isMinimized()) state.win.restore()
    state.win?.focus()
  },
  (id) => broadcast('review:closed', id)
)

const front = (): void => {
  if (state.win?.isMinimized()) state.win.restore()
  state.win?.focus()
}
/** What the agent tools act on: the companion MCP server and the embedded agent share these. */
const toolDeps: McpDeps = {
  show: async (path, build) => {
    workspaceReady()
    await availability.requireFor(
      resolved(getSettings(), draftMinecraftVersion(resolved().workspace, path)),
      'viewer'
    )
    workspaceReady()
    toolPath(resolved().workspace, path)
    broadcast('app:show', { path, build })
    front()
  },
  sheet: async (path, build) => {
    workspaceReady()
    await availability.require('browse')
    workspaceReady()
    toolPath(resolved().workspace, path)
    if (!under(resolved().workspace, path) || !existsSync(under(resolved().workspace, path)!))
      throw new Error(`no such file: ${path}`)
    broadcast('app:sheet', { path, build })
    front()
  },
  status: () => ({
    open: state.appState,
    jobs: jobs
      .list()
      .filter((j) => j.state === 'running')
      .map((j) => ({ id: j.id, build: j.spec.build, part: j.spec.part, stage: j.stage })),
    reviews: reviews.list()
  }),
  versions: async (build) => {
    workspaceReady()
    await availability.require('browse')
    workspaceReady()
    const b = (await listBuilds(resolved().workspace)).find((b) => b.name === build)
    if (!b) throw new Error(`no build ${build}`)
    return b.versions.map((v) => {
      toolPath(resolved().workspace, v.path)
      return v.path
    })
  },
  ask: (req, signal) => {
    workspaceReady()
    return availability.require('viewer').then(() => {
      workspaceReady()
      return reviews.ask(req, signal)
    })
  },
  logRound: async (build, markdown) => {
    workspaceReady()
    await availability.require('browse')
    workspaceReady()
    const file = join(buildDir(resolved().workspace, build), 'DESIGN.md')
    toolPath(resolved().workspace, `builds/${build}/DESIGN.md`)
    const md = await readFile(file, 'utf8').catch(() => `# ${build}\n`)
    writeAtomic(file, appendGist(md, markdown))
  }
}
// the user's Anthropic API key: encrypted, apart from settings.json, never sent to the renderer
const apiKey = new ApiKeyStore(join(app.getPath('userData'), 'anthropic-key.bin'), safeStorage)
const agentDeps = {
  settings: () => resolved(),
  projectSettings,
  apiKey: () => apiKey.get(),
  addRule: (build: string, rule: string) => {
    const s = getSettings()
    const rules = s.agentAllow[build] ?? []
    if (!rules.includes(rule))
      setSettings({ ...s, agentAllow: { ...s.agentAllow, [build]: [...rules, rule] } })
  },
  tools: toolDeps
}
let authState = ''
const agent = new ProviderAgent(
  {
    ...agentDeps,
    emit: (channel, payload) => {
      broadcast(channel, payload)
      const { thread, data } = payload as { thread: string | null; data: unknown }
      if (channel === 'agent:state' && thread === null) {
        const state = data as { provider: string; auth: string | null; error: string | null }
        const next = JSON.stringify([state.provider, state.auth, state.error])
        if (authState !== next) {
          authState = next
          availability.invalidate()
        }
      }
    }
  },
  join(app.getPath('userData'), 'providers'),
  (url) => shell.openExternal(url)
)
const variants = new VariantService(
  (lane, emit) => agent.lane(lane, emit),
  () => agent.selected,
  broadcast,
  () => getSettings().variantCap
)

const servicesIdle = (action = 'changing locations'): void => {
  workspaceReady()
  if (
    jobs.list().some((j) => j.state === 'running') ||
    agent.busy() ||
    Object.values(variants.state()).some((a) => a.status !== 'off') ||
    reviews.list().length
  )
    throw new Error(`Close agent and variant sessions and finish jobs/reviews before ${action}`)
}
const workspaceReady = (): void => {
  if (state.workspaceBusy)
    throw new Error('Wait for the workspace operation to finish, or cancel the import')
}
const imports = new ImportService(
  (destination) => protectedStorage(resolved(), app.getPath('userData'), destination),
  (s) => broadcast('workspace:state', s)
)
const schematicImports = new SchematicImports({
  settings: resolved,
  env: pythonEnv,
  target: (build, version) => (build ? projectSettings(build) : resolved(getSettings(), version)),
  chooseFile: async () => {
    if (!state.win) return null
    const result = await dialog.showOpenDialog(state.win, {
      title: 'Choose a schematic',
      properties: ['openFile'],
      filters: [
        { name: 'Minecraft schematics', extensions: ['litematic', 'schem', 'nbt', 'schematic'] }
      ]
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  }
})
const workspaceOperation = async <T>(fn: () => Promise<T>, closeAgents = true): Promise<T> => {
  servicesIdle(closeAgents ? undefined : 'importing a schematic')
  if (runtime.state.busy) throw new Error('Wait for runtime installation to finish')
  if (closeAgents) agent.closeAll() // idle threads end; their sessions stay resumable
  state.workspaceBusy = true
  try {
    await projects.dispose()
    disposeBridges()
    return await fn()
  } finally {
    try {
      await projects.watch(resolved().workspace)
    } finally {
      state.workspaceBusy = false
      broadcast('builds:changed')
    }
  }
}
const source = packagedSource(
  app.isPackaged
    ? join(process.resourcesPath, 'runtime-delivery')
    : join(app.getAppPath(), 'out/runtime/delivery'),
  app.getVersion(),
  (url, options) => net.fetch(url, options)
)
const runtime = new RuntimeService({
  settings: () => resolved(),
  save: (s) => {
    const before = resolved()
    const next = { ...getSettings() }
    // Keep automatic folder and launcher detection automatic after installing tools.
    for (const key of ['runtime', 'python', 'previousRuntime', 'git', 'browser'] as const)
      if (s[key] !== before[key]) next[key] = s[key]
    setSettings(next)
    disposeBridges()
    agent.select()
    availability.invalidate(true, true)
  },
  idle: servicesIdle,
  home: () => join(app.getPath('userData'), 'runtime'),
  extractScript: app.isPackaged
    ? join(process.resourcesPath, 'runtime/extract.ps1')
    : join(app.getAppPath(), 'runtime/extract.ps1'),
  appVersion: app.getVersion(),
  ...source,
  emit: (s) => {
    broadcast('runtime:state', { ...s, busy: s.busy || !!state.preparing })
    if (!s.busy) availability.invalidate(true, true)
  }
})

const protectedPaths = (s: Settings): string[] => protectedStorage(s, app.getPath('userData'))
const diagnosticEnv = (s: Settings): NodeJS.ProcessEnv => {
  const env = pythonEnv(s)
  return {
    ...env,
    PYTHONPATH: env.PYTHONPATH?.split(delimiter)
      .filter((p) => p !== s.workspace)
      .join(delimiter)
  }
}
const availability = new AvailabilityService({
  settings: () => resolved(),
  changed: () => broadcast('availability:changed'),
  probe: async (requirement, s) => {
    switch (requirement) {
      case 'workspace':
        return validateWorkspace(s.workspace, protectedPaths(s))
      case 'engine':
        return engineCheck(s, diagnosticEnv(s))
      case 'browser':
        return browserCheck(s, undefined, false, diagnosticEnv(s))
      case 'pack':
        return packCheck(s, diagnosticEnv(s))
      case 'export':
        if (!s.schematics) throw new Error('Choose a schematics export folder')
        if (!(await stat(s.schematics)).isDirectory())
          throw new Error('Export destination must be a folder')
        await access(s.schematics, constants.W_OK)
        return s.schematics
      case 'ai': {
        const [check] = await agent.diagnose(s.provider)
        if (!check.ok) throw new Error(check.detail)
        return check.detail
      }
      case 'git': {
        const git = installedGit(s.git)
        if (!git) throw new Error('Install portable Git in Runtime settings')
        return command(git, ['--version'], { timeout: 10000 })
      }
      case 'identity': {
        const git = installedGit(s.git)
        if (!git || !s.workspace) throw new Error('Select a workspace and install Git')
        const root = await command(git, ['rev-parse', '--show-toplevel'], {
          cwd: s.workspace,
          timeout: 10000
        })
        if (relative(s.workspace, root))
          throw new Error(
            'Initialize workspace Git in Settings before committing; a parent repository cannot own this workspace'
          )
        const name = await command(git, ['config', 'user.name'], {
          cwd: s.workspace,
          timeout: 10000
        })
        const email = await command(git, ['config', 'user.email'], {
          cwd: s.workspace,
          timeout: 10000
        })
        if (!name || !email) throw new Error('Save workspace commit identity in Runtime settings')
        return `${name} <${email}>`
      }
    }
  }
})

const saveSettings = (s: Settings, checked = false): Settings => {
  const old = resolved()
  const next = resolved(s)
  const changed =
    (
      [
        'workspace',
        'resources',
        'runtime',
        'runtimeHome',
        'browser',
        'git',
        'cache',
        'assets',
        'python',
        'pack',
        'jar',
        'schematics',
        'saves',
        'claude'
      ] as const
    ).some((key) => old[key] !== next[key]) ||
    old.minecraftVersion !== next.minecraftVersion ||
    JSON.stringify(old.minecraftFiles) !== JSON.stringify(next.minecraftFiles)
  if (changed && !checked) servicesIdle()
  const providerChanged = (
    ['provider', 'codex', 'gitBash', 'ollamaEndpoint', 'ollamaModel'] as const
  ).some((key) => old[key] !== next[key])
  if (
    providerChanged &&
    (agent.busy() ||
      Object.values(variants.state()).some((a) => a.status !== 'off') ||
      reviews.list().length)
  )
    throw new Error(
      'Stop the agent, close variants and finish reviews/login before changing providers.'
    )
  // the Always rules change while the form is open: the form never owns them
  const saved = setSettings({
    ...s,
    agentAllow: old.workspace === next.workspace ? getSettings().agentAllow : {}
  })
  applyTheme()
  availability.invalidate(true, true)
  const now = resolved()
  if (providerChanged || changed) agent.select()
  if (changed) disposeBridges()
  if (old.workspace !== now.workspace) {
    agent.closeAll()
    variants.reset()
    jobs.clear()
    state.appState = null
    if (!state.workspaceBusy) void projects.watch(now.workspace)
    broadcast('builds:changed')
  }
  return saved
}

const trash = (p: string): Promise<void> => shell.trashItem(p)
const idle = (build: string): void => {
  if (jobs.list().some((j) => j.state === 'running' && j.spec.build === build))
    throw new Error(`a job is running on ${build}`)
}

/** Everything the IPC handlers in ./ipc share: the live state, the services and the helpers that tie them. */
const ctx = {
  state,
  broadcast,
  jobs,
  bridge,
  partsBridge,
  versionBridges,
  bridgeFor,
  projects,
  reviews,
  apiKey,
  agent,
  variants,
  servicesIdle,
  workspaceReady,
  imports,
  schematicImports,
  workspaceOperation,
  source,
  runtime,
  protectedPaths,
  diagnosticEnv,
  availability,
  saveSettings,
  idle,
  trash
}
export type IpcContext = typeof ctx

function registerIpc(): void {
  const handle = createHandle(ctx)
  for (const register of [
    registerSetup,
    registerWorkspace,
    registerReview,
    registerAgent,
    registerVariants,
    registerRefs,
    registerEditor
  ])
    register(ctx, handle)
}

// Window chrome per theme: --surface-bg behind the title bar, --fg window buttons (renderer app/styles/main.css as sRGB)
const CHROME = {
  dark: { color: '#121316', symbolColor: '#ededef', height: 43 },
  light: { color: '#f2f2f3', symbolColor: '#17181b', height: 43 }
}
// the header is 44 CSS px, so the OS button strip follows the UI scale
const chrome = (): (typeof CHROME)['dark'] => {
  const { theme, scale } = getSettings().appearance
  const mode = theme === 'system' ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : theme
  const c = CHROME[mode]
  return { ...c, height: Math.round(c.height * scale) }
}
// themeSource also sets the renderer's prefers-color-scheme, which picks the CSS theme (renderer/public/theme.js)
function applyTheme(): void {
  if (nativeTheme.themeSource !== getSettings().appearance.theme)
    nativeTheme.themeSource = getSettings().appearance.theme
  paintChrome()
  state.win?.webContents.setZoomFactor(getSettings().appearance.scale)
}
// Ctrl - / + / 0 step the saved UI scale; before-input-event so focused editors and the 3D view can't swallow it
function zoomKeys(e: Electron.Event, input: Electron.Input): void {
  if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return
  const now = getSettings().appearance.scale
  const scale = ['=', '+'].includes(input.key)
    ? (UI_SCALES.find((s) => s > now + 0.001) ?? now)
    : ['-', '_'].includes(input.key)
      ? (UI_SCALES.findLast((s) => s < now - 0.001) ?? now)
      : input.key === '0'
        ? 1
        : undefined
  if (scale === undefined) return
  e.preventDefault()
  if (scale === now) return
  const s = getSettings()
  broadcast('settings:changed', setSettings({ ...s, appearance: { ...s.appearance, scale } }))
  applyTheme()
}
function paintChrome(): void {
  if (!state.win) return
  const overlay = chrome()
  state.win.setBackgroundColor(overlay.color)
  if (process.platform !== 'darwin') state.win.setTitleBarOverlay(overlay)
}

function createWindow(): void {
  state.win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 360,
    minHeight: 480,
    show: false,
    backgroundColor: chrome().color,
    autoHideMenuBar: true,
    title: 'Builder Studio',
    // one bar: the Shell header is the title bar, the OS draws the window buttons over it;
    // 43 of the header's 44px so its bottom border runs under the buttons
    titleBarStyle: 'hidden',
    titleBarOverlay: chrome(),
    trafficLightPosition: { x: 14, y: 14 },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      zoomFactor: getSettings().appearance.scale
    }
  })
  state.win.webContents.on('before-input-event', zoomKeys)
  state.win.on('ready-to-show', () => state.win?.show())
  state.win.on('closed', () => (state.win = null))
  state.win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // no remote content in this window, ever
  state.win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(process.env['ELECTRON_RENDERER_URL'] ?? 'file:')) e.preventDefault()
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL'])
    void state.win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else void state.win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('dev.builder-studio')
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))
  handleProtocols()
  registerIpc()
  void projects.watch(resolved().workspace)
  applyTheme()
  nativeTheme.on('updated', paintChrome) // 'system' follows the OS while the app runs
  createWindow()
  const mcp = startMcp(toolDeps, () => agentResources(resolved()).instructions)
  startUpdater((s) => broadcast('updater:state', s))
  app.on('will-quit', () => {
    state.preparation?.abort()
    imports.cancel()
    runtime.cancel()
    mcp.close()
    agent.closeAll()
    variants.closeAll()
  })
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => {
  jobs.dispose()
  disposeBridges()
  void projects.dispose()
  if (process.platform !== 'darwin') app.quit()
})
