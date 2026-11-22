import { beforeEach, expect, it, vi } from 'vitest'
import { CAPABILITIES, type AgentMsg, type AgentState, type ThreadEvent } from '@shared/api'

const OFF: AgentState = {
  provider: 'claude',
  capabilities: CAPABILITIES.claude,
  build: null,
  sessionId: null,
  status: 'off',
  mode: 'default',
  model: null,
  effort: null,
  context: null,
  usage: null,
  cost: 0,
  auth: null,
  error: null
}
const state = vi.hoisted(() => ({
  onState: (() => {}) as (e: ThreadEvent<AgentState>) => void,
  onMsg: (() => {}) as (e: ThreadEvent<AgentMsg>) => void,
  api: {
    send: vi.fn(async () => {}),
    history: vi.fn(async () => [] as AgentMsg[]),
    close: vi.fn(async () => {}),
    setMode: vi.fn(async () => {})
  }
}))
vi.mock('@/shared/api/studio', () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
    getQueryData: vi.fn(),
    ensureQueryData: async () => [
      { value: 'fixture-codex', name: 'Fixture Codex', isDefault: true }
    ]
  },
  studio: {
    agent: {
      ...state.api,
      state: async () => ({ primary: OFF, threads: {} }),
      pending: async () => [],
      onState: (cb: typeof state.onState) => {
        state.onState = cb
      },
      onMsg: (cb: typeof state.onMsg) => {
        state.onMsg = cb
      },
      onAsk: () => {}
    }
  }
}))

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  const entries = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key)
  })
  vi.stubGlobal('window', { localStorage })
})

it('starts with the assistant closed when no panel preference is saved', async () => {
  const { useAgentPrefs } = await import('./agent')
  expect(useAgentPrefs.getState().open).toBe(false)
})

it('preserves an existing open panel preference', async () => {
  localStorage.setItem('agent-prefs', JSON.stringify({ state: { open: true }, version: 0 }))
  const { useAgentPrefs } = await import('./agent')
  expect(useAgentPrefs.getState().open).toBe(true)
})

it('gives stable reads while no thread is active', async () => {
  // a new value per read makes useThread's subscribers re-render forever (React #185)
  const { activeThread, useAgent } = await import('./agent')
  const s = useAgent.getState()
  expect(activeThread(s)).toBe(activeThread(s))
  expect(activeThread(s).build).toBe('')
})

it('clears threads on provider switch, restores provider model preferences and sends native references', async () => {
  const { useAgent, useAgentPrefs, send, openSession, follow, startMode } = await import('./agent')
  await Promise.resolve()
  follow('tower')
  const old = useAgent.getState().active
  state.onMsg({ thread: old, data: { type: 'user', id: 'u', text: 'Claude history' } })
  useAgentPrefs.setState({ model: 'opus', effort: 'high' })
  const codex: AgentState = {
    ...OFF,
    provider: 'codex',
    capabilities: CAPABILITIES.codex,
    cost: null
  }
  state.onState({ thread: null, data: codex })
  const { active, threads } = useAgent.getState()
  expect(active).not.toBe(old)
  expect(Object.values(threads)).toMatchObject([{ build: 'tower', session: null, items: [] }])
  expect(useAgentPrefs.getState()).toMatchObject({ model: null, effort: null })
  const ref = { provider: 'codex' as const, id: '019abcde-1234-7000-8000-000000000001' }
  await openSession(ref)
  expect(state.api.history).toHaveBeenCalledWith(ref)
  await send('hello', { attachments: ['builds/tower/attachments/a.png'] })
  const thread = useAgent.getState().active
  expect(state.api.send).toHaveBeenCalledWith(
    thread,
    expect.objectContaining({
      provider: 'codex',
      build: 'tower',
      resume: ref,
      mode: 'auto',
      model: 'fixture-codex',
      effort: 'medium'
    })
  )
  // a remembered mode the provider lacks starts threads in Manual
  useAgentPrefs.setState({ mode: 'acceptEdits' })
  expect(startMode(codex)).toBe('default')
  useAgentPrefs.setState({ mode: 'auto' })
  expect(useAgent.getState().threads[thread].items.at(-1)).toMatchObject({
    kind: 'user',
    attachments: ['builds/tower/attachments/a.png']
  })
  useAgentPrefs.setState({ model: 'fixture-codex' })
  state.onState({
    thread: null,
    data: { ...codex, provider: 'claude', capabilities: CAPABILITIES.claude }
  })
  expect(useAgentPrefs.getState()).toMatchObject({ model: 'opus', effort: 'high' })
  expect(Object.values(useAgent.getState().threads)).toMatchObject([{ items: [] }])
})

it('resolves provider defaults without overwriting saved choices', async () => {
  const { resolveAgentPrefs } = await import('./agent')
  const empty = { model: null, effort: null }
  const saved = { model: 'opus', effort: 'high' } as const
  const first = { value: 'first', name: 'First' }
  const preferred = { value: 'preferred', name: 'Preferred', isDefault: true }
  expect(resolveAgentPrefs('claude', empty)).toMatchObject({ model: 'sonnet', effort: 'medium' })
  expect(resolveAgentPrefs('claude', saved)).toMatchObject(saved)
  expect(resolveAgentPrefs('codex', empty, [first, preferred])).toMatchObject({
    model: 'preferred',
    effort: 'medium'
  })
  expect(resolveAgentPrefs('codex', empty, [first])).toMatchObject({
    model: 'first',
    effort: 'medium'
  })
  expect(
    resolveAgentPrefs('codex', empty, [
      { ...first, efforts: ['low', 'high'], defaultEffort: 'high' }
    ])
  ).toMatchObject({ model: 'first', effort: 'high' })
  expect(resolveAgentPrefs('ollama', saved, [first])).toMatchObject({
    model: 'first',
    effort: null
  })
})

it('keeps threads running while the panel follows other builds', async () => {
  const { useAgent, follow, send, setMode, closeThread } = await import('./agent')
  await Promise.resolve()
  follow('tower')
  const tower = useAgent.getState().active
  await send('build it')
  state.onState({
    thread: tower,
    data: { ...OFF, build: 'tower', sessionId: 's1', status: 'running' }
  })
  follow('bridge')
  const bridge = useAgent.getState().active
  expect(bridge).not.toBe(tower)
  follow('castle') // the untouched bridge thread goes
  expect(Object.values(useAgent.getState().threads).map((t) => t.build)).toEqual([
    'tower',
    'castle'
  ])
  follow('tower')
  expect(useAgent.getState().active).toBe(tower)
  expect(useAgent.getState().threads[tower].session).toBe('s1')
  await setMode('plan')
  expect(state.api.setMode).toHaveBeenCalledWith(tower, 'plan')
  await closeThread(tower)
  expect(state.api.close).toHaveBeenCalledWith(tower)
  expect(useAgent.getState().threads[tower]).toBeUndefined()
  expect(useAgent.getState().threads[useAgent.getState().active].build).toBe('tower')
})
