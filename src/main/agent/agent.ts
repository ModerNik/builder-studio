// AgentService: the embedded agent. One Agent SDK query at a time, in streaming-input mode (user turns go through
// an inbox), with cwd = the workspace; app workflow resources are injected separately. It runs the user's own
// unmodified `claude` binary on the user's own Anthropic API key (Settings → AI, main/api-key.ts), passed as
// ANTHROPIC_API_KEY, which Claude Code prefers over any subscription login. A session whose account reports a
// subscription source is ended before its first turn is sent, and again on init (SUBSCRIPTION below). Users who want their Claude
// subscription connect their own Claude Code or Claude Desktop through the companion MCP server instead.
// The child keeps the user's CLAUDE_CONFIG_DIR: an app-owned one would hide their settings, skills and existing
// sessions, and the key's precedence plus the init guard already keep the subscription out.
import { existsSync, readdirSync, readFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { homedir } from 'os'
import { join } from 'path'
import {
  createSdkMcpServer,
  deleteSession,
  forkSession,
  getSessionMessages,
  listSessions,
  query,
  renameSession,
  tagSession,
  tool,
  type CanUseTool,
  type HookCallback,
  type PermissionMode,
  type Query,
  type SDKUserMessage
} from '@anthropic-ai/claude-agent-sdk'
import type {
  AgentCommand,
  AgentModel,
  AgentMode,
  AgentMsg,
  AgentRewindPoint,
  AgentSend,
  AgentSession,
  AgentState,
  Effort,
  McpStatus,
  PermissionAsk,
  Permit,
  Settings
} from '@shared/api'
import { DESCRIPTIONS, handlers, SHAPES, type McpDeps } from './mcp'
import { guard, ruleAllows, suggestRule } from './permissions'
import { laneGuard } from './lanes'
import { pythonEnv } from '../app/settings'
import { agentResources } from './agent-resources'
import { CAPABILITIES } from '@shared/api'
import { claudeEvents } from './claude-events'
import { claudePrerequisites } from './provider-config'
import { filesText, imageType, splitAttachments } from '../workspace/refs'
import { toolPath } from '../workspace/paths'

// AskUserQuestion has no card here (the agent asks in text); the companion server is for the terminal agent only
const DISALLOWED = ['AskUserQuestion', 'mcp__builder-studio']
// the studio tools that only show things or wait for the user; log_round writes DESIGN.md, so it asks
const AUTO = ['show_in_viewer', 'show_sheet', 'status', 'request_review'].map(
  (t) => `mcp__studio__${t}`
)
const LANE_DISALLOWED = ['show_in_viewer', 'show_sheet', 'request_review', 'log_round'].map(
  (t) => `mcp__studio__${t}`
)
// the CLI's aliases, as supportedModels() lists them; full ids work too
// Auto and Accept edits allow every call here (canUseTool), so the CLI runs them without its own classifier
const FREE: readonly AgentMode[] = ['auto', 'acceptEdits']
const cli = (mode: AgentMode): PermissionMode => (mode === 'auto' ? 'default' : mode)
const MODELS = [
  { value: 'opus', name: 'Opus' },
  { value: 'sonnet', name: 'Sonnet' },
  { value: 'haiku', name: 'Haiku' }
]

/** init apiKeySource values that mean a Claude subscription or claude.ai login: never used here. */
export const SUBSCRIPTION: readonly string[] = ['none', 'oauth', '/login managed key']
const SUBSCRIBED = 'Claude tried to use a subscription login, so the session was ended.'
export const NO_KEY =
  'Claude needs your own Anthropic API key. Add it in Settings → AI, or connect Claude Code or Claude Desktop to Builder Studio over MCP to use your subscription.'

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
  cost: 0,
  usage: null,
  auth: null,
  error: null
}

