import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsSchema, type AgentMsg, type AgentSend, type Settings } from '@shared/api'
import { CodexAgent, type CodexDeps } from './codex-agent'
import type { CodexConnection, RpcMessage } from './codex-rpc'
import { ReviewQueue } from '../workspace/review'
import { reduce, type Item } from '../../renderer/src/features/agent-chat/model/transcript'
import { fixtureResources } from '../testing/test-agent-resources'

vi.mock('../app/settings', () => ({
  pythonEnv: () => ({
    PATH: process.env.PATH,
    OPENAI_API_KEY: 'inherited-key',
    CODEX_HOME: 'global-home'
  })
}))
vi.mock('./provider-config', async (original) => ({
  ...(await original<typeof import('./provider-config')>()),
  providerExecutable: () => 'fixture-codex.exe',
  ollamaModels: async () => ['fixture:latest']
}))

const ID = '019abcde-1234-7000-8000-000000000001'
const ID2 = '019abcde-1234-7000-8000-000000000002'
const VERSION = 'builds/tower/out/a.litematic'
const SHEET = 'builds/tower/out/a_3d/sheet.png'
const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

function setup(
  provider: 'codex' | 'ollama' = 'codex',
  lane: string | null = null
): {
  agent: CodexAgent
  settings: Settings
  deps: CodexDeps
  conn: CodexConnection
  events: { channel: string; payload: unknown }[]
  send: AgentSend
  notify(method: string, params?: Record<string, unknown>, id?: number): void
  complete(): void
  queue: ReviewQueue
  messages(): AgentMsg[]
  failed(e: Error): void
} {
  const root = mkdtempSync(join(tmpdir(), 'studio provider сборка '))
  const settings = SettingsSchema.parse({
    workspace: join(root, 'workspace'),
    cache: join(root, 'cache'),
    resources: fixtureResources(root),
    python: 'python.exe',
    claude: '',
    pack: '',
    jar: '',
    schematics: '',
    provider,
    ollamaModel: 'fixture:latest'
  })
  mkdirSync(settings.workspace)
  const events: { channel: string; payload: unknown }[] = []
  const queue = new ReviewQueue(() => {})
  let receive: (m: RpcMessage) => void = () => {}
  let failed: (e: Error) => void = () => {}
  const conn: CodexConnection = {
    initialized: vi.fn(),
    close: vi.fn(),
    respond: vi.fn(),
    reject: vi.fn(),
    request: vi.fn(async (method: string) => {
      switch (method) {
        case 'thread/start':
        case 'thread/resume':
          return { thread: { id: ID, turns: [] }, model: 'fixture' }
        case 'thread/fork':
          return { thread: { id: ID2, turns: [] }, model: 'fixture' }
        case 'turn/start':
          return { turn: { id: 'turn-1' } }
        case 'account/read':
          return { account: { type: 'chatgpt' } }
        case 'account/login/start':
          return {
            type: 'chatgpt',
            loginId: 'login-1',
            authUrl: 'https://auth.openai.com/authorize?client_id=fixture'
          }
        case 'model/list':
          return {
            data: [
              { model: 'hidden', displayName: 'Hidden', hidden: true, isDefault: true },
              {
                model: 'fixture',
                displayName: 'Fixture',
                hidden: false,
                isDefault: true,
                supportedReasoningEfforts: [
                  { reasoningEffort: 'minimal' },
                  { reasoningEffort: 'medium' },
                  { reasoningEffort: 'high' }
                ],
                defaultReasoningEffort: 'high'
              }
            ]
          }
        case 'skills/list':
          return {
            data: [
              {
                cwd: settings.workspace,
                skills: [
                  { name: 'castle', description: 'Castles', path: 'C:/s/castle', enabled: true },
                  { name: 'off', description: 'Off', path: 'C:/s/off', enabled: false }
                ],
                errors: []
              }
            ]
          }
        case 'mcpServerStatus/list':
          return {
            data: [{ name: 'docs', runtimeStatus: null, pluginId: null, toolsError: 'boom' }],
            nextCursor: null
          }
        case 'thread/turns/list':
          return {
            data: [
              {
                id: 'old-turn',
                status: 'completed',
                items: [
                  { type: 'userMessage', id: 'user', content: [{ type: 'text', text: 'hello' }] },
                  { type: 'agentMessage', id: 'answer', text: 'world' }
                ]
              }
            ],
            nextCursor: null
          }
        default:
          return {}
      }
    }) as CodexConnection['request']
  }
  const deps: CodexDeps = {
    settings: () => settings,
    home: join(root, provider),
    openAuth: vi.fn(async () => {}),
    emit: (channel, payload) => events.push({ channel, payload }),
    addRule: vi.fn(),
    apiKey: () => null,
    tools: {
      show: vi.fn(),
      sheet: vi.fn(),
      status: () => ({ tab: 'workspace' }),
      versions: async () => [VERSION],
      ask: (req, signal) => queue.ask(req, signal),
      logRound: vi.fn(async () => {})
    },
    connect: vi.fn((_file, _args, _options, onMessage, onError) => {
      receive = onMessage
      failed = onError
      return conn
    })
  }
  const agent = new CodexAgent(deps, provider, lane)
  cleanups.push(() => {
    agent.close()
    rmSync(root, { recursive: true, force: true })
  })
  const send: AgentSend = {
    provider,
    build: 'tower',
    text: 'hello',
    resume: null,
    model: null,
    effort: null
  }
  const notify = (method: string, params: Record<string, unknown> = {}, id?: number): void =>
    receive({ method, params: { threadId: ID, turnId: 'turn-1', ...params }, id })
  const messages = (): AgentMsg[] =>
    events.filter((e) => e.channel === 'agent:msg').map((e) => e.payload as AgentMsg)
  const complete = (): void =>
    notify('turn/completed', { turn: { id: 'turn-1', status: 'completed', error: null } })
  return {
    agent,
    settings,
    deps,
    conn,
    events,
    send,
    notify,
    complete,
    queue,
    messages,
    failed: (e: Error) => failed(e)
  }
}

