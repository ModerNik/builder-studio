import { app, dialog, shell } from 'electron'
import { join } from 'path'
import { z } from 'zod'
import {
  BridgeCallSchema,
  JobSpecSchema,
  NewBuildNameSchema,
  MinecraftVersionSchema,
  SchematicChooseSchema,
  SchematicCommitSchema,
  SchematicInspectSchema,
  SiteSaveMetaSchema,
  ImportRequestSchema
} from '@shared/api'
import {
  archiveBuild,
  buildDir,
  deleteVersion,
  draftMinecraftVersion,
  listBuilds,
  outSize,
  projectMinecraftVersion,
  renameBuild
} from '../workspace/projects'
import { writeAtomic } from '../workspace/review'
import { getSettings, projectSettings, pythonEnv, resolved } from '../app/settings'
import { MINECRAFT_VERSIONS } from '@shared/minecraft'
import { listWorlds, savesDirs } from '../workspace/site'
import { inspectWorld } from '../world/world-reader'
import { readSiteMeta, saveSiteMeta, updateBuildOrigin } from '../world/site-meta'
import { command, installedGit } from '../runtime/runtime'
import { bootstrapWorkspace, createBuild, noLinks } from '../workspace/workspace'
import { hasSchematicParts, requireSchematicEngine } from '../workspace/schematic-import'
import type { IpcContext } from '../index'
import type { Handle } from './guard'

