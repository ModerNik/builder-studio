import { join } from 'path'
import { z } from 'zod'
import { EFFORTS, MODES, PermitSchema, SessionRefSchema, ThreadSendSchema } from '@shared/api'
import { buildDir } from '../workspace/projects'
import { resolved } from '../app/settings'
import { addAttachment } from '../workspace/refs'
import type { IpcContext } from '../index'
import type { Handle } from './guard'

/** The embedded assistant: threads, sessions, rewind, login and attachments. */
export function registerAgent(ctx: IpcContext, handle: Handle): void {
  const { apiKey, agent, variants, availability, idle } = ctx
  const none = z.undefined()
  const thread = z.uuid()
  handle('agent:send', ThreadSendSchema, (a) => agent.send(a.thread, a.send))
  handle('agent:diagnose', none, async () => {
    availability.invalidateAi()
    return agent.diagnose()
  })
  handle('agent:login', none, async () => {
    try {
      await agent.login()
    } finally {
      availability.invalidateAi()
    }
  })
  handle('agent:cancelLogin', none, () => agent.cancelLogin())
  handle('agent:hasApiKey', none, () => apiKey.has())
  // an empty key removes it; the key itself never travels back to the renderer
  handle('agent:setApiKey', z.string().max(1000), (key) => {
    apiKey.set(key)
    availability.invalidateAi()
  })
  handle('agent:interrupt', thread, (t) => agent.interrupt(t))
  handle('agent:close', thread, (t) => agent.close(t))
  handle(
    'agent:configure',
    z.object({ thread, model: z.string().nullable(), effort: z.enum(EFFORTS).nullable() }),
    (a) => agent.configure(a.thread, a.model, a.effort)
  )
  handle('agent:setMode', z.object({ thread, mode: z.enum(MODES) }), (a) =>
    agent.setMode(a.thread, a.mode)
  )
  handle('agent:state', none, () => agent.state())
  handle('agent:pending', none, () => agent.pending())
  handle('agent:permit', z.object({ thread, permit: PermitSchema }), (a) =>
    agent.permit(a.thread, a.permit)
  )
  handle('agent:sessions', z.string(), (build) => agent.sessions(build))
  handle('agent:history', SessionRefSchema, (ref) => agent.history(ref))
  handle(
    'agent:fork',
    z.object({
      ref: SessionRefSchema,
      build: z.string().min(1),
      point: z.string().min(1).optional()
    }),
    (a) => agent.fork(a.ref, a.build, a.point)
  )
  const rewindPoint = z.object({
    ref: SessionRefSchema,
    build: z.string().min(1),
    point: z.string().min(1)
  })
  handle('agent:rewindPoints', SessionRefSchema, (ref) => agent.rewindPoints(ref))
  handle('agent:rewindPreview', rewindPoint, (a) => agent.rewindPreview(a.ref, a.build, a.point))
  handle(
    'agent:rewind',
    rewindPoint.extend({ files: z.array(z.string()).max(2000).nullable() }),
    (a) =>
      agent.rewind(a.ref, a.build, a.point, a.files, () => {
        idle(a.build)
        if (
          Object.values(variants.state()).some(
            (v) => v.build === a.build && (v.status === 'running' || v.status === 'starting')
          )
        )
          throw new Error('Wait for variants on this build to finish.')
      })
  )
  handle('agent:rename', z.object({ ref: SessionRefSchema, title: z.string().min(1) }), (a) =>
    agent.rename(a.ref, a.title)
  )
  handle('agent:remove', SessionRefSchema, (ref) => agent.remove(ref))
  handle('agent:models', none, () => agent.models())
  handle('agent:commands', thread.nullable(), (t) => agent.commands(t))
  handle('agent:mcp', thread.nullable(), (t) => agent.mcp(t))
  handle(
    'agent:mcpToggle',
    z.object({ thread, name: z.string().min(1), enabled: z.boolean() }),
    (a) => agent.mcpToggle(a.thread, a.name, a.enabled)
  )
  handle(
    'agent:attach',
    z.object({ build: z.string(), name: z.string().min(1), data: z.instanceof(Uint8Array) }),
    (a) => {
      const dir = join(buildDir(resolved().workspace, a.build), 'attachments')
      return `builds/${a.build}/attachments/${addAttachment(dir, a.name, a.data)}`
    }
  )
}