/** The user turns of one query: push() adds one, end() lets the query finish. */
function inbox(): {
  push(m: SDKUserMessage): void
  end(): void
  iter: AsyncGenerator<SDKUserMessage>
} {
  const queue: SDKUserMessage[] = []
  let wake: (() => void) | null = null
  let done = false
  async function* iter(): AsyncGenerator<SDKUserMessage> {
    for (;;) {
      while (queue.length) yield queue.shift()!
      if (done) return
      await new Promise<void>((r) => (wake = r))
    }
  }
  const poke = (): void => {
    wake?.()
    wake = null
  }
  return {
    push: (m) => (queue.push(m), poke()),
    end: () => ((done = true), poke()),
    iter: iter()
  }
}

/** A SKILL.md frontmatter value: plain, quoted, or a `>`/`|` block of the indented lines below it. */
function frontmatter(md: string, key: string): string {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md)?.[1] ?? ''
  const m = new RegExp(`^${key}:[ \\t]*(.*)$((?:\\r?\\n[ \\t]+.*)*)`, 'm').exec(head)
  if (!m) return ''
  const v = /^[>|][-+]?$/.test(m[1].trim()) ? m[2] : m[1] + m[2]
  return v
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(['"])(.*)\1$/, '$2')
}

/** ~/.claude/skills and <workspace>/.claude/skills, the workspace's first on a name clash.
 * shortcut: plugin skills and built-in commands appear once the session starts, scan the plugin cache if missed. */
export function diskSkills(workspace: string, home = homedir()): AgentCommand[] {
  const seen = new Map<string, AgentCommand>()
  for (const root of [join(workspace, '.claude', 'skills'), join(home, '.claude', 'skills')]) {
    if (!existsSync(root)) continue
    for (const dir of readdirSync(root, { withFileTypes: true })) {
      const file = join(root, dir.name, 'SKILL.md')
      if (!dir.isDirectory() || !existsSync(file)) continue
      const md = readFileSync(file, 'utf8')
      const name = frontmatter(md, 'name') || dir.name
      if (!seen.has(name))
        seen.set(name, {
          name,
          description: frontmatter(md, 'description'),
          hint: frontmatter(md, 'argument-hint')
        })
    }
  }
  return [...seen.values()]
}

export interface AgentDeps {
  emit(channel: 'agent:msg' | 'agent:state' | 'agent:ask', payload: unknown): void
  settings(): Settings // resolved
  projectSettings?(build: string): Settings
  addRule(build: string, rule: string): void
  tools: McpDeps
  apiKey(): string | null // the user's Anthropic API key, decrypted on demand; Claude only
  checkpoint?(session: string, turn: string): void
}

export class AgentService {
  state: AgentState = OFF
  private q: Query | null = null
  private box: ReturnType<typeof inbox> | null = null
  private asks = new Map<string, { ask: PermissionAsk; done: (p: Permit) => void }>()
  private tagged = false
  private stderr: string[] = []
  private reviewAbort = new AbortController()
  private checkpoint: ReturnType<typeof randomUUID> | undefined

  /** lane: a parallel variant (main/variants.ts), held to its own files; null for the Agent panel. */
  constructor(
    private d: AgentDeps,
    readonly lane: string | null = null
  ) {}

  private laneDenies(tool: string, input: Record<string, unknown>): string | null {
    return this.lane
      ? laneGuard(this.lane, this.state.build ?? '', tool, input, this.d.settings().workspace)
      : null
  }

  private set(p: Partial<AgentState>): void {
    this.state = { ...this.state, ...p }
    this.d.emit('agent:state', this.state)
  }

  async send(a: AgentSend): Promise<void> {
    if (a.provider !== 'claude' || (a.resume && a.resume.provider !== 'claude'))
      throw new Error('Claude requires a Claude session')
    const live =
      this.q &&
      this.state.build === a.build &&
      (a.resume === null || a.resume.id === this.state.sessionId)
    const content = this.content(a)
    if (!live) {
      const q = this.start(a)
      // the account is known before any prompt is sent: a subscription login never gets a turn
      const { apiKeySource } = await q.accountInfo()
      if (q !== this.q) throw new Error('Agent start cancelled')
      if (SUBSCRIPTION.includes(apiKeySource ?? 'none')) {
        this.close()
        this.set({ error: `${SUBSCRIBED} ${NO_KEY}` })
        throw new Error(`${SUBSCRIBED} ${NO_KEY}`)
      }
    } else {
      if (a.model !== this.state.model || a.effort !== this.state.effort)
        await this.configure(a.model, a.effort)
      if ((a.mode ?? 'default') !== this.state.mode) await this.setMode(a.mode ?? 'default')
    }
    this.reviewAbort.abort()
    this.reviewAbort = new AbortController()
    this.checkpoint = this.d.checkpoint ? randomUUID() : undefined
    this.box!.push({
      type: 'user',
      uuid: this.checkpoint,
      message: { role: 'user', content },
      parent_tool_use_id: null
    })
    this.set({ status: 'running', error: null })
  }

  /** The turn's text, with attached images inline and other attached files named for the agent to Read. */
  private content(a: AgentSend): SDKUserMessage['message']['content'] {
    const root = this.d.settings().workspace
    const { images, files } = splitAttachments(a.attachments ?? [])
    for (const f of files) toolPath(root, f)
    const text = a.text + filesText(files)
    if (!images.length) return text
    return [
      { type: 'text', text },
      ...images.map((p) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: imageType(p) as 'image/png',
          data: readFileSync(toolPath(root, p)).toString('base64')
        }
      }))
    ]
  }

  private start(a: AgentSend): Query {
    this.close()
    const s = this.d.projectSettings?.(a.build) ?? this.d.settings()
    if (!s.workspace) throw new Error('set the workspace in Settings first')
    const key = this.d.apiKey()
    if (!key) throw new Error(NO_KEY)
    const bash = claudePrerequisites(s)
    const resources = agentResources(s)
    const env: Record<string, string | undefined> = {
      ...pythonEnv(s),
      MCB_EVENTS: '1', // build.py prints @mcb lines, so the transcript can show job cards
      MCP_TOOL_TIMEOUT: '86400000', // request_review waits for the user as long as they take
      CLAUDE_AGENT_SDK_CLIENT_APP: 'builder-studio/0.3',
      ANTHROPIC_API_KEY: key
    }
    // only the user's key authenticates: no token, base URL (a host's subscription proxy), Bedrock/Vertex switch or
    // parent Claude Code session variable from the shell reaches the child
    for (const k of Object.keys(env))
      if (/^(ANTHROPIC_|CLAUDE_CODE_|CLAUDECODE$)/.test(k) && k !== 'ANTHROPIC_API_KEY')
        delete env[k]
    if (bash) env.CLAUDE_CODE_GIT_BASH_PATH = bash
    const h = handlers(this.d.tools)
    const opts = { alwaysLoad: true }
    const studio = createSdkMcpServer({
      name: 'studio',
      version: '0.3.0',
      tools: [
        tool('show_in_viewer', DESCRIPTIONS.show, SHAPES.show, h.show, opts),
        tool('show_sheet', DESCRIPTIONS.sheet, SHAPES.sheet, h.sheet, opts),
        tool('status', DESCRIPTIONS.status, {}, h.status, opts),
        tool(
          'request_review',
          DESCRIPTIONS.request_review,
          SHAPES.request_review,
          (args) => h.request_review(args, this.reviewAbort.signal),
          opts
        ),
        tool('log_round', DESCRIPTIONS.log_round, SHAPES.log_round, h.log_round, opts)
      ]
    })
    const box = inbox()
    this.stderr = []
    const q = query({
      prompt: box.iter,
      options: {
        cwd: s.workspace,
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append:
            resources.instructions +
            (s.minecraftVersion
              ? `\nThis build targets Minecraft Java ${s.minecraftVersion}. Use its block catalog and state properties.\n`
              : '')
        },
        agents: {
          'render-critic': {
            description: 'Critique Minecraft render sheets against the bundled design checklist.',
            prompt: resources.critic,
            tools: ['Read', 'Grep', 'Bash'],
            model: 'opus'
          }
        },
        pathToClaudeCodeExecutable: s.claude,
        settingSources: ['user', 'project', 'local'], // 'project' loads CLAUDE.md, skills, agents and hooks
        permissionMode: cli(a.mode ?? 'default'), // the SDK's own default is 'auto'; the user approves here instead
        canUseTool: this.canUseTool,
        hooks: { PreToolUse: [{ hooks: [this.alwaysAsk] }] },
        includePartialMessages: true,
        forwardSubagentText: true,
        mcpServers: { studio },
        allowedTools: AUTO,
        // a variant lane leaves the viewer, the log and Review to the Variants screen
        disallowedTools: this.lane ? [...DISALLOWED, ...LANE_DISALLOWED] : DISALLOWED,
        resume: a.resume?.id,
        title: a.resume ? undefined : a.title,
        model: a.model ?? undefined,
        effort: a.effort ?? undefined,
        env,
        stderr: (t) => {
          this.stderr = [...this.stderr, ...t.split(/\r?\n/).filter(Boolean)].slice(-50)
        }
      }
    })
    this.q = q
    this.box = box
    this.tagged = !!a.resume
    this.set({
      ...OFF,
      build: a.build,
      sessionId: a.resume?.id ?? null,
      status: 'starting',
      mode: a.mode ?? 'default',
      model: a.model,
      effort: a.effort
    })
    void this.pump(q, a.build, s.workspace)
    return q
  }

  private async pump(q: Query, build: string, repo: string): Promise<void> {
    try {
      for await (const m of q) {
        if (q !== this.q) return
        if (m.type === 'system' && m.subtype === 'init' && SUBSCRIPTION.includes(m.apiKeySource)) {
          this.close()
          this.set({ error: `${SUBSCRIBED} ${NO_KEY}` })
          return
        }
        for (const event of claudeEvents(m)) this.d.emit('agent:msg', event)
        if (m.type === 'system' && m.subtype === 'init')
          this.set({ sessionId: m.session_id, auth: m.apiKeySource, model: m.model })
        if (m.type === 'result') {
          this.reviewAbort.abort()
          if (this.checkpoint && this.state.sessionId)
            this.d.checkpoint?.(this.state.sessionId, this.checkpoint)
          this.checkpoint = undefined
          this.set({
            status: 'idle',
            cost: (this.state.cost ?? 0) + m.total_cost_usd,
            usage: {
              input: m.usage.input_tokens,
              output: m.usage.output_tokens,
              cacheRead: m.usage.cache_read_input_tokens ?? null,
              cacheWrite: m.usage.cache_creation_input_tokens ?? null,
              reasoning: null
            }
          })
          const id = this.state.sessionId
          if (!this.tagged && id) {
            this.tagged = true
            // lanes get their own tag, so the Agent panel's session list stays the build's main line
            await tagSession(id, this.lane ? `${build}#${this.lane}` : build, { dir: repo }).catch(
              (e) => console.error(`tagSession: ${e}`)
            )
          }
          const u = await q.getContextUsage({ detail: 'summary' }).catch(() => null)
          if (u && q === this.q)
            this.set({
              context: {
                tokens: u.totalTokens,
                max: u.maxTokens,
                categories: u.categories?.filter((c) => c.kind === 'used')
              }
            })
        }
      }
      if (q === this.q) this.ended(null)
    } catch (e) {
      if (q !== this.q) return
      const tail = this.stderr.slice(-5).join('\n')
      this.ended(`${e instanceof Error ? e.message : String(e)}${tail ? `\n${tail}` : ''}`)
    }
  }

  private ended(error: string | null): void {
    this.reviewAbort.abort()
    this.q = null
    this.box = null
    this.denyAll()
    this.set({ status: 'off', error })
  }

  private denyAll(): void {
    for (const [id, { done }] of this.asks) done({ id, decision: 'deny' })
  }

  async interrupt(): Promise<void> {
    this.reviewAbort.abort()
    this.denyAll()
    await this.q?.interrupt()
  }

  /** Ends the live session (it stays resumable); the next send starts a new one. */
  close(): void {
    this.reviewAbort.abort()
    const q = this.q
    this.q = null
    this.box?.end()
    this.box = null
    this.denyAll()
    q?.close()
    this.set({ ...OFF })
  }

  async configure(model: string | null, effort: Effort | null): Promise<void> {
    if (this.q) {
      if (model !== this.state.model) await this.q.setModel(model ?? undefined)
      if (effort !== this.state.effort) await this.q.applyFlagSettings({ effortLevel: effort })
    }
    this.set({ model, effort })
  }

  async setMode(mode: AgentMode): Promise<void> {
    await this.q?.setPermissionMode(cli(mode))
    this.set({ mode })
  }

  pending(): PermissionAsk[] {
    return [...this.asks.values()].map((a) => a.ask)
  }

  permit(p: Permit): void {
    this.asks.get(p.id)?.done(p)
  }

  /** Guarded calls (git push, deletes outside out/, paths outside the repo) always reach canUseTool, even
   *  where a settings allow rule would have let them through. */
  private alwaysAsk: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse') return {}
    const own = this.laneDenies(
      input.tool_name,
      (input.tool_input ?? {}) as Record<string, unknown>
    )
    if (own)
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Builder Studio: ${own}`
        }
      }
    const g = guard(
      input.tool_name,
      (input.tool_input ?? {}) as Record<string, unknown>,
      this.d.settings().workspace
    )
    return g
      ? {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'ask',
            permissionDecisionReason: `Builder Studio asks every time: ${g}`
          }
        }
      : {}
  }

  private canUseTool: CanUseTool = async (tool, input, opts) => {
    const s = this.d.settings()
    const build = this.state.build ?? ''
    const own = this.laneDenies(tool, input)
    if (own) return { behavior: 'deny', message: `Builder Studio: ${own}` }
    // the plan card still shows: the agent can enter plan mode by itself
    if (FREE.includes(this.state.mode) && tool !== 'ExitPlanMode')
      return { behavior: 'allow', updatedInput: input }
    if ((s.agentAllow[build] ?? []).some((r) => ruleAllows(r, tool, input, s.workspace)))
      return { behavior: 'allow', updatedInput: input }
    const g = guard(tool, input, s.workspace)
    const ask: PermissionAsk = {
      id: opts.toolUseID,
      build,
      tool,
      input,
      title: opts.title ?? null,
      reason: opts.decisionReason ?? null,
      guard: g,
      rule:
        g || opts.suppressAlwaysAllowRule || tool === 'ExitPlanMode'
          ? null
          : suggestRule(tool, input, s.workspace),
      agent: opts.agentID ?? null
    }
    const { decision, mode } = await new Promise<Permit>((done) => {
      this.asks.set(ask.id, { ask, done })
      opts.signal.addEventListener('abort', () => done({ id: ask.id, decision: 'deny' }))
      this.d.emit('agent:ask', ask)
    })
    this.asks.delete(ask.id)
    this.d.emit('agent:ask', { done: ask.id })
    const plan = tool === 'ExitPlanMode'
    if (decision === 'deny')
      return {
        behavior: 'deny',
        message: plan
          ? 'The user wants to keep planning. Wait for their feedback before you change the plan.'
          : 'The user denied this in Builder Studio.'
      }
    if (decision === 'always' && ask.rule) this.d.addRule(build, ask.rule)
    if (!plan) return { behavior: 'allow', updatedInput: input }
    const next = mode && mode !== 'plan' ? mode : 'default'
    this.set({ mode: next })
    return {
      behavior: 'allow',
      updatedInput: input,
      updatedPermissions: [{ type: 'setMode', mode: cli(next), destination: 'session' }]
    }
  }

  async sessions(build: string): Promise<AgentSession[]> {
    const all = await listSessions({ dir: this.d.settings().workspace, includeWorktrees: false })
    return all
      .filter((s) => s.tag === build)
      .sort((a, b) => b.lastModified - a.lastModified)
      .map((s) => ({
        provider: 'claude',
        id: s.sessionId,
        title: s.customTitle ?? s.summary,
        tag: s.tag ?? null,
        modified: s.lastModified
      }))
  }

  async history(id: string): Promise<AgentMsg[]> {
    const msgs = await getSessionMessages(id, { dir: this.d.settings().workspace })
    return msgs.flatMap((m) => claudeEvents({ ...m }))
  }

  async fork(id: string, tag: string): Promise<string> {
    const dir = this.d.settings().workspace
    const { sessionId } = await forkSession(id, { dir })
    await tagSession(sessionId, tag, { dir })
    return sessionId
  }

  async rewindPoints(id: string): Promise<AgentRewindPoint[]> {
    const messages = await getSessionMessages(id, { dir: this.d.settings().workspace })
    return messages.flatMap((m) =>
      claudeEvents({ ...m }).flatMap((e) =>
        e.type === 'user' ? [{ id: m.uuid, text: e.text }] : []
      )
    )
  }

  async rewind(id: string, tag: string, point: string): Promise<string | null> {
    const dir = this.d.settings().workspace
    const messages = await getSessionMessages(id, { dir })
    const at = messages.findIndex(
      (m) => m.uuid === point && claudeEvents({ ...m }).some((e) => e.type === 'user')
    )
    if (at < 0) throw new Error('That turn is no longer in the conversation.')
    if (at === 0) return null
    const { sessionId } = await forkSession(id, { dir, upToMessageId: messages[at - 1].uuid })
    await tagSession(sessionId, tag, { dir })
    return sessionId
  }

  rename(id: string, title: string): Promise<void> {
    return renameSession(id, title, { dir: this.d.settings().workspace })
  }

  remove(id: string): Promise<void> {
    return deleteSession(id, { dir: this.d.settings().workspace })
  }

  /** The live session's skills and slash commands; before it starts, the skills on disk. */
  async commands(): Promise<AgentCommand[]> {
    const list = await this.q?.supportedCommands()
    return (
      list?.map((c) => ({
        name: c.name,
        description: c.description,
        hint: c.argumentHint,
        ...(c.builtin ? { skill: false } : {})
      })) ?? diskSkills(this.d.settings().workspace)
    )
  }

  async mcp(): Promise<McpStatus[]> {
    const list = (await this.q?.mcpServerStatus()) ?? []
    return list.map((m) => ({
      name: m.name,
      status: m.status,
      scope: m.scope ?? null,
      error: m.error ?? null
    }))
  }

  /** Turns a server on or off; turning a failed one on reconnects it. */
  async mcpToggle(name: string, enabled: boolean): Promise<void> {
    if (!this.q) throw new Error('Send a message first: MCP servers start with the session.')
    const now = (await this.q.mcpServerStatus()).find((m) => m.name === name)
    if (enabled && now?.status === 'failed') await this.q.reconnectMcpServer(name)
    else await this.q.toggleMcpServer(name, enabled)
  }

  async models(): Promise<AgentModel[]> {
    const live = await this.q?.supportedModels().catch(() => null)
    const list = live
      ?.filter((m) => m.value !== 'default')
      .map((m) => ({
        value: m.value,
        name: m.displayName,
        efforts: m.supportsEffort === false ? [] : m.supportedEffortLevels
      }))
    return list?.length ? list : MODELS
  }
}
