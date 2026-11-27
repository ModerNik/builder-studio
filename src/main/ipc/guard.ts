import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import { BridgeCallSchema, JobSpecSchema, type Feature, type Channel } from '@shared/api'
import { getSettings, projectSettings, resolved } from '../app/settings'
import { jobFeature } from '@shared/availability'
import type { IpcContext } from '../index'

const OPERATION_FEATURES: Partial<Record<Channel, Feature>> = {
  'agent:send': 'ai',
  'agent:fork': 'ai',
  'agent:rewind': 'ai',
  'agent:attach': 'browse',
  'variants:start': 'variants',
  'variants:send': 'variants',
  'builds:create': 'newBuild',
  'builds:upgrade': 'engine',
  'schematic:choose': 'engine',
  'schematic:inspect': 'engine',
  'schematic:commit': 'engine',
  'ship:commit': 'commit',
  'ship:finalize': 'export',
  'ship:reveal': 'browse',
  'builds:list': 'browse',
  'builds:deleteVersion': 'browse',
  'builds:rename': 'browse',
  'builds:archive': 'browse',
  'builds:outSize': 'browse',
  'review:list': 'browse',
  'review:save': 'browse',
  'design:read': 'browse',
  'design:write': 'browse',
  'ship:results': 'browse',
  'refs:list': 'browse',
  'refs:add': 'browse',
  'refs:note': 'browse',
  'refs:remove': 'browse',
  'blocks:list': 'browse',
  'edits:read': 'browse',
  'edits:save': 'browse',
  'render:saveBuildPreview': 'browse'
}
const RUNTIME_EXCLUSIVE_CHANNELS = new Set<Channel>([
  'settings:set',
  'jobs:run',
  'bridge:call',
  'agent:send',
  'agent:rewind',
  'agent:login',
  'variants:start',
  'variants:send',
  'ship:commit',
  'runtime:diagnose',
  'runtime:identity',
  'setup:progress',
  'workspace:preview',
  'workspace:import',
  'workspace:recover',
  'workspace:bootstrap',
  'builds:create',
  'builds:upgrade',
  'minecraft:pack',
  'schematic:choose',
  'schematic:inspect',
  'schematic:commit'
])

export type Handle = <S extends z.ZodTypeAny>(
  channel: Channel,
  schema: S,
  fn: (arg: z.infer<S>) => unknown
) => void

/** ipcMain.handle with the input checked by zod and the sender checked to be our window. */
export function createHandle(ctx: IpcContext): Handle {
  const { state, servicesIdle, workspaceReady, runtime, availability } = ctx
  return function handle(channel, schema, fn) {
    ipcMain.handle(channel, async (e: IpcMainInvokeEvent, arg: unknown) => {
      if (!state.win || e.sender !== state.win.webContents) throw new Error('unknown sender')
      if ((runtime.state.busy || state.preparing) && RUNTIME_EXCLUSIVE_CHANNELS.has(channel))
        throw new Error('Wait for runtime installation to finish, or cancel it first')
      if (
        state.workspaceBusy &&
        ![
          'window:state',
          'window:minimize',
          'window:toggleMaximize',
          'window:close',
          'workspace:state',
          'workspace:cancel',
          'workspace:open',
          'settings:get',
          'settings:detected',
          'runtime:state',
          'runtime:cancel',
          'setup:prepare',
          'app:report',
          'agent:state',
          'agent:pending',
          'agent:commands',
          'agent:mcp',
          'jobs:list',
          'variants:state',
          'variants:pending',
          'review:pending',
          'updater:get',
          'bridge:log',
          'perf:sample'
        ].includes(channel)
      )
        throw new Error('Wait for the workspace operation to finish, or cancel the import')
      const parsed = schema.parse(arg)
      if (channel === 'builds:create') servicesIdle()
      let feature = OPERATION_FEATURES[channel]
      const jobSpec = channel === 'jobs:run' ? JobSpecSchema.parse(parsed) : null
      if (jobSpec) feature = jobFeature(jobSpec)
      const bridgeSpec = channel === 'bridge:call' ? BridgeCallSchema.parse(parsed) : null
      if (bridgeSpec)
        feature = ['render', 'compare'].includes(bridgeSpec.method) ? 'render' : 'engine'
      if (channel === 'ship:finalize' && (parsed as { targetDir?: string }).targetDir)
        feature = 'browse'
      if (feature) {
        const scoped =
          jobSpec && feature === 'render'
            ? projectSettings(jobSpec.build)
            : bridgeSpec?.minecraftVersion
              ? resolved(getSettings(), bridgeSpec.minecraftVersion)
              : undefined
        await availability.requireFor(
          scoped,
          feature,
          ...(jobSpec?.part === 'full' && !jobSpec.ship ? ['export' as const] : [])
        )
        workspaceReady()
        if ((runtime.state.busy || state.preparing) && RUNTIME_EXCLUSIVE_CHANNELS.has(channel))
          throw new Error('Wait for runtime installation to finish')
      }
      return fn(parsed)
    })
  }
}
