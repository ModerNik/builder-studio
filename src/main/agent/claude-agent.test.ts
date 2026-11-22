import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { expect, it, vi } from 'vitest'
import { SettingsSchema } from '@shared/api'
import type { CanUseTool } from '@anthropic-ai/claude-agent-sdk'
import { AgentService, diskSkills } from './agent'
import { ReviewQueue } from '../workspace/review'

const sdk = vi.hoisted(() => ({
  tools: new Map<string, (args: unknown) => Promise<unknown>>(),
  canUseTool: null as CanUseTool | null,
  env: {} as Record<string, string | undefined>,
  source: 'ANTHROPIC_API_KEY' as string | undefined, // accountInfo's apiKeySource
  messages: [] as unknown[], // yielded before the query waits
  history: vi.fn(),
  fork: vi.fn(),
  tag: vi.fn(),
  setPermissionMode: vi.fn(),
  fail: (error: Error): void => {
    throw error
  }
}))
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: (
    name: string,
    _description: string,
    _shape: unknown,
    handler: (args: unknown) => Promise<unknown>
  ) => {
    sdk.tools.set(name, handler)
    return { name }
  },
  createSdkMcpServer: vi.fn(),
  getSessionMessages: sdk.history,
  forkSession: sdk.fork,
  tagSession: sdk.tag,
  query: ({
    options
  }: {
    options: { canUseTool: CanUseTool; env: Record<string, string | undefined> }
  }) => {
    sdk.canUseTool = options.canUseTool
    sdk.env = options.env
    return {
      accountInfo: async () => ({ apiKeySource: sdk.source }),
      async *[Symbol.asyncIterator]() {
        yield* sdk.messages.splice(0)
        await new Promise((_, reject) => {
          sdk.fail = reject
        })
        yield undefined
      },
      interrupt: vi.fn(),
      close: vi.fn(),
      setPermissionMode: sdk.setPermissionMode
    }
  }
}))
vi.mock('../app/settings', () => ({ pythonEnv: () => ({ ...process.env }) }))
const KEY = 'sk-ant-api03-fixture'
vi.mock('./provider-config', () => ({ claudePrerequisites: () => null }))
vi.mock('./agent-resources', () => ({ agentResources: () => ({ instructions: '', critic: '' }) }))

it.each(['interrupt', 'close', 'failure'] as const)(
  'cancels Claude reviews on %s',
  async (action) => {
    const queue = new ReviewQueue(vi.fn())
    const settings = SettingsSchema.parse({
      workspace: 'workspace',
      python: '',
      claude: '',
      jar: '',
      pack: '',
      schematics: ''
    })
    const agent = new AgentService({
      settings: () => settings,
      emit: vi.fn(),
      addRule: vi.fn(),
      apiKey: () => KEY,
      tools: {
        show: vi.fn(),
        sheet: vi.fn(),
        status: vi.fn(),
        logRound: vi.fn(),
        versions: async () => ['builds/tower/out/a.litematic'],
        ask: (req, signal) => queue.ask(req, signal)
      }
    })
    const send = {
      provider: 'claude' as const,
      build: 'tower',
      text: 'review',
      resume: null,
      model: null,
      effort: null
    }
    try {
      await agent.send(send)
      const review = sdk.tools.get('request_review')!({
        build: 'tower',
        question: '?',
        variants: ['a']
      })
      await vi.waitFor(() => expect(queue.list()).toHaveLength(1))
      if (action === 'failure') {
        sdk.fail(new Error('provider disconnected'))
        await vi.waitFor(() => expect(agent.state.status).toBe('off'))
      } else await agent[action]()
      expect(queue.list()).toEqual([])
      await expect(review).resolves.toMatchObject({ content: [{ text: 'declined' }] })
      await agent.send(send)
      const next = sdk.tools.get('request_review')!({
        build: 'tower',
        question: 'again',
        variants: ['a']
      })
      await vi.waitFor(() => expect(queue.list()).toHaveLength(1))
      queue.answer(queue.list()[0].id!, null)
      await next
    } finally {
      agent.close()
    }
  }
)

