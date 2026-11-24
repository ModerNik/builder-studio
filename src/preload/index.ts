// Sandboxed preload: the renderer gets window.studio and never ipcRenderer itself.
import { contextBridge, ipcRenderer } from 'electron'
import type { Channel, StudioApi } from '@shared/api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- main's handlers are typed by StudioApi below
const invoke = (channel: Channel, arg?: unknown): Promise<any> => ipcRenderer.invoke(channel, arg)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function on(channel: string, cb: (payload: any) => void): () => void {
  const listener = (_: unknown, payload: unknown): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => void ipcRenderer.removeListener(channel, listener)
}

const studio: StudioApi = {
  setup: {
    prepare: () => invoke('setup:prepare'),
    suggestion: () => invoke('setup:suggestion'),
    progress: (progress) => invoke('setup:progress', progress),
    pickFile: (path) => invoke('setup:pickFile', path)
  },
  availability: {
    get: (refresh = false) => invoke('availability:get', refresh),
    onChanged: (cb) => on('availability:changed', cb)
  },
  workspace: {
    pick: (path) => invoke('workspace:pick', path),
    open: () => invoke('workspace:open'),
    bootstrap: () => invoke('workspace:bootstrap'),
    preview: (request) => invoke('workspace:preview', request),
    import: (id) => invoke('workspace:import', id),
    recover: (destination) => invoke('workspace:recover', destination),
    cancel: () => invoke('workspace:cancel'),
    state: () => invoke('workspace:state'),
    onState: (cb) => on('workspace:state', cb)
  },
  runtime: {
    delivery: () => invoke('runtime:delivery'),
    state: () => invoke('runtime:state'),
    diagnose: () => invoke('runtime:diagnose'),
    install: (action) => invoke('runtime:install', action),
    cancel: () => invoke('runtime:cancel'),
    identity: (name, email) => invoke('runtime:identity', { name, email }),
    onState: (cb) => on('runtime:state', cb)
  },
  settings: {
    get: () => invoke('settings:get'),
    set: (s) => invoke('settings:set', s),
    checkPaths: () => invoke('settings:checkPaths'),
    detected: () => invoke('settings:detected'),
    onChanged: (cb) => on('settings:changed', cb)
  },
  builds: {
    create: (name, minecraftVersion) => invoke('builds:create', { name, minecraftVersion }),
    upgrade: (name, version) => invoke('builds:upgrade', { name, version }),
    list: () => invoke('builds:list'),
    onChanged: (cb) => on('builds:changed', cb),
    deleteVersion: (path) => invoke('builds:deleteVersion', path),
    rename: (name, to) => invoke('builds:rename', { name, to }),
    archive: (name) => invoke('builds:archive', name),
    outSize: (name) => invoke('builds:outSize', name)
  },
  minecraft: {
    installations: () => invoke('minecraft:installations'),
    pack: (version) => invoke('minecraft:pack', version)
  },
  schematic: {
    choose: (build, minecraftVersion) => invoke('schematic:choose', { build, minecraftVersion }),
    inspect: (id, position) => invoke('schematic:inspect', { id, position }),
    commit: (input) => invoke('schematic:commit', input),
    cancel: (id) => invoke('schematic:cancel', id)
  },
  jobs: {
    run: (spec) => invoke('jobs:run', spec),
    cancel: (id) => invoke('jobs:cancel', id),
    list: () => invoke('jobs:list'),
    onUpdate: (cb) => on('jobs:update', cb)
  },
  review: {
    list: (build) => invoke('review:list', build),
    save: (round, requestId) => invoke('review:save', { round, requestId }),
    cancel: (id) => invoke('review:cancel', id),
    pending: () => invoke('review:pending'),
    onRequest: (cb) => on('review:request', cb),
    onClosed: (cb) => on('review:closed', cb)
  },
  design: {
    read: (build) => invoke('design:read', build),
    write: (build, base, md) => invoke('design:write', { build, base, md })
  },
  ship: {
    finalize: (job, dry) => invoke('ship:finalize', { job, dry }),
    results: (build, title, rows) => invoke('ship:results', { build, title, rows }),
    commit: (build, message, dry) => invoke('ship:commit', { build, message, dry })
  },
  app: {
    report: (s) => void invoke('app:report', s),
    onShow: (cb) => on('app:show', cb),
    onSheet: (cb) => on('app:sheet', cb)
  },
  updater: {
    get: () => invoke('updater:get'),
    check: () => invoke('updater:check'),
    install: () => invoke('updater:install'),
    notices: () => invoke('updater:notices'),
    onState: (cb) => on('updater:state', cb)
  },
  agent: {
    diagnose: () => invoke('agent:diagnose'),
    login: () => invoke('agent:login'),
    cancelLogin: () => invoke('agent:cancelLogin'),
    hasApiKey: () => invoke('agent:hasApiKey'),
    setApiKey: (key) => invoke('agent:setApiKey', key),
    send: (thread, send) => invoke('agent:send', { thread, send }),
    interrupt: (thread) => invoke('agent:interrupt', thread),
    close: (thread) => invoke('agent:close', thread),
    configure: (thread, model, effort) => invoke('agent:configure', { thread, model, effort }),
    setMode: (thread, mode) => invoke('agent:setMode', { thread, mode }),
    state: () => invoke('agent:state'),
    pending: () => invoke('agent:pending'),
    permit: (thread, permit) => invoke('agent:permit', { thread, permit }),
    sessions: (build) => invoke('agent:sessions', build),
    history: (id) => invoke('agent:history', id),
    fork: (ref, build) => invoke('agent:fork', { ref, build }),
    rewindPoints: (ref) => invoke('agent:rewindPoints', ref),
    rewindPreview: (ref, build, point) => invoke('agent:rewindPreview', { ref, build, point }),
    rewind: (ref, build, point, files) => invoke('agent:rewind', { ref, build, point, files }),
    rename: (ref, title) => invoke('agent:rename', { ref, title }),
    remove: (ref) => invoke('agent:remove', ref),
    models: () => invoke('agent:models'),
    commands: (thread) => invoke('agent:commands', thread),
    mcp: (thread) => invoke('agent:mcp', thread),
    mcpToggle: (thread, name, enabled) => invoke('agent:mcpToggle', { thread, name, enabled }),
    attach: (build, name, data) => invoke('agent:attach', { build, name, data }),
    onMsg: (cb) => on('agent:msg', cb),
    onState: (cb) => on('agent:state', cb),
    onAsk: (cb) => on('agent:ask', cb)
  },
  variants: {
    start: (v) => invoke('variants:start', v),
    send: (lane, text) => invoke('variants:send', { lane, text }),
    interrupt: (lane) => invoke('variants:interrupt', lane),
    close: () => invoke('variants:close'),
    state: () => invoke('variants:state'),
    pending: () => invoke('variants:pending'),
    permit: (lane, permit) => invoke('variants:permit', { lane, permit }),
    onMsg: (cb) => on('variant:msg', cb),
    onState: (cb) => on('variant:state', cb),
    onAsk: (cb) => on('variant:ask', cb)
  },
  refs: {
    list: (build) => invoke('refs:list', build),
    add: (build, ref) => invoke('refs:add', { build, ref }),
    note: (build, id, note) => invoke('refs:note', { build, id, note }),
    remove: (build, id) => invoke('refs:remove', { build, id })
  },
  blocks: {
    list: (minecraftVersion) => invoke('blocks:list', minecraftVersion)
  },
  edits: {
    read: (build) => invoke('edits:read', build),
    save: (build, edits) => invoke('edits:save', { build, edits })
  },
  site: {
    worlds: () => invoke('site:worlds'),
    pick: () => invoke('site:pick'),
    inspect: (world) => invoke('site:inspect', world),
    readMeta: (build) => invoke('site:readMeta', build),
    saveMeta: (build, placement, updateBuildOrigin) =>
      invoke('site:saveMeta', { build, placement, updateBuildOrigin })
  },
  bridge: {
    call: async (method, params, onProgress, minecraftVersion) => {
      const requestId = onProgress ? crypto.randomUUID() : undefined
      const off = onProgress
        ? on('bridge:progress', (event) => {
            if (event.requestId === requestId) onProgress(event.progress)
          })
        : undefined
      try {
        return await invoke('bridge:call', {
          method,
          params: params ?? {},
          requestId,
          minecraftVersion
        })
      } finally {
        off?.()
      }
    },
    log: () => invoke('bridge:log')
  }
}

contextBridge.exposeInMainWorld('studio', studio)
