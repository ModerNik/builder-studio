import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, expect, it, vi } from 'vitest'
import { SettingsSchema, type AgentState, type ThreadEvent } from '@shared/api'
import type { AgentDeps } from './agent'

vi.mock('../app/settings', () => ({ pythonEnv: () => ({}) }))
// a thread's service: send makes it live and running; tests set it idle by hand
const fake = vi.hoisted(() => ({
  made: [] as { state: { status: string; sessionId: string | null } }[]
}))
vi.mock('./agent', () => ({
  NO_KEY: 'Claude needs your own Anthropic API key.',
  AgentService: class {
    state = { status: 'off', sessionId: null as string | null }
    constructor(private d: { emit(ch: string, p: unknown): void }) {
      fake.made.push(this)
    }
    async send(a: { resume: { id: string } | null }): Promise<void> {
      this.state = { status: 'running', sessionId: a.resume?.id ?? crypto.randomUUID() }
      this.d.emit('agent:state', this.state)
    }
    close(): void {
      this.state = { status: 'off', sessionId: null }
      this.d.emit('agent:state', this.state)
    }
    pending(): unknown[] {
      return []
    }
  }
}))

let root = ''
afterEach(() => rmSync(root, { recursive: true, force: true }))

it('reports Claude available only with an API key, never a login', async () => {
  root = mkdtempSync(join(tmpdir(), 'studio claude key '))
  const claude = join(root, 'claude.exe')
  const gitBash = join(root, 'bash.exe')
  writeFileSync(claude, '')
  writeFileSync(gitBash, '')
  const s = SettingsSchema.parse({
    workspace: root,
    python: '',
    pack: '',
    jar: '',
    schematics: '',
    claude,
    gitBash
  })
  const { ProviderAgent } = await import('./provider-agent')
  let key: string | null = null
  const agent = new ProviderAgent(
    { settings: () => s, emit: () => {}, apiKey: () => key } as unknown as AgentDeps,
    root,
    async () => {}
  )
  expect((await agent.diagnose('claude'))[0]).toMatchObject({
    ok: false,
    detail: expect.stringContaining('Anthropic API key')
  })
  key = 'sk-ant-api03-fixture'
  expect((await agent.diagnose('claude'))[0].ok).toBe(true)
  expect(() => agent.login()).toThrow(/API key/)
})

const S1 = '00000000-0000-4000-8000-000000000001'
type Emitted = { channel: string; payload: ThreadEvent<AgentState> }
const pool = async (): Promise<{
  agent: import('./provider-agent').ProviderAgent
  emitted: Emitted[]
  send(thread: string, resume?: string): Promise<void>
}> => {
  root = mkdtempSync(join(tmpdir(), 'studio pool '))
  const s = SettingsSchema.parse({
    workspace: root,
    python: '',
    pack: '',
    jar: '',
    schematics: '',
    claude: ''
  })
  const emitted: Emitted[] = []
  const { ProviderAgent } = await import('./provider-agent')
  const agent = new ProviderAgent(
    {
      settings: () => s,
      emit: (channel, payload) => void emitted.push({ channel, payload } as Emitted)
    } as Partial<AgentDeps> as AgentDeps,
    root,
    async () => {}
  )
  const send = (thread: string, resume?: string): Promise<void> =>
    agent.send(thread, {
      provider: 'claude',
      build: 'tower',
      text: 'go',
      resume: resume ? { provider: 'claude', id: resume } : null,
      model: null,
      effort: null
    })
  return { agent, emitted, send }
}

it('keeps at most four live threads, closing the oldest idle one', async () => {
  const { agent, emitted, send } = await pool()
  for (const t of ['t1', 't2', 't3', 't4']) await send(t)
  expect(emitted.at(-1)).toMatchObject({
    channel: 'agent:state',
    payload: { thread: 't4', data: { status: 'running' } }
  })
  expect(agent.busy()).toBe(true)
  await expect(send('t5')).rejects.toThrow(/4 agent threads are working/)
  const threads = agent.state().threads
  const service = (t: string): { state: { status: string } } =>
    fake.made.find((m) => m.state === threads[t])!
  service('t3').state.status = 'idle'
  service('t2').state.status = 'idle'
  await send('t5')
  // t2 was sent to before t3, so it goes; its session stays resumable in the store
  expect(Object.keys(agent.state().threads)).toEqual(['t1', 't3', 't4', 't5'])
  expect(emitted).toContainEqual({
    channel: 'agent:state',
    payload: { thread: 't2', data: expect.objectContaining({ status: 'off' }) }
  })
  agent.select()
  expect(agent.state().threads).toEqual({})
  expect(agent.busy()).toBe(false)
  expect(emitted.at(-1)?.payload.thread).toBeNull()
})

it('opens a stored session in one thread only', async () => {
  const { agent, send } = await pool()
  await send('t1', S1)
  await expect(send('t2', S1)).rejects.toThrow(/already open in another thread/)
  await expect(agent.remove({ provider: 'claude', id: S1 })).rejects.toThrow(/Close the thread/)
  await send('t1', S1)
  agent.close('t1')
  await send('t2', S1)
  expect(Object.keys(agent.state().threads)).toEqual(['t2'])
})