const planner = (key: string | null = KEY): AgentService =>
  new AgentService({
    settings: () =>
      SettingsSchema.parse({
        workspace: 'workspace',
        python: '',
        claude: '',
        jar: '',
        pack: '',
        schematics: ''
      }),
    emit: vi.fn(),
    addRule: vi.fn(),
    apiKey: () => key,
    tools: {} as never
  })
const turn = {
  provider: 'claude' as const,
  build: 'tower',
  text: 'hi',
  resume: null,
  model: null,
  effort: null
}

it('rewinds to the message immediately before a Claude prompt', async () => {
  sdk.history.mockResolvedValue([
    { uuid: 'first', type: 'user', message: { content: 'First prompt' } },
    { uuid: 'reply', type: 'assistant', message: { content: [] } },
    { uuid: 'later', type: 'user', message: { content: 'Later prompt' } }
  ])
  sdk.fork.mockResolvedValue({ sessionId: 'fork' })
  const agent = planner()
  await expect(agent.rewindPoints('source')).resolves.toEqual([
    { id: 'first', text: 'First prompt' },
    { id: 'later', text: 'Later prompt' }
  ])
  await expect(agent.rewind('source', 'tower', 'first')).resolves.toBeNull()
  await expect(agent.rewind('source', 'tower', 'later')).resolves.toBe('fork')
  expect(sdk.fork).toHaveBeenCalledWith('source', { dir: 'workspace', upToMessageId: 'reply' })
  expect(sdk.tag).toHaveBeenCalledWith('fork', 'tower', { dir: 'workspace' })
})