describe('Codex app-server provider', () => {
  it('streams normalized text/tools and usage without inventing a cost', async () => {
    const t = setup()
    await t.agent.send(t.send)
    t.notify('item/agentMessage/delta', { itemId: 'answer', delta: 'hel' })
    t.notify('item/agentMessage/delta', { itemId: 'answer', delta: 'lo' })
    t.notify('item/completed', { item: { type: 'agentMessage', id: 'answer', text: 'hello' } })
    t.notify('item/started', {
      item: {
        type: 'commandExecution',
        id: 'shell-1',
        command: 'python builds/tower/build.py check',
        cwd: t.settings.workspace
      }
    })
    t.notify('item/completed', {
      item: {
        type: 'commandExecution',
        id: 'shell-1',
        command: 'python builds/tower/build.py check',
        aggregatedOutput: '@mcb {"v":1,"event":"done","seconds":1}',
        exitCode: 0,
        status: 'completed'
      }
    })
    t.notify('thread/tokenUsage/updated', {
      tokenUsage: {
        total: { inputTokens: 100, outputTokens: 20 },
        last: { totalTokens: 120 },
        modelContextWindow: 1000
      }
    })
    t.complete()
    const items = t.messages().reduce(reduce, [] as Item[])
    expect(items.filter((i) => i.kind === 'text')).toEqual([
      { kind: 'text', id: 'answer', parent: null, text: 'hello' }
    ])
    expect(items.find((i) => i.id === 'shell-1')).toMatchObject({
      name: 'shell',
      events: [{ event: 'done', seconds: 1 }]
    })
    expect(t.agent.state).toMatchObject({
      status: 'idle',
      cost: null,
      usage: { input: 100, output: 20, cacheRead: null },
      context: { tokens: 120, max: 1000 },
      capabilities: { variants: true, fork: true, mcpToggle: true }
    })
    const start = vi
      .mocked(t.conn.request)
      .mock.calls.find(([m]) => m === 'thread/start')![1] as Record<string, unknown>
    expect(start).toMatchObject({
      approvalPolicy: 'on-request',
      approvalsReviewer: 'user',
      sandbox: 'workspace-write',
      cwd: t.settings.workspace
    })
    expect(String(start.developerInstructions)).toContain(t.settings.resources)
    const turn = vi.mocked(t.conn.request).mock.calls.find(([m]) => m === 'turn/start')![1]
    expect(turn).toMatchObject({
      sandboxPolicy: {
        type: 'workspaceWrite',
        networkAccess: false,
        writableRoots: [t.settings.workspace, t.settings.cache]
      }
    })
  })

  it('keeps credentials/configuration app-owned and resumes only its own native sessions', async () => {
    const t = setup()
    await t.agent.send(t.send)
    const options = vi.mocked(t.deps.connect!).mock.calls[0][2]
    expect(options.env.CODEX_HOME).toBe(t.deps.home)
    expect(options.env.OPENAI_API_KEY).toBeUndefined()
    expect(options.cwd).toBe(t.deps.home)
    t.complete()
    t.agent.close()
    await t.agent.send({ ...t.send, resume: { provider: 'codex', id: ID } })
    expect(t.conn.request).toHaveBeenCalledWith(
      'thread/resume',
      expect.objectContaining({ threadId: ID })
    )
    expect((await t.agent.sessions('tower'))[0]).toMatchObject({ provider: 'codex', id: ID })
    expect(await t.agent.sessions('other')).toEqual([])
    await expect(
      t.agent.send({ ...t.send, resume: { provider: 'claude', id: ID } })
    ).rejects.toThrow('another provider')
    await expect(t.agent.history(ID2)).rejects.toThrow('another provider')
    expect(readFileSync(join(t.deps.home, 'sessions.json'), 'utf8')).not.toContain('inherited-key')
  })

  it('loads stored transcript items and renames native sessions', async () => {
    const t = setup()
    await t.agent.send(t.send)
    t.complete()
    expect(await t.agent.history(ID)).toEqual(
      expect.arrayContaining([
        { type: 'user', id: 'user', text: 'hello', point: 'old-turn' },
        { type: 'text', id: 'answer', parent: null, text: 'world' }
      ])
    )
    await t.agent.rename(ID, 'A new title')
    expect(t.conn.request).toHaveBeenCalledWith('thread/name/set', {
      threadId: ID,
      name: 'A new title'
    })
    expect((await t.agent.sessions('tower'))[0].title).toBe('A new title')
  })

  it('asks once for command/file approvals, denies Always and fails closed on unknown requests', async () => {
    const t = setup()
    await t.agent.send(t.send)
    t.notify(
      'item/commandExecution/requestApproval',
      { command: 'git push', reason: 'network' },
      31
    )
    expect(t.agent.pending()[0]).toMatchObject({
      tool: 'shell',
      rule: null,
      input: { command: 'git push' }
    })
    t.agent.permit({ id: 'codex:31', decision: 'always' })
    await vi.waitFor(() => expect(t.conn.respond).toHaveBeenCalledWith(31, { decision: 'decline' }))
    t.notify('item/fileChange/requestApproval', { reason: 'write' }, 32)
    t.agent.permit({ id: 'codex:32', decision: 'allow' })
    await vi.waitFor(() => expect(t.conn.respond).toHaveBeenCalledWith(32, { decision: 'accept' }))
    t.notify('item/permissions/requestApproval', {}, 33)
    expect(t.conn.reject).toHaveBeenCalledWith(33, expect.stringContaining('Unsupported'))
    expect(t.deps.addRule).not.toHaveBeenCalled()
  })

  it('holds a variant lane to its own files on every approval request', async () => {
    const t = setup('codex', 'A')
    await t.agent.send(t.send)
    expect(t.conn.request).toHaveBeenCalledWith(
      'thread/start',
      expect.objectContaining({
        approvalPolicy: 'untrusted',
        dynamicTools: [expect.objectContaining({ name: 'status' })]
      })
    )
    const edit = (id: string, path: string): void =>
      t.notify('item/started', {
        item: { type: 'fileChange', id, status: 'inProgress', changes: [{ path, kind: 'add' }] }
      })
    edit('own', join(t.settings.workspace, 'builds/tower/house_A.py'))
    t.notify('item/fileChange/requestApproval', { itemId: 'own' }, 61)
    await vi.waitFor(() => expect(t.conn.respond).toHaveBeenCalledWith(61, { decision: 'accept' }))
    edit('other', 'builds/tower/house_B.py')
    t.notify('item/fileChange/requestApproval', { itemId: 'other' }, 62)
    await vi.waitFor(() => expect(t.conn.respond).toHaveBeenCalledWith(62, { decision: 'decline' }))
    t.notify('item/fileChange/requestApproval', { itemId: 'unknown' }, 63)
    await vi.waitFor(() => expect(t.conn.respond).toHaveBeenCalledWith(63, { decision: 'decline' }))
    t.notify('item/commandExecution/requestApproval', { command: 'git commit -am x' }, 64)
    await vi.waitFor(() => expect(t.conn.respond).toHaveBeenCalledWith(64, { decision: 'decline' }))
    expect(t.messages().filter((m) => m.type === 'note' && m.error)).toHaveLength(3)
    // a command the guard allows still asks the user outside Auto
    t.notify('item/commandExecution/requestApproval', { command: 'dir' }, 65)
    expect(t.agent.pending()).toHaveLength(1)
    t.agent.permit({ id: 'codex:65', decision: 'allow' })
    await vi.waitFor(() => expect(t.conn.respond).toHaveBeenCalledWith(65, { decision: 'accept' }))
    // the viewer, the log and Review belong to the Variants screen
    t.notify('item/tool/call', { tool: 'show_in_viewer', arguments: {} }, 66)
    await vi.waitFor(() =>
      expect(t.conn.respond).toHaveBeenCalledWith(66, expect.objectContaining({ success: false }))
    )
  })

  it('lets go of a fork when the forking agent has no session of its own', async () => {
    const t = setup()
    await t.agent.send(t.send)
    t.complete()
    t.agent.close()
    vi.mocked(t.conn.close).mockClear()
    expect(await t.agent.fork(ID, 'tower')).toBe(ID2)
    expect(t.conn.close).toHaveBeenCalled()
  })

  it('forks sessions with thread/fork and switches MCP servers by reopening the thread', async () => {
    const t = setup()
    await t.agent.send(t.send)
    t.complete()
    expect(await t.agent.fork(ID, 'tower#A')).toBe(ID2)
    expect(t.conn.request).toHaveBeenCalledWith('thread/fork', { threadId: ID })
    expect(t.conn.close).not.toHaveBeenCalled() // an agent with its own session keeps its server
    // a lane's fork stays out of the panel's list
    expect((await t.agent.sessions('tower')).map((s) => s.id)).toEqual([ID])
    await t.agent.mcpToggle('docs', false)
    expect(t.conn.close).toHaveBeenCalled()
    expect(t.conn.request).toHaveBeenLastCalledWith(
      'thread/resume',
      expect.objectContaining({ threadId: ID, config: { 'mcp_servers.docs.enabled': false } })
    )
    expect(t.agent.state).toMatchObject({ status: 'idle', sessionId: ID, build: 'tower' })
    expect(await t.agent.mcp()).toContainEqual({
      name: 'docs',
      status: 'disabled',
      scope: 'config',
      error: null
    })
    await t.agent.mcpToggle('docs', true)
    expect(t.conn.request).toHaveBeenLastCalledWith(
      'thread/resume',
      expect.objectContaining({ config: {} })
    )
  })

  it('answers MCP elicitations through the approval card', async () => {
    const t = setup()
    await t.agent.send(t.send)
    const ask = {
      serverName: 'docs',
      turnId: null,
      mode: 'url',
      message: 'Sign in',
      url: 'https://x'
    }
    t.notify('mcpServer/elicitation/request', ask, 34)
    expect(t.agent.pending()[0]).toMatchObject({ tool: 'mcp · docs', input: { url: 'https://x' } })
    t.agent.permit({ id: 'codex:34', decision: 'allow' })
    await vi.waitFor(() =>
      expect(t.conn.respond).toHaveBeenCalledWith(34, {
        action: 'accept',
        content: null,
        _meta: null
      })
    )
    t.notify('mcpServer/elicitation/request', ask, 35)
    t.agent.permit({ id: 'codex:35', decision: 'deny' })
    await vi.waitFor(() =>
      expect(t.conn.respond).toHaveBeenCalledWith(35, {
        action: 'decline',
        content: null,
        _meta: null
      })
    )
  })

  it('sends attachments, $skills and plan mode, then switches the thread back to auto', async () => {
    const t = setup()
    const turns = (): Record<string, unknown>[] =>
      vi
        .mocked(t.conn.request)
        .mock.calls.filter(([m]) => m === 'turn/start')
        .map(([, p]) => p as Record<string, unknown>)
    await expect(t.agent.send({ ...t.send, attachments: ['../outside.png'] })).rejects.toThrow(
      'inside the workspace'
    )
    await t.agent.send({
      ...t.send,
      text: 'Use $castle and $off.',
      mode: 'plan',
      effort: 'high',
      attachments: ['builds/tower/attachments/a.png', 'builds/tower/attachments/notes.txt']
    })
    expect(turns()[0]).toMatchObject({
      input: [
        { type: 'text', text: expect.stringContaining('- builds/tower/attachments/notes.txt') },
        { type: 'localImage', path: join(t.settings.workspace, 'builds/tower/attachments/a.png') },
        { type: 'skill', name: 'castle', path: 'C:/s/castle' }
      ],
      collaborationMode: {
        mode: 'plan',
        settings: { model: 'fixture', reasoning_effort: 'high', developer_instructions: null }
      }
    })
    expect(turns()[0].input).toHaveLength(3)
    expect(t.agent.state.mode).toBe('plan')
    t.notify('item/plan/delta', { itemId: 'plan-1', delta: '1. Walls' })
    expect(t.messages().at(-1)).toMatchObject({ id: 'plan-1', delta: true, plan: true })
    t.complete()
    // Switching mode to Auto before sending (as "Implement plan" and the mode picker do) still
    // sends collaborationMode: default so Codex leaves sticky plan mode.
    await expect(t.agent.setMode('auto')).resolves.toBeUndefined()
    expect(t.agent.state.mode).toBe('auto')
    expect(turns()[0]).toMatchObject({ approvalPolicy: 'never' })
    // plan -> auto: the collaboration mode goes back to default, and Auto never asks
    await t.agent.send({ ...t.send, mode: 'auto' })
    expect(turns()[1]).toMatchObject({
      collaborationMode: { mode: 'default' },
      approvalPolicy: 'never'
    })
    t.complete()
    await t.agent.send(t.send)
    expect(turns()[2]).not.toHaveProperty('collaborationMode')
    expect(turns()[2]).toMatchObject({ approvalPolicy: 'on-request' })
    t.complete()
    // Resuming a session in Auto also sends collaborationMode: default in case it ended in plan mode.
    t.agent.close()
    await t.agent.send({ ...t.send, resume: { provider: 'codex', id: ID }, mode: 'auto' })
    expect(turns()[3]).toMatchObject({
      collaborationMode: { mode: 'default' },
      approvalPolicy: 'never'
    })
    // only the turn with $tokens looks skills up
    expect(vi.mocked(t.conn.request).mock.calls.filter(([m]) => m === 'skills/list')).toHaveLength(
      1
    )
  })

  it('lists skills and MCP servers, archives sessions and passes .mcp.json secrets in env', async () => {
    const t = setup()
    expect(await t.agent.mcp()).toEqual([])
    writeFileSync(
      join(t.settings.workspace, '.mcp.json'),
      JSON.stringify({
        mcpServers: { docs: { url: 'https://mcp.x', headers: { Auth: 'secret' } } }
      })
    )
    await t.agent.send(t.send)
    const [, args, options] = vi.mocked(t.deps.connect!).mock.calls[0]
    expect(args).toContain('mcp_servers.docs.env_http_headers.Auth="MCB_MCP_DOCS_0"')
    expect(args.join(' ')).not.toContain('secret')
    expect(options.env.MCB_MCP_DOCS_0).toBe('secret')
    expect(await t.agent.commands()).toEqual([{ name: 'castle', description: 'Castles', hint: '' }])
    expect(await t.agent.mcp()).toEqual([
      { name: 'docs', status: 'notStarted', scope: 'config', error: 'boom' }
    ])
    expect(t.conn.request).toHaveBeenCalledWith('mcpServerStatus/list', {
      threadId: ID,
      detail: 'toolsAndAuthOnly',
      cursor: null
    })
    t.complete()
    await t.agent.remove(ID)
    expect(t.conn.request).toHaveBeenCalledWith('thread/archive', { threadId: ID })
    expect(await t.agent.sessions('tower')).toEqual([])
    await expect(t.agent.remove(ID)).rejects.toThrow('another provider')
  })

  it('reports a broken .mcp.json without starting its servers', async () => {
    const t = setup()
    writeFileSync(join(t.settings.workspace, '.mcp.json'), '{ nope')
    await t.agent.send(t.send)
    expect(t.messages()).toContainEqual(
      expect.objectContaining({
        type: 'note',
        error: true,
        text: expect.stringContaining('.mcp.json')
      })
    )
    expect(vi.mocked(t.deps.connect!).mock.calls[0][1].join(' ')).not.toContain('mcp_servers')
  })

  it('validates application tools and completes viewer, sheet, review and log round trips', async () => {
    const t = setup()
    await t.agent.send(t.send)
    t.notify('item/tool/call', { tool: 'show_in_viewer', arguments: { path: VERSION } }, 41)
    t.notify('item/tool/call', { tool: 'show_sheet', arguments: { path: SHEET } }, 42)
    t.notify('item/tool/call', { tool: 'show_sheet', arguments: { path: '../secret.png' } }, 43)
    t.notify(
      'item/tool/call',
      { tool: 'show_in_viewer', arguments: { path: VERSION, bypass: true } },
      44
    )
    t.notify('item/tool/call', { tool: 'unknown', arguments: {} }, 45)
    await vi.waitFor(() =>
      expect(t.conn.respond).toHaveBeenCalledWith(41, expect.objectContaining({ success: true }))
    )
    expect(t.deps.tools.show).toHaveBeenCalledWith(VERSION, 'tower')
    expect(t.deps.tools.sheet).toHaveBeenCalledTimes(1)
    for (const id of [43, 44, 45])
      expect(t.conn.respond).toHaveBeenCalledWith(id, expect.objectContaining({ success: false }))
    t.notify(
      'item/tool/call',
      {
        tool: 'request_review',
        arguments: { build: 'tower', question: 'Which?', variants: ['a'] }
      },
      46
    )
    await vi.waitFor(() => expect(t.queue.list()).toHaveLength(1))
    const saved = { path: 'builds/tower/review/round_1.json', round: { pick: 'a' } } as Parameters<
      ReviewQueue['answer']
    >[1]
    t.queue.answer(t.queue.list()[0].id!, saved)
    await vi.waitFor(() =>
      expect(t.conn.respond).toHaveBeenCalledWith(
        46,
        expect.objectContaining({
          success: true,
          contentItems: [{ type: 'inputText', text: JSON.stringify(saved, null, 2) }]
        })
      )
    )
    t.notify(
      'item/tool/call',
      { tool: 'log_round', arguments: { build: 'tower', markdown: '### Round 1\nApproved' } },
      47
    )
    expect(t.deps.tools.logRound).not.toHaveBeenCalled()
    t.agent.permit({ id: 'codex:47', decision: 'allow' })
    await vi.waitFor(() =>
      expect(t.deps.tools.logRound).toHaveBeenCalledWith('tower', '### Round 1\nApproved')
    )
  })

  it('interrupts turns, clears approvals/reviews, and handles a process failure', async () => {
    const t = setup()
    await t.agent.send(t.send)
    t.notify(
      'item/tool/call',
      {
        tool: 'request_review',
        arguments: { build: 'tower', question: 'Which?', variants: ['a'] }
      },
      51
    )
    t.notify('item/commandExecution/requestApproval', { command: 'x' }, 52)
    await vi.waitFor(() => expect(t.queue.list()).toHaveLength(1))
    await t.agent.interrupt()
    expect(t.conn.request).toHaveBeenCalledWith('turn/interrupt', {
      threadId: ID,
      turnId: 'turn-1'
    })
    expect(t.queue.list()).toEqual([])
    expect(t.agent.pending()).toEqual([])
    t.notify('turn/completed', { turn: { id: 'turn-1', status: 'interrupted' } })
    expect(t.agent.state.status).toBe('idle')
    t.failed(new Error('fixture crashed'))
    expect(t.agent.state).toMatchObject({ status: 'off', error: 'fixture crashed' })
  })

  it('handles browser login and cancellation without storing tokens in settings', async () => {
    const t = setup()
    await t.agent.login()
    expect(t.deps.openAuth).toHaveBeenCalledWith(
      expect.stringContaining('https://auth.openai.com/')
    )
    expect(t.agent.authenticating).toBe(true)
    await t.agent.cancelLogin()
    expect(t.conn.request).toHaveBeenCalledWith('account/login/cancel', { loginId: 'login-1' })
    t.notify('account/login/completed', { success: true, loginId: 'login-1' })
    await vi.waitFor(() => expect(t.agent.state.auth).toBe('chatgpt'))
  })

  it('cancels startup without letting a late response revive a closed session', async () => {
    const t = setup()
    let release: (value: unknown) => void = () => {}
    vi.mocked(t.conn.request).mockImplementationOnce(
      () =>
        new Promise<unknown>((resolve) => {
          release = resolve
        }) as Promise<never>
    )
    const sending = t.agent.send(t.send)
    expect(t.agent.state.status).toBe('starting')
    await t.agent.interrupt()
    release({})
    await expect(sending).rejects.toThrow('cancelled')
    expect(t.agent.state).toMatchObject({ status: 'off', sessionId: null })
    expect(t.conn.request).not.toHaveBeenCalledWith('thread/start', expect.anything())
  })

  it('rejects unexpected login URLs and cancels the server login', async () => {
    const t = setup()
    vi.mocked(t.conn.request).mockImplementation(async (method) => {
      if (method === 'account/login/start')
        return { loginId: 'hostile', authUrl: 'https://example.com/steal' } as never
      return {} as never
    })
    await expect(t.agent.login()).rejects.toThrow('unexpected login URL')
    expect(t.deps.openAuth).not.toHaveBeenCalled()
    expect(t.conn.request).toHaveBeenCalledWith('account/login/cancel', { loginId: 'hostile' })
    expect(t.agent.authenticating).toBe(false)
  })

  it('pages native history and ignores tool requests for another thread', async () => {
    const t = setup()
    await t.agent.send(t.send)
    t.complete()
    vi.mocked(t.conn.request)
      .mockResolvedValueOnce({
        data: [{ id: 'first', status: 'completed', items: [] }],
        nextCursor: 'next'
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'second',
            status: 'completed',
            items: [{ type: 'agentMessage', id: 'answer', text: 'last page' }]
          }
        ],
        nextCursor: null
      })
    const history = await t.agent.history(ID)
    expect(history.at(-2)).toMatchObject({ type: 'text', text: 'last page' })
    expect(t.conn.request).toHaveBeenCalledWith(
      'thread/turns/list',
      expect.objectContaining({ cursor: 'next', itemsView: 'full' })
    )
    t.notify(
      'item/tool/call',
      { threadId: ID2, tool: 'show_in_viewer', arguments: { path: VERSION } },
      99
    )
    expect(t.conn.reject).toHaveBeenCalledWith(
      99,
      expect.stringContaining('active Builder Studio turn')
    )
    expect(t.deps.tools.show).not.toHaveBeenCalled()
  })

  it('compacts an existing conversation through the native RPC', async () => {
    const t = setup()
    await t.agent.send(t.send)
    t.complete()
    await t.agent.send({ ...t.send, text: '/compact', resume: { provider: 'codex', id: ID } })
    expect(t.conn.request).toHaveBeenCalledWith('thread/compact/start', { threadId: ID })
    expect(
      vi.mocked(t.conn.request).mock.calls.filter(([method]) => method === 'turn/start')
    ).toHaveLength(1)
    t.complete()
    expect(t.agent.state.status).toBe('idle')
  })

  it('forks history only through the turn before a rewind point', async () => {
    const t = setup()
    await expect(t.agent.send(t.send)).resolves.toBe('turn-1')
    t.complete()
    vi.mocked(t.conn.request).mockResolvedValueOnce({
      data: ['one', 'two'].map((id) => ({
        id,
        status: 'completed',
        items: [{ type: 'userMessage', id: `message:${id}`, content: [{ type: 'text', text: id }] }]
      })),
      nextCursor: null
    })
    await expect(t.agent.rewind(ID, t.send.build, 'two')).resolves.toBe(ID2)
    expect(t.conn.request).toHaveBeenCalledWith('thread/fork', {
      threadId: ID,
      lastTurnId: 'one',
      excludeTurns: true
    })
  })

  it('forks through a target turn inclusive and tags history user messages with turn points', async () => {
    const t = setup()
    await t.agent.send(t.send)
    t.complete()
    const turns = ['one', 'two'].map((id) => ({
      id,
      status: 'completed',
      items: [{ type: 'userMessage', id: `message:${id}`, content: [{ type: 'text', text: id }] }]
    }))
    vi.mocked(t.conn.request).mockResolvedValueOnce({ data: turns, nextCursor: null })
    const history = await t.agent.history(ID)
    expect(history.filter((m) => m.type === 'user')).toEqual([
      { type: 'user', id: 'message:one', text: 'one', point: 'one' },
      { type: 'user', id: 'message:two', text: 'two', point: 'two' }
    ])
    vi.mocked(t.conn.request).mockResolvedValueOnce({ data: turns, nextCursor: null })
    await expect(t.agent.fork(ID, t.send.build, 'one')).resolves.toBe(ID2)
    expect(t.conn.request).toHaveBeenCalledWith('thread/fork', {
      threadId: ID,
      lastTurnId: 'one',
      excludeTurns: true
    })
    vi.mocked(t.conn.request).mockResolvedValueOnce({ data: turns, nextCursor: null })
    await expect(t.agent.fork(ID, t.send.build, 'two')).resolves.toBe(ID2)
    expect(t.conn.request).toHaveBeenLastCalledWith('thread/fork', { threadId: ID })
  })

  it('lists visible models with advertised defaults and supported efforts', async () => {
    const { agent } = setup()
    await expect(agent.models()).resolves.toEqual([
      {
        value: 'fixture',
        name: 'Fixture',
        isDefault: true,
        efforts: ['medium', 'high'],
        defaultEffort: 'high'
      }
    ])
  })

  it('uses a separate Ollama provider and rejects unavailable effort and cross-endpoint history', async () => {
    const t = setup('ollama')
    await expect(t.agent.send({ ...t.send, effort: 'high' })).rejects.toThrow('unavailable')
    await t.agent.send(t.send)
    expect(t.conn.request).not.toHaveBeenCalledWith('account/read', expect.anything())
    expect(t.conn.request).toHaveBeenCalledWith(
      'thread/start',
      expect.objectContaining({ modelProvider: 'builder_ollama', model: 'fixture:latest' })
    )
    expect(t.agent.state).toMatchObject({
      cost: null,
      capabilities: { effort: false, variants: true }
    })
    t.complete()
    t.settings.ollamaEndpoint = 'http://127.0.0.1:11435'
    await expect(t.agent.history(ID)).rejects.toThrow('endpoint')
    expect(t.conn.request).not.toHaveBeenCalledWith('thread/prediction/request', expect.anything())
  })

  it('answers item/tool/requestUserInput with mapped answers or empty answers when skipped', async () => {
    const t = setup()
    await t.agent.send(t.send)
    t.notify(
      'item/tool/requestUserInput',
      {
        itemId: 'q-item',
        isBlocking: true,
        autoResolutionMs: null,
        questions: [
          {
            id: 'stone',
            header: 'Stone',
            question: 'Which stone?',
            isOther: true,
            isSecret: false,
            options: [{ label: 'Deepslate', description: 'Dark slate' }]
          },
          {
            id: 'secret_note',
            header: 'Note',
            question: 'Any secret key?',
            isOther: false,
            isSecret: true,
            options: null
          }
        ]
      },
      71
    )
    expect(t.agent.pending()[0]).toMatchObject({
      id: 'codex:71',
      kind: 'question',
      tool: 'request_user_input',
      questions: [
        { id: 'stone', header: 'Stone', allowOther: true, secret: false },
        { id: 'secret_note', options: [], allowOther: true, secret: true }
      ]
    })
    t.agent.permit({
      id: 'codex:71',
      decision: 'allow',
      answers: { stone: ['Deepslate'], secret_note: ['abc'] }
    })
    await vi.waitFor(() =>
      expect(t.conn.respond).toHaveBeenCalledWith(71, {
        answers: { stone: { answers: ['Deepslate'] }, secret_note: { answers: ['abc'] } }
      })
    )

    // Skipping responds with an empty answers object
    t.notify(
      'item/tool/requestUserInput',
      {
        itemId: 'q-item-2',
        isBlocking: true,
        autoResolutionMs: null,
        questions: [
          {
            id: 'roof',
            header: 'Roof',
            question: 'Pitch?',
            isOther: true,
            isSecret: false,
            options: [{ label: 'Steep', description: 'Tall' }]
          }
        ]
      },
      72
    )
    t.agent.permit({ id: 'codex:72', decision: 'deny' })
    await vi.waitFor(() => expect(t.conn.respond).toHaveBeenCalledWith(72, { answers: {} }))
  })

  it('requests next-prompt predictions on completed Codex turns and emits suggestions', async () => {
    const t = setup()
    await t.agent.send(t.send)
    t.complete()
    expect(t.conn.request).toHaveBeenCalledWith('thread/prediction/request', {
      threadId: ID,
      sourceTurnId: 'turn-1'
    })
    t.notify('thread/prediction/updated', {
      sourceTurnId: 'turn-1',
      result: { type: 'completed', text: 'Run build.py proto next' }
    })
    expect(t.messages().at(-1)).toEqual({
      type: 'suggestion',
      id: 'pred:turn-1',
      text: 'Run build.py proto next'
    })
  })
})