/** The workspace folder, builds, schematic imports, build jobs, the engine bridge and world saves. */
export function registerWorkspace(ctx: IpcContext, handle: Handle): void {
  const {
    state,
    broadcast,
    jobs,
    bridge,
    partsBridge,
    versionBridges,
    bridgeFor,
    projects,
    workspaceReady,
    imports,
    schematicImports,
    workspaceOperation,
    availability,
    saveSettings,
    idle,
    trash
  } = ctx
  const none = z.undefined()
  handle('workspace:open', none, async () => {
    const error = await shell.openPath(resolved().workspace)
    if (error) throw new Error(error)
  })
  handle('workspace:pick', z.string(), async (defaultPath) => {
    const result = await dialog.showOpenDialog(state.win!, {
      title: 'Select a folder',
      defaultPath: defaultPath || undefined,
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })
  handle('workspace:state', none, () => imports.state)
  handle('workspace:cancel', none, () => imports.cancel())
  handle('workspace:bootstrap', none, () =>
    workspaceOperation(async () => {
      if (!resolved().workspace) throw new Error('Select and save a workspace first')
      await bootstrapWorkspace(resolved().workspace, resolved().git)
    })
  )
  handle('workspace:preview', ImportRequestSchema, (request) =>
    workspaceOperation(() => imports.preview(request))
  )
  handle('workspace:recover', z.string().min(1), (destination) =>
    workspaceOperation(() => imports.recover(destination))
  )
  handle('workspace:import', z.uuid(), (id) =>
    workspaceOperation(async () => {
      if (!installedGit(resolved().git)) throw new Error('Install Git in Settings before importing')
      const destination = await imports.run(id)
      try {
        await bootstrapWorkspace(destination, resolved().git)
        saveSettings({ ...getSettings(), workspace: destination }, true)
      } catch (e) {
        throw new Error(
          `Files imported to ${destination}, but workspace activation failed. Files are preserved; select that workspace in Settings and retry Git initialization. ${e}`,
          { cause: e }
        )
      }
      return destination
    })
  )
  handle(
    'builds:create',
    z.union([
      NewBuildNameSchema,
      z.object({ name: NewBuildNameSchema, minecraftVersion: MinecraftVersionSchema.optional() })
    ]),
    (input) =>
      workspaceOperation(() => {
        const { name, minecraftVersion } = typeof input === 'string' ? { name: input } : input
        const s = resolved(getSettings(), minecraftVersion)
        return createBuild(s, name, pythonEnv(s))
      })
  )
  handle(
    'builds:upgrade',
    z.object({ name: z.string(), version: MinecraftVersionSchema }),
    ({ name, version }) =>
      workspaceOperation(async () => {
        const { workspace } = resolved()
        const previous = projectMinecraftVersion(workspace, name)
        if (MINECRAFT_VERSIONS.indexOf(version) <= MINECRAFT_VERSIONS.indexOf(previous))
          throw new Error(`Choose a Minecraft version newer than ${previous}`)
        const dir = buildDir(workspace, name)
        const file = join(dir, 'minecraft.json')
        await noLinks(file)
        const s = resolved(getSettings(), version)
        const result = await command(
          s.python,
          [join(dir, 'build.py'), 'check', '--validate-target'],
          {
            cwd: workspace,
            env: pythonEnv(s),
            timeout: 120000
          }
        )
        if (!result.includes('Minecraft target validated'))
          throw new Error(
            'This project needs the standard mcb.cli.run build entry point to upgrade'
          )
        if (projectMinecraftVersion(workspace, name) !== previous)
          throw new Error('The project target changed during validation. Try again.')
        await noLinks(file)
        writeAtomic(file, JSON.stringify({ minecraftVersion: version }) + '\n')
      })
  )
  handle('schematic:choose', SchematicChooseSchema, ({ build, minecraftVersion }) =>
    schematicImports.choose(build, minecraftVersion)
  )
  handle('schematic:inspect', SchematicInspectSchema, (arg) => schematicImports.inspect(arg))
  handle('schematic:commit', SchematicCommitSchema, async (arg) => {
    if (arg.name) await availability.require('newBuild')
    return workspaceOperation(async () => {
      const result = await schematicImports.commit(arg)
      if (result.part)
        jobs.run(
          { build: result.build, part: 'proto', name: result.part, noRender: true },
          projectSettings(result.build)
        )
      return result
    }, false)
  })
  handle('schematic:cancel', z.uuid(), (id) => schematicImports.cancel(id))
  handle('builds:list', none, () => listBuilds(resolved().workspace))
  // the watcher holds handles on Windows, so folder moves pause it
  const moving = async <T>(fn: () => Promise<T>): Promise<T> => {
    await projects.dispose()
    try {
      return await fn()
    } finally {
      void projects.watch(resolved().workspace)
      broadcast('builds:changed')
    }
  }
  handle('builds:deleteVersion', z.string(), (path) => {
    idle(path.split('/').slice(1, -2).join('/'))
    return deleteVersion(resolved().workspace, path, trash)
  })
  handle(
    'builds:rename',
    z.object({ name: z.string(), to: NewBuildNameSchema }),
    async ({ name, to }) => {
      idle(name)
      const renamed = await renameBuild(resolved().workspace, name, to)
      broadcast('builds:changed')
      return renamed
    }
  )
  handle('builds:archive', z.string(), (name) => {
    idle(name)
    return moving(() => archiveBuild(resolved().workspace, name, trash))
  })
  handle('builds:outSize', z.string(), (name) => outSize(resolved().workspace, name))
  handle('jobs:run', JobSpecSchema, async (spec) => {
    const s =
      spec.part === 'dump'
        ? resolved(getSettings(), draftMinecraftVersion(resolved().workspace, spec.path))
        : projectSettings(spec.build)
    if (spec.part !== 'dump') {
      if (await hasSchematicParts(s.workspace, spec.build))
        await requireSchematicEngine(s, pythonEnv(s))
      if (s.workspace !== resolved().workspace || s.python !== resolved().python)
        throw new Error('Settings changed. Start the job again.')
      if (s.minecraftVersion !== projectSettings(spec.build).minecraftVersion)
        throw new Error('The project Minecraft version changed. Start the job again.')
    }
    workspaceReady()
    return jobs.run(spec, s)
  })
  handle('jobs:cancel', z.number().int(), (id) => jobs.cancel(id))
  handle('jobs:list', none, () => jobs.list())
  handle('site:worlds', none, () =>
    listWorlds([
      ...new Set(
        [resolved().saves, ...savesDirs(resolved().schematics, app.getPath('appData'))].filter(
          Boolean
        )
      )
    ])
  )
  handle('site:pick', none, async () => {
    const r = await dialog.showOpenDialog(state.win!, {
      title: 'Choose a Minecraft world save folder',
      defaultPath: savesDirs(resolved().schematics, app.getPath('appData'))[0],
      properties: ['openDirectory']
    })
    return r.canceled ? null : r.filePaths[0]
  })
  handle('site:inspect', z.string().min(1), (worldPath) => inspectWorld(worldPath))
  handle('site:readMeta', z.string().min(1), (build) => readSiteMeta(resolved().workspace, build))
  handle(
    'site:saveMeta',
    SiteSaveMetaSchema,
    async ({ build, placement, updateBuildOrigin: sync }) => {
      const { workspace } = resolved()
      await saveSiteMeta(workspace, build, placement)
      const originUpdated = sync
        ? await updateBuildOrigin(workspace, build, placement.origin)
        : false
      return { originUpdated }
    }
  )
  handle('bridge:call', BridgeCallSchema, ({ method, params, requestId, minecraftVersion }) =>
    bridgeFor(method, minecraftVersion).call(
      method,
      params,
      requestId ? (progress) => broadcast('bridge:progress', { requestId, progress }) : undefined
    )
  )
  handle('bridge:log', none, () => [
    ...bridge.log.slice(-100),
    ...partsBridge.log.slice(-100),
    ...[...versionBridges.values()].flatMap((b) => b.log.slice(-100))
  ])
}