it('runs Claude only on the user API key and refuses a subscription login', async () => {
  await expect(planner(null).send(turn)).rejects.toThrow(/Anthropic API key/)

  const agent = planner()
  try {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'subscription'
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:1/subscription-proxy'
    await agent.send(turn)
    expect(sdk.env.ANTHROPIC_API_KEY).toBe(KEY)
    expect(sdk.env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined()
    expect(sdk.env.ANTHROPIC_BASE_URL).toBeUndefined()
    agent.close()

    // the account check before the first turn
    sdk.source = 'none'
    await expect(agent.send(turn)).rejects.toThrow(/subscription login/)
    expect(agent.state).toMatchObject({
      status: 'off',
      error: expect.stringMatching(/subscription/)
    })

    // and the init message, should the CLI report a subscription after the check
    sdk.source = 'ANTHROPIC_API_KEY'
    sdk.messages.push({ type: 'system', subtype: 'init', apiKeySource: 'none', session_id: 's' })
    await agent.send(turn)
    await vi.waitFor(() =>
      expect(agent.state).toMatchObject({
        status: 'off',
        error: expect.stringMatching(/subscription/)
      })
    )
  } finally {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN
    delete process.env.ANTHROPIC_BASE_URL
    sdk.source = 'ANTHROPIC_API_KEY'
    agent.close()
  }
})

it.each([
  ['allow', undefined, 'default', 'default'],
  ['allow', 'auto', 'auto', 'default'], // the CLI runs Auto in its own default mode, the app allows each call
  ['deny', 'auto', 'plan', undefined]
] as const)(
  'ExitPlanMode %s (then %s) leaves the mode at %s',
  async (decision, next, mode, cli) => {
    const agent = planner()
    try {
      await agent.send({
        provider: 'claude',
        build: 'tower',
        text: 'plan it',
        resume: null,
        model: null,
        effort: null,
        mode: 'plan'
      })
      expect(agent.state.mode).toBe('plan')
      const result = sdk.canUseTool!('ExitPlanMode', { plan: '1. walls' }, {
        toolUseID: 'exit',
        signal: new AbortController().signal
      } as never)
      await vi.waitFor(() => expect(agent.pending()).toHaveLength(1))
      expect(agent.pending()[0].rule).toBeNull()
      agent.permit({ id: 'exit', decision, mode: next })
      expect(await result).toMatchObject(
        decision === 'allow'
          ? { behavior: 'allow', updatedPermissions: [{ type: 'setMode', mode: cli }] }
          : { behavior: 'deny', message: expect.stringMatching(/keep planning/) }
      )
      expect(agent.state.mode).toBe(mode)
    } finally {
      agent.close()
    }
  }
)

it('tracks self-entered plan mode so switching back to Auto updates the CLI mode', async () => {
  const agent = planner()
  sdk.setPermissionMode.mockClear()
  try {
    await agent.send({
      provider: 'claude',
      build: 'tower',
      text: 'build it',
      resume: null,
      model: null,
      effort: null,
      mode: 'auto'
    })
    expect(agent.state.mode).toBe('auto')
    const allowed = await sdk.canUseTool!('EnterPlanMode', {}, {
      toolUseID: 'enter',
      signal: new AbortController().signal
    } as never)
    expect(allowed).toMatchObject({ behavior: 'allow' })
    expect(agent.state.mode).toBe('plan')

    await agent.send({
      provider: 'claude',
      build: 'tower',
      text: 'implement the plan',
      resume: null,
      model: null,
      effort: null,
      mode: 'auto'
    })
    expect(sdk.setPermissionMode).toHaveBeenCalledWith('default')
    expect(agent.state.mode).toBe('auto')
    agent.close()

    sdk.setPermissionMode.mockClear()
    sdk.messages.push({ type: 'system', subtype: 'status', status: null, permissionMode: 'plan' })
    await agent.send({
      provider: 'claude',
      build: 'tower',
      text: 'plan again',
      resume: null,
      model: null,
      effort: null,
      mode: 'auto'
    })
    await vi.waitFor(() => expect(agent.state.mode).toBe('plan'))
    await agent.setMode('auto')
    expect(sdk.setPermissionMode).toHaveBeenCalledWith('default')
    expect(agent.state.mode).toBe('auto')
  } finally {
    agent.close()
  }
})

it('lists skills from SKILL.md frontmatter, the workspace before the user', () => {
  const root = mkdtempSync(join(tmpdir(), 'studio-skills-'))
  const skill = (dir: string, md: string): void => {
    mkdirSync(join(root, dir), { recursive: true })
    writeFileSync(join(root, dir, 'SKILL.md'), md)
  }
  skill('ws/.claude/skills/roof', '---\nname: roof\ndescription: "Pitched roofs"\n---\nbody')
  skill('home/.claude/skills/roof', '---\nname: roof\ndescription: shadowed\n---\n')
  skill(
    'home/.claude/skills/wall',
    '---\ndescription: >\n  Long\n  walls\nargument-hint: <block>\n---\n'
  )
  mkdirSync(join(root, 'home/.claude/skills/empty'))
  expect(diskSkills(join(root, 'ws'), join(root, 'home'))).toEqual([
    { name: 'roof', description: 'Pitched roofs', hint: '' },
    { name: 'wall', description: 'Long walls', hint: '<block>' }
  ])
  expect(diskSkills(join(root, 'none'), join(root, 'none'))).toEqual([])
})

it.each([
  ['auto', 'allows'],
  ['acceptEdits', 'allows'],
  ['default', 'asks for']
] as const)('%s %s a guarded Bash call', async (mode, verb) => {
  const agent = planner()
  try {
    await agent.send({
      provider: 'claude',
      build: 'tower',
      text: 'ship it',
      resume: null,
      model: null,
      effort: null,
      mode
    })
    const result = sdk.canUseTool!('Bash', { command: 'git push' }, {
      toolUseID: 'push',
      signal: new AbortController().signal
    } as never)
    if (verb === 'allows') expect(await result).toMatchObject({ behavior: 'allow' })
    else {
      await vi.waitFor(() => expect(agent.pending()).toHaveLength(1))
      expect(agent.pending()[0].guard).toBeTruthy()
      agent.permit({ id: 'push', decision: 'deny' })
      expect(await result).toMatchObject({ behavior: 'deny' })
    }
  } finally {
    agent.close()
  }
})
