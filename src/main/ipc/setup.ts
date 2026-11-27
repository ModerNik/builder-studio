import { app, dialog, shell } from 'electron'
import { join } from 'path'
import { z } from 'zod'
import {
  AppStateSchema,
  SettingsSchema,
  MinecraftVersionSchema,
  SetupProgressSchema,
  type Settings
} from '@shared/api'
import { checkPaths, getSettings, resolved, setSettings } from '../app/settings'
import { detected, minecraftInstallations } from '../runtime/detect'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { fileRevision } from '../app/locations'
import { checkForUpdate, installUpdate, updateState } from '../app/updater'
import { browserCheck, command, diagnose, engineCheck, installedGit } from '../runtime/runtime'
import { bootstrapWorkspace, validateWorkspace } from '../workspace/workspace'
import { prepareFolders, prepareTools } from '../runtime/setup'
import type { IpcContext } from '../index'
import type { Handle } from './guard'
import { perfEnabled, perfSample } from '../app/perf'

/** First-run setup, the managed runtime, settings, updates and Minecraft game files. */
export function registerSetup(ctx: IpcContext, handle: Handle): void {
  const {
    state,
    broadcast,
    servicesIdle,
    workspaceOperation,
    source,
    runtime,
    protectedPaths,
    diagnosticEnv,
    availability,
    saveSettings
  } = ctx
  const none = z.undefined()
  handle('window:state', none, () => ({ maximized: !!state.win?.isMaximized() }))
  handle('window:minimize', none, () => void state.win?.minimize())
  handle('window:toggleMaximize', none, () => {
    if (!state.win) return
    if (state.win.isMaximized()) state.win.unmaximize()
    else state.win.maximize()
  })
  handle('window:close', none, () => void state.win?.close())
  if (perfEnabled) handle('perf:sample', none, perfSample)
  handle('setup:suggestion', none, () => join(app.getPath('userData'), 'workspace'))
  handle('runtime:delivery', none, () => source.delivery())
  handle('setup:prepare', none, () => {
    if (state.preparing) return state.preparing
    servicesIdle()
    if (runtime.state.busy) throw new Error('Wait for runtime installation to finish')
    state.preparation = new AbortController()
    const signal = state.preparation.signal
    state.preparing = (async () => {
      try {
        await workspaceOperation(() => prepareFolders(resolved(), app.getPath('userData')))
        await prepareTools(
          async (tool) => {
            const s = resolved()
            if (tool === 'engine') await engineCheck(s, diagnosticEnv(s), signal)
            else if (tool === 'browser') await browserCheck(s, signal, false, diagnosticEnv(s))
            else {
              const git = installedGit(s.git)
              if (!git) throw new Error('Git is not installed')
              await command(git, ['--version'], { signal, timeout: 10000 })
            }
          },
          (tool) => runtime.install(tool),
          () => workspaceOperation(() => bootstrapWorkspace(resolved().workspace, resolved().git)),
          signal
        )
      } finally {
        state.preparing = undefined
        state.preparation = undefined
        availability.invalidate(true, true)
        broadcast('runtime:state', runtime.state)
      }
    })()
    broadcast('runtime:state', { busy: true, stage: 'checking build tools' })
    return state.preparing
  })
  handle('availability:get', z.boolean().default(false), (refresh) => availability.get(refresh))
  handle('setup:progress', SetupProgressSchema, (setup) =>
    workspaceOperation(async () => {
      if (setup.step === 'runtime' || setup.step === 'ai' || setup.completed)
        await prepareFolders(resolved(), app.getPath('userData'))
      if (setup.step === 'ai') {
        availability.invalidate(false, true)
        await availability.require('export')
      }
      if (setup.completed) {
        availability.invalidate(false, true)
        await availability.require('newBuild', 'export', 'commit')
        await browserCheck(resolved())
      }
      return setSettings({
        ...getSettings(),
        workspace: getSettings().workspace || resolved().workspace,
        setup
      })
    })
  )
  handle('setup:pickFile', z.string(), async (defaultPath) => {
    const result = await dialog.showOpenDialog(state.win!, {
      title: 'Select a file',
      defaultPath: defaultPath || undefined,
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })
  handle('runtime:state', none, () => ({
    ...runtime.state,
    busy: runtime.state.busy || !!state.preparing
  }))
  handle('runtime:diagnose', none, () => diagnose(resolved(), diagnosticEnv(resolved())))
  handle('runtime:install', z.enum(['engine', 'browser', 'git', 'rollback']), (action) => {
    if (state.preparing) throw new Error('Wait for setup preparation to finish, or cancel it')
    return runtime.install(action)
  })
  handle('runtime:cancel', none, () => {
    state.preparation?.abort()
    runtime.cancel()
  })
  handle(
    'runtime:identity',
    z.object({
      name: z.string().trim().min(1).max(200),
      email: z.string().trim().email().max(254)
    }),
    ({ name, email }) =>
      workspaceOperation(async () => {
        const s = resolved()
        if (!s.workspace) throw new Error('Select a workspace first')
        const git = installedGit(s.git)
        if (!git) throw new Error('Install Git first')
        await bootstrapWorkspace(s.workspace, s.git)
        // An explicit edit changes the workspace identity, never the global configuration.
        for (const [key, value] of [
          ['user.name', name],
          ['user.email', email]
        ]) {
          await command(git, ['config', '--local', key, value], { cwd: s.workspace })
        }
        availability.invalidate(true, true)
      })
  )
  handle('settings:get', none, () => getSettings())
  // A cleared number field reaches main as NaN; reject it in words rather than as a schema dump.
  handle('settings:set', SettingsSchema.extend({ variantCap: z.unknown() }), (input) => {
    const cap = SettingsSchema.shape.variantCap.safeParse(input.variantCap)
    if (!cap.success) throw new Error('Parallel variants must be a whole number from 2 to 6.')
    const s: Settings = { ...input, variantCap: cap.data }
    if (s.setup.completed && !getSettings().setup.completed)
      throw new Error('Finish the Ready step so all required setup checks run')
    const old = resolved()
    const next = resolved(s)
    if (
      next.workspace &&
      ((['workspace', 'resources', 'runtime', 'runtimeHome', 'cache'] as const).some(
        (key) => old[key] !== next[key]
      ) ||
        (s.setup.completed && !getSettings().setup.completed))
    )
      return workspaceOperation(async () => {
        await validateWorkspace(resolved(s).workspace, protectedPaths(resolved(s)), true)
        // Tool preparation initializes history after Git becomes available.
        if (installedGit(resolved(s).git) && resolved(s).workspace !== resolved().workspace) {
          try {
            await bootstrapWorkspace(resolved(s).workspace, resolved(s).git)
          } catch (e) {
            if (s.setup.completed) throw e
          }
        }
        return saveSettings(s, true)
      })
    if (s.setup.completed && !next.workspace)
      throw new Error('Choose a writable workspace before completing setup')
    return saveSettings(s)
  })
  handle('minecraft:installations', none, () => minecraftInstallations(app.getPath('appData')))
  handle('minecraft:pack', MinecraftVersionSchema.optional(), async (version) => {
    if (runtime.state.busy) throw new Error('Wait for runtime installation to finish')
    const s = resolved(getSettings(), version)
    await availability.requireFor(s, 'viewer')
    return {
      url: `mcpack://pack/${s.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION}.zip?v=${fileRevision(s.pack)}`
    }
  })
  handle('settings:checkPaths', none, () => checkPaths())
  handle('settings:detected', none, () => detected(getSettings(), resolved, app.getPath('appData')))
  handle('updater:get', none, () => ({ version: app.getVersion(), state: updateState() }))
  handle('updater:check', none, () => checkForUpdate())
  handle('updater:install', none, () => installUpdate())
  handle('updater:notices', none, async () => {
    // written by npm run licences; packaged builds carry it beside app.asar
    const file = app.isPackaged
      ? join(process.resourcesPath, 'THIRD_PARTY_NOTICES.txt')
      : join(app.getAppPath(), 'out', 'THIRD_PARTY_NOTICES.txt')
    const error = await shell.openPath(file)
    if (error) throw new Error(`${error} (${file}; run npm run licences in development)`)
  })
  handle('app:report', AppStateSchema, (s) => void (state.appState = s))
}
