import { mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import {
  CAPABILITIES,
  EFFORTS,
  type AgentModel,
  type AgentCommand,
  type AgentMode,
  type AgentMsg,
  type AgentQuestion,
  type AgentSend,
  type AgentSession,
  type AgentState,
  type Effort,
  type McpStatus,
  type PermissionAsk,
  type Permit
} from '@shared/api'
import type { AgentDeps } from './agent'
import { agentResources } from './agent-resources'
import {
  codexArgs,
  codexMcp,
  ollamaEndpoint,
  ollamaModels,
  providerExecutable
} from './provider-config'
import { CodexRpc, type CodexConnection, type RpcMessage } from './codex-rpc'
import { codexEvents, type CodexItem } from './codex-events'
import { DESCRIPTIONS, handlers, SHAPES } from './mcp'
import { pythonEnv } from '../app/settings'
import { writeAtomic } from '../workspace/review'
import { filesText, splitAttachments } from '../workspace/refs'
import { toolPath } from '../workspace/paths'
import { laneGuard } from './lanes'

const SavedSession = z.object({
  workspace: z.string(),
  build: z.string(),
  title: z.string(),
  modified: z.number(),
  endpoint: z.string()
})
const SessionIndex = z.record(z.uuid(), SavedSession)
type Thread = {
  id: string
  turns: { id: string; items: CodexItem[]; status: string; error: { message: string } | null }[]
}
type ThreadResult = { thread: Thread; model: string }
// Auto and Plan never ask: the workspace-write sandbox (no network) still bounds what it can do, and Plan's
// collaboration mode keeps it from editing. A variant lane asks for every edit and every non-read-only command
// ('untrusted'), so laneGuard sees each one before it runs.
const policy = (mode: AgentMode | undefined, lane: string | null): string =>
  lane ? 'untrusted' : !mode || mode === 'default' ? 'on-request' : 'never'
type Skill = { name: string; description: string; path: string; enabled: boolean }
const Item = z.looseObject({ type: z.string(), id: z.string() })
const tools = {
  show_in_viewer: { shape: SHAPES.show, description: DESCRIPTIONS.show },
  show_sheet: { shape: SHAPES.sheet, description: DESCRIPTIONS.sheet },
  status: { shape: {}, description: DESCRIPTIONS.status },
  request_review: { shape: SHAPES.request_review, description: DESCRIPTIONS.request_review },
  log_round: { shape: SHAPES.log_round, description: DESCRIPTIONS.log_round }
}
export const codexTools = Object.entries(tools).map(([name, t]) => ({
  type: 'function',
  name,
  description: t.description,
  inputSchema: z.toJSONSchema(z.object(t.shape))
}))

export interface CodexDeps extends AgentDeps {
  home: string
  openAuth(url: string): Promise<void>
  connect?: (
    file: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv },
    receive: (m: RpcMessage) => void,
    failed: (e: Error) => void
  ) => CodexConnection
}

export class CodexAgent {
  state: AgentState
  private rpc: CodexConnection | null = null
  private minecraftVersion: string | undefined
  private connecting: Promise<CodexConnection> | null = null
  private epoch = 0
  private turn: string | null = null
  private lastCompletedTurn: string | null = null
  private abort = new AbortController()
  private asks = new Map<string, { ask: PermissionAsk; done(p: Permit): void }>()
  private loginId: string | null = null
  private loginStarting = false
  private disabled = new Set<string>() // MCP servers switched off for this thread (mcpToggle)
  private edits = new Map<string, string[]>() // fileChange item id -> its paths, for laneGuard
  private threadPlanMode = false // true while the live Codex thread may be in sticky plan collaboration mode

  /** lane: a parallel variant (main/variants.ts), held to its own files; null for the Agent panel. */
  constructor(
    private d: CodexDeps,
    readonly provider: 'codex' | 'ollama',
    readonly lane: string | null = null
  ) {
    this.state = this.off()
  }

  private off(): AgentState {
    return {
      provider: this.provider,
      capabilities: CAPABILITIES[this.provider],
      build: null,
      sessionId: null,
      status: 'off',
      mode: 'default',
      model: null,
      effort: null,
      context: null,
      usage: null,
      cost: null,
      auth: null,
      error: null
    }
  }
  get authenticating(): boolean {
    return this.loginStarting || !!this.loginId
  }
  private set(p: Partial<AgentState>): void {
    this.state = { ...this.state, ...p }
    this.d.emit('agent:state', this.state)
  }
  private emit(m: AgentMsg): void {
    this.d.emit('agent:msg', m)
  }
  private index(): z.infer<typeof SessionIndex> {
    try {
      return SessionIndex.parse(
        JSON.parse(readFileSync(join(this.d.home, 'sessions.json'), 'utf8'))
      )
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw new Error(
        'Provider session index is unreadable; restore its backup before continuing.',
        { cause: e }
      )
    }
  }
  private endpoint(): string {
    return this.provider === 'ollama' ? ollamaEndpoint(this.d.settings().ollamaEndpoint).origin : ''
  }
  private owned(id: string, build?: string): z.infer<typeof SavedSession> {
    const session = this.index()[id]
    if (
      !session ||
      session.workspace !== this.d.settings().workspace ||
      session.endpoint !== this.endpoint() ||
      (build && build !== session.build)
    )
      throw new Error('This session belongs to another provider, workspace, endpoint or build.')
    return session
  }
  private remember(id: string, build: string, title: string): void {
    const index = this.index()
    index[id] = {
      workspace: this.d.settings().workspace,
      endpoint: this.endpoint(),
      build,
      title,
      modified: Date.now()
    }
    writeAtomic(join(this.d.home, 'sessions.json'), JSON.stringify(index, null, 2))
  }
  private async skills(rpc: CodexConnection): Promise<Skill[]> {
    const result = await rpc.request<{ data: { skills: Skill[] }[] }>('skills/list', {
      cwds: [this.d.settings().workspace]
    })
    return result.data.flatMap((d) => d.skills).filter((k) => k.enabled)
  }

  private async ready(settings = this.d.settings()): Promise<CodexConnection> {
    if (this.connecting) return this.connecting
    if (this.rpc) return this.rpc
    const epoch = this.epoch
    this.connecting = (async () => {
      const s = settings
      const file = providerExecutable(s)
      mkdirSync(this.d.home, { recursive: true })
      const mcp = codexMcp(s.workspace)
      if (mcp.error)
        this.emit({ type: 'note', id: `mcp:${Date.now()}`, text: mcp.error, error: true })
      const env = { ...pythonEnv(s), ...mcp.env, CODEX_HOME: this.d.home, MCB_EVENTS: '1' }
      // Authentication is owned by this app-server home, never inherited from a development shell.
      // shortcut: an MCP server env named like one of these keys reaches the server empty, map them if one needs it
      for (const key of [
        'OPENAI_API_KEY',
        'OPENAI_BASE_URL',
        'CODEX_API_KEY',
        'CODEX_AUTH_TOKEN',
        'ANTHROPIC_API_KEY',
        'ANTHROPIC_AUTH_TOKEN'
      ])
        delete env[key]
      const rpc = (this.d.connect ?? ((...args) => new CodexRpc(...args)))(
        file,
        [...codexArgs(s, this.provider === 'ollama'), ...mcp.args],
        { cwd: this.d.home, env },
        (m) => {
          if (epoch === this.epoch)
            void this.receive(m).catch((e) => {
              if (epoch !== this.epoch) return
              if (m.id !== undefined)
                this.rpc?.reject(m.id, e instanceof Error ? e.message : String(e))
              else this.fail(e)
            })
        },
        (e) => {
          if (epoch === this.epoch) this.fail(e)
        }
      )
      this.rpc = rpc
      await rpc.request('initialize', {
        clientInfo: { name: 'builder_studio', title: 'Builder Studio', version: '1.0.3' },
        capabilities: { experimentalApi: true }
      })
      if (epoch !== this.epoch) throw new Error('Provider connection cancelled')
      rpc.initialized()
      return rpc
    })()
    try {
      return await this.connecting
    } catch (e) {
      if (epoch === this.epoch) this.fail(e)
      throw e
    } finally {
      if (epoch === this.epoch) this.connecting = null
    }
  }

  async account(): Promise<string | null> {
    if (this.provider === 'ollama') return 'local'
    const rpc = await this.ready()
    const result = await rpc.request<{ account: { type: string } | null }>('account/read', {
      refreshToken: false
    })
    if (rpc !== this.rpc) throw new Error('Provider connection closed')
    this.set({ auth: result.account?.type ?? null })
    return result.account?.type ?? null
  }
  async checkConnection(): Promise<void> {
    await this.ready()
  }
  async login(): Promise<void> {
    if (this.provider !== 'codex')
      throw new Error(
        'Ollama uses its configured endpoint and installed model; it has no app login.'
      )
    if (this.authenticating)
      throw new Error('A Codex login is already in progress. Finish or cancel it first.')
    if (this.state.status === 'running' || this.state.status === 'starting')
      throw new Error('Stop the agent before signing in.')
    const epoch = this.epoch
    this.loginStarting = true
    try {
      const rpc = await this.ready()
      const result = await rpc.request<{ type: string; loginId: string; authUrl: string }>(
        'account/login/start',
        { type: 'chatgpt' }
      )
      if (epoch !== this.epoch) throw new Error('Codex sign-in cancelled')
      this.loginId = z.string().min(1).parse(result.loginId)
      try {
        const url = new URL(result.authUrl)
        if (
          url.protocol !== 'https:' ||
          !['auth.openai.com', 'chatgpt.com', 'auth0.openai.com'].includes(url.hostname) ||
          url.username ||
          url.password
        )
          throw new Error('Codex returned an unexpected login URL.')
        await this.d.openAuth(url.href)
      } catch (e) {
        await this.cancelLogin()
        throw e
      }
    } finally {
      if (epoch === this.epoch) this.loginStarting = false
    }
  }
  async cancelLogin(): Promise<void> {
    if (this.loginStarting && !this.loginId) {
      this.close()
      return
    }
    const loginId = this.loginId
    this.loginId = null
    this.loginStarting = false
    if (loginId && this.rpc) await this.rpc.request('account/login/cancel', { loginId })
  }

  async send(a: AgentSend): Promise<string | undefined> {
    if (this.authenticating) throw new Error('Finish or cancel Codex sign-in before sending.')
    if (a.provider !== this.provider || (a.resume && a.resume.provider !== this.provider))
      throw new Error('Cannot resume another provider’s session.')
    if (this.state.status === 'running' || this.state.status === 'starting')
      throw new Error('The agent is still working. Stop it before sending another turn.')
    const s = this.d.projectSettings?.(a.build) ?? this.d.settings()
    if (!s.workspace) throw new Error('Select a workspace in Settings first.')
    const { images, files } = splitAttachments(a.attachments ?? [])
    for (const f of files) toolPath(s.workspace, f)
    const imagePaths = images.map((p) => toolPath(s.workspace, p))
    // lanes keep their sessions under <build>#<lane>, apart from the Agent panel's list
    const tag = this.lane ? `${a.build}#${this.lane}` : a.build
    if (a.resume) this.owned(a.resume.id, tag)
    if (this.provider === 'ollama' && a.effort)
      throw new Error('Reasoning effort is unavailable with Ollama.')
    if (this.rpc && this.minecraftVersion !== s.minecraftVersion) this.close()
    this.minecraftVersion = s.minecraftVersion
    const epoch = this.epoch
    this.set({ status: 'starting', error: null })
    try {
      const rpc = await this.ready(s)
      if (this.provider === 'ollama') {
        const models = await ollamaModels(s)
        if (!s.ollamaModel || !models.includes(s.ollamaModel))
          throw new Error(
            'Select an already-installed Ollama model in Settings. Builder Studio does not download models.'
          )
        if (a.model && a.model !== s.ollamaModel)
          throw new Error('Change the Ollama model in Settings first.')
      } else if (!(await this.account()))
        throw new Error(
          'Codex is not signed in to Builder Studio. Use Sign in with ChatGPT in Settings.'
        )
      if (epoch !== this.epoch) throw new Error('Agent start cancelled')
      const live =
        this.state.sessionId &&
        this.state.build === a.build &&
        (!a.resume || a.resume.id === this.state.sessionId)
      if (!live) {
        this.abort.abort()
        this.abort = new AbortController()
        const options = this.threadOptions(a.mode, a.model, s)
        const result = await rpc.request<ThreadResult>(
          a.resume ? 'thread/resume' : 'thread/start',
          a.resume
            ? { ...options, threadId: a.resume.id }
            : {
                ...options,
                // a lane leaves the viewer, the log and Review to the Variants screen
                dynamicTools: this.lane ? codexTools.filter((t) => t.name === 'status') : codexTools
              }
        )
        if (epoch !== this.epoch) throw new Error('Agent start cancelled')
        const id = z.uuid().parse(result.thread.id)
        const title = a.resume ? this.owned(id).title : (a.title ?? a.text.slice(0, 100))
        this.remember(id, tag, title)
        // A resumed thread may still carry sticky plan collaboration mode from an earlier session.
        this.threadPlanMode = !!a.resume
        this.set({ build: a.build, sessionId: id, model: result.model, context: null, usage: null })
        this.emit({
          type: 'note',
          id: `session:${id}`,
          text: `${this.provider} session ${id.slice(0, 8)} · ${result.model}`
        })
      }
      if (a.text === '/compact' && !a.attachments?.length) {
        this.abort = new AbortController()
        this.set({ status: 'running' })
        await rpc.request('thread/compact/start', { threadId: this.state.sessionId })
        return undefined
      }
      const names = new Set([...a.text.matchAll(/\$([\w:-]+)/g)].map((m) => m[1]))
      const skills = names.size ? (await this.skills(rpc)).filter((k) => names.has(k.name)) : []
      if (epoch !== this.epoch) throw new Error('Agent start cancelled')
      const mode = a.mode ?? 'default'
      // Collaboration mode sticks to the thread, so leaving plan mode is sent too — even when
      // setMode() already updated state.mode before this turn, or a resumed thread ended in plan mode.
      const collaboration = (mode === 'plan' || this.threadPlanMode) && {
        collaborationMode: {
          mode: mode === 'plan' ? 'plan' : 'default',
          settings: {
            model: this.provider === 'ollama' ? s.ollamaModel : (a.model ?? this.state.model),
            reasoning_effort: a.effort,
            developer_instructions: null
          }
        }
      }
      this.lastCompletedTurn = null
      this.abort = new AbortController()
      this.threadPlanMode = mode === 'plan'
      this.set({ status: 'running', effort: a.effort, mode })
      const result = await rpc.request<{ turn: { id: string } }>('turn/start', {
        threadId: this.state.sessionId,
        input: [
          { type: 'text', text: a.text + filesText(files), text_elements: [] },
          ...imagePaths.map((path) => ({ type: 'localImage', path })),
          ...skills.map((k) => ({ type: 'skill', name: k.name, path: k.path }))
        ],
        ...collaboration,
        cwd: s.workspace,
        runtimeWorkspaceRoots: [s.workspace],
        approvalPolicy: policy(mode, this.lane),
        approvalsReviewer: 'user',
        sandboxPolicy: {
          type: 'workspaceWrite',
          writableRoots: [s.workspace, s.cache],
          networkAccess: false,
          excludeTmpdirEnvVar: true,
          excludeSlashTmp: true
        },
        model: this.provider === 'ollama' ? s.ollamaModel : a.model,
        effort: a.effort
      })
      if (epoch === this.epoch && !this.abort.signal.aborted) this.turn = result.turn.id
      return result.turn.id
    } catch (e) {
      if (epoch === this.epoch) this.fail(e)
      throw e
    }
  }

  /** thread/start and thread/resume settings; disabled MCP servers are switched off in its config. */
  private threadOptions(
    mode: AgentMode | undefined,
    model: string | null,
    s = this.d.settings()
  ): Record<string, unknown> {
    const l = this.lane
    return {
      cwd: s.workspace,
      runtimeWorkspaceRoots: [s.workspace],
      approvalPolicy: policy(mode, l),
      approvalsReviewer: 'user',
      sandbox: 'workspace-write',
      model: this.provider === 'ollama' ? s.ollamaModel : model,
      modelProvider: this.provider === 'ollama' ? 'builder_ollama' : 'openai',
      config: Object.fromEntries(
        [...this.disabled].map((n) => [`mcp_servers.${n}.enabled`, false])
      ),
      developerInstructions:
        agentResources(s).instructions +
        (s.minecraftVersion
          ? `\nThis build targets Minecraft Java ${s.minecraftVersion}. Use its block catalog and state properties.\n`
          : '') +
        (l
          ? `\nYou are parallel variant ${l}. Write only builds/<build>/<name>_${l}.<ext> files, run builds only with --name <name>_${l}, and leave git alone; anything else is declined.\n`
          : '\nUse show_in_viewer, show_sheet and request_review to work with the user. Use log_round only after approval.\n') +
        'Do not invoke the companion MCP server from shell commands.\n' +
        'On Windows PowerShell, run Python with & $env:MCB_PYTHON (e.g. & $env:MCB_PYTHON -m tools.new_build <name>); Bash examples use "$MCB_PYTHON". Use your native editing and shell tools for workflow references to Write/Bash. Critique renders yourself.'
    }
  }

  private fail(error: unknown): void {
    this.close()
    this.set({ error: error instanceof Error ? error.message : String(error) })
  }
  close(): void {
    ++this.epoch
    this.abort.abort()
    for (const [id, ask] of this.asks) ask.done({ id, decision: 'deny' })
    this.rpc?.close()
    this.rpc = null
    this.connecting = null
    this.turn = null
    this.lastCompletedTurn = null
    this.loginId = null
    this.loginStarting = false
    this.edits.clear()
    this.threadPlanMode = false
    this.set(this.off())
  }
  async interrupt(): Promise<void> {
    this.abort.abort()
    this.lastCompletedTurn = null
    for (const [id, ask] of this.asks) ask.done({ id, decision: 'deny' })
    if (this.turn && this.rpc) {
      await this.rpc.request('turn/interrupt', {
        threadId: this.state.sessionId,
        turnId: this.turn
      })
    } else if (this.state.status === 'starting' || this.state.status === 'running') this.close()
  }
  async configure(model: string | null, effort: Effort | null): Promise<void> {
    if (this.state.status === 'running' || this.state.status === 'starting')
      throw new Error('Wait for the agent before changing its model.')
    if (
      this.provider === 'ollama' &&
      (effort || (model && model !== this.d.settings().ollamaModel))
    )
      throw new Error('Configure the installed Ollama model in Settings; effort is unavailable.')
    this.set({ model, effort })
  }
  /** Takes effect with the next turn's collaboration mode. */
  async setMode(mode: AgentMode): Promise<void> {
    if (this.state.status === 'running' || this.state.status === 'starting')
      throw new Error('Wait for the agent before changing its mode.')
    this.set({ mode })
  }
  pending(): PermissionAsk[] {
    return [...this.asks.values()].map((x) => x.ask)
  }
  permit(p: Permit): void {
    this.asks.get(p.id)?.done(p)
  }

  /** Why the lane may not run this approval request, or null. An edit whose paths are unknown is refused. */
  private laneDenies(shell: boolean, p: Record<string, unknown>): string | null {
    const l = this.lane
    if (!l) return null
    const g = (tool: string, input: Record<string, unknown>): string | null =>
      laneGuard(l, this.state.build ?? '', tool, input, this.d.settings().workspace)
    if (shell) return g('Bash', { command: String(p.command ?? '') })
    const paths = this.edits.get(String(p.itemId))
    if (!paths?.length) return `variant ${l} could not tell which files this edit touches`
    for (const file_path of paths) {
      const why = g('Write', { file_path })
      if (why) return why
    }
    return null
  }

  private approval(
    id: string | number,
    tool: string,
    input: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<boolean> {
    if (signal.aborted) return Promise.resolve(false)
    const key = `codex:${id}`
    return new Promise((resolve) => {
      const abort = (): void => done({ id: key, decision: 'deny' })
      const done = (p: Permit): void => {
        if (!this.asks.delete(key)) return
        signal.removeEventListener('abort', abort)
        this.d.emit('agent:ask', { done: key })
        resolve(p.decision === 'allow')
      }
      const ask: PermissionAsk = {
        id: key,
        build: this.state.build ?? '',
        tool,
        kind: 'permission',
        input,
        title: null,
        reason: typeof input.reason === 'string' ? input.reason : null,
        guard: 'Codex approvals apply once',
        rule: null,
        agent: null
      }
      this.asks.set(key, { ask, done })
      signal.addEventListener('abort', abort, { once: true })
      this.d.emit('agent:ask', ask)
    })
  }

  private userInput(
    id: string | number,
    input: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<{ answers: Record<string, { answers: string[] }> }> {
    if (signal.aborted) return Promise.resolve({ answers: {} })
    const raw = Array.isArray(input.questions) ? input.questions : []
    const questions: AgentQuestion[] = raw
      .filter((q): q is Record<string, unknown> => !!q && typeof q === 'object')
      .map((q) => {
        const options = Array.isArray(q.options)
          ? q.options
              .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
              .map((o) => ({
                label: String(o.label ?? ''),
                description: String(o.description ?? '')
              }))
          : []
        return {
          id: String(q.id ?? ''),
          header: String(q.header ?? ''),
          question: String(q.question ?? ''),
          options,
          multiSelect: false,
          allowOther: Boolean(q.isOther) || options.length === 0,
          secret: Boolean(q.isSecret)
        }
      })
      .filter((q) => q.id.length > 0 && q.question.length > 0)
    if (!questions.length) return Promise.resolve({ answers: {} })
    const key = `codex:${id}`
    return new Promise((resolve) => {
      const abort = (): void => done({ id: key, decision: 'deny' })
      const done = (p: Permit): void => {
        if (!this.asks.delete(key)) return
        signal.removeEventListener('abort', abort)
        this.d.emit('agent:ask', { done: key })
        if (p.decision !== 'allow' || !p.answers) {
          resolve({ answers: {} })
          return
        }
        const answers = Object.fromEntries(
          Object.entries(p.answers)
            .map(([qid, list]) => [qid, { answers: list.map((s) => s.trim()).filter(Boolean) }])
            .filter(([, v]) => (v as { answers: string[] }).answers.length > 0)
        ) as Record<string, { answers: string[] }>
        resolve({ answers })
      }
      const ask: PermissionAsk = {
        id: key,
        build: this.state.build ?? '',
        tool: 'request_user_input',
        kind: 'question',
        input,
        questions,
        title: null,
        reason: null,
        guard: null,
        rule: null,
        agent: null
      }
      this.asks.set(key, { ask, done })
      signal.addEventListener('abort', abort, { once: true })
      this.d.emit('agent:ask', ask)
    })
  }

  private async applicationTool(
    name: string,
    args: unknown,
    id: string | number,
    signal: AbortSignal
  ): Promise<unknown> {
    const h = handlers(this.d.tools)
    if (this.lane && name !== 'status') throw new Error(`Variant ${this.lane} cannot use ${name}.`)
    switch (name) {
      case 'show_in_viewer':
        return h.show(z.object(SHAPES.show).strict().parse(args))
      case 'show_sheet':
        return h.sheet(z.object(SHAPES.sheet).strict().parse(args))
      case 'status':
        z.object({}).strict().parse(args)
        return h.status()
      case 'request_review':
        return h.request_review(z.object(SHAPES.request_review).strict().parse(args), signal)
      case 'log_round': {
        const input = z.object(SHAPES.log_round).strict().parse(args)
        if (!(await this.approval(id, 'log_round', input, signal)))
          throw new Error('The user denied log_round.')
        signal.throwIfAborted()
        return h.log_round(input)
      }
      default:
        throw new Error(`Unknown application tool: ${name}`)
    }
  }

  private async receive(m: RpcMessage): Promise<void> {
    const p = m.params
    const rpc = this.rpc
    if (!rpc) return
    if (m.method === 'account/login/completed') {
      this.loginId = null
      if (p.success) await this.account()
      else this.set({ error: String(p.error ?? 'Codex sign-in cancelled') })
      return
    }
    if (m.id !== undefined) {
      if (
        p.threadId !== this.state.sessionId ||
        (p.turnId && this.turn && p.turnId !== this.turn) ||
        this.abort.signal.aborted
      ) {
        rpc.reject(m.id, 'Request is not for the active Builder Studio turn')
        return
      }
      if (m.method === 'item/tool/call') {
        try {
          const result = (await this.applicationTool(
            String(p.tool),
            p.arguments,
            m.id,
            this.abort.signal
          )) as { content: { text: string }[] }
          if (rpc === this.rpc)
            rpc.respond(m.id, {
              success: true,
              contentItems: result.content.map((c) => ({ type: 'inputText', text: c.text }))
            })
        } catch (e) {
          if (rpc === this.rpc)
            rpc.respond(m.id, {
              success: false,
              contentItems: [
                { type: 'inputText', text: e instanceof Error ? e.message : String(e) }
              ]
            })
        }
      } else if (
        m.method === 'item/commandExecution/requestApproval' ||
        m.method === 'item/fileChange/requestApproval'
      ) {
        const shell = m.method.includes('commandExecution')
        const own = this.laneDenies(shell, p)
        if (own)
          this.emit({ type: 'note', id: `lane:${m.id}`, text: `Declined: ${own}`, error: true })
        const allowed =
          !own &&
          // a lane's own edits are what the workspace sandbox allows anyway, and Auto never asks
          ((!!this.lane && (!shell || this.state.mode === 'auto')) ||
            (await this.approval(m.id, shell ? 'shell' : 'file changes', p, this.abort.signal)))
        if (rpc === this.rpc) rpc.respond(m.id, { decision: allowed ? 'accept' : 'decline' })
      } else if (m.method === 'item/tool/requestUserInput') {
        const response = await this.userInput(m.id, p, this.abort.signal)
        if (rpc === this.rpc) rpc.respond(m.id, response)
      } else if (m.method === 'mcpServer/elicitation/request') {
        // shortcut: form elicitations are accepted with no content, add a form card if a server needs one
        const allowed = await this.approval(
          m.id,
          `mcp · ${String(p.serverName)}`,
          p,
          this.abort.signal
        )
        if (rpc === this.rpc)
          rpc.respond(m.id, { action: allowed ? 'accept' : 'decline', content: null, _meta: null })
      } else rpc.reject(m.id, 'Unsupported server request; no permissions granted')
      return
    }
    if (p.threadId !== this.state.sessionId) return
    if (m.method === 'turn/started') this.turn = (p.turn as { id: string }).id
    if (m.method === 'item/agentMessage/delta')
      this.emit({
        type: 'text',
        id: String(p.itemId),
        text: String(p.delta),
        parent: null,
        delta: true
      })
    if (m.method === 'item/plan/delta')
      this.emit({
        type: 'text',
        id: String(p.itemId),
        text: String(p.delta),
        parent: null,
        delta: true,
        plan: true
      })
    if (m.method === 'item/started' || m.method === 'item/completed') {
      const item = Item.parse(p.item) as CodexItem
      if (this.lane && item.type === 'fileChange')
        this.edits.set(
          item.id,
          ((item.changes as { path: string }[] | undefined) ?? []).map((c) => c.path)
        )
      if (item.type !== 'userMessage')
        for (const event of codexEvents(item, m.method === 'item/completed')) this.emit(event)
    }
    if (m.method === 'thread/tokenUsage/updated') {
      const usage = p.tokenUsage as {
        total: {
          inputTokens: number
          outputTokens: number
          cachedInputTokens?: number
          cacheWriteInputTokens?: number
          reasoningOutputTokens?: number
        }
        last: { totalTokens: number }
        modelContextWindow: number | null
      }
      this.set({
        usage: {
          input: usage.total.inputTokens,
          output: usage.total.outputTokens,
          cacheRead: usage.total.cachedInputTokens ?? null,
          cacheWrite: usage.total.cacheWriteInputTokens ?? null,
          reasoning: usage.total.reasoningOutputTokens ?? null
        },
        context: usage.modelContextWindow
          ? { tokens: usage.last.totalTokens, max: usage.modelContextWindow }
          : null
      })
    }
    if (m.method === 'thread/prediction/updated') {
      const result = p.result as { type?: string; text?: string | null } | undefined
      if (
        this.state.status === 'idle' &&
        p.sourceTurnId === this.lastCompletedTurn &&
        result?.type === 'completed' &&
        typeof result.text === 'string' &&
        result.text.trim()
      )
        this.emit({
          type: 'suggestion',
          id: `pred:${String(p.sourceTurnId)}`,
          text: result.text.trim()
        })
    }
    if (m.method === 'error') {
      const e = p.error as { message: string }
      this.emit({ type: 'note', id: `error:${Date.now()}`, text: e.message, error: true })
    }
    if (m.method === 'turn/completed') {
      this.abort.abort()
      const turn = p.turn as { id: string; status: string; error?: { message: string } }
      if (this.state.sessionId) this.d.checkpoint?.(this.state.sessionId, turn.id)
      this.turn = null
      const error =
        turn.error?.message ?? (turn.status !== 'completed' ? `Provider turn ${turn.status}` : null)
      this.set({ status: 'idle', error })
      if (this.state.sessionId && this.state.build)
        this.remember(
          this.state.sessionId,
          this.state.build,
          this.owned(this.state.sessionId).title
        )
      this.emit({
        type: 'turn-end',
        id: turn.id,
        text: error ?? turn.status,
        error: turn.status !== 'completed'
      })
      if (
        this.provider === 'codex' &&
        !this.lane &&
        turn.status === 'completed' &&
        this.state.mode !== 'plan' &&
        this.state.sessionId
      ) {
        this.lastCompletedTurn = turn.id
        void rpc
          .request('thread/prediction/request', {
            threadId: this.state.sessionId,
            sourceTurnId: turn.id
          })
          .catch(() => undefined)
      }
    }
  }

  async sessions(build: string): Promise<AgentSession[]> {
    return Object.entries(this.index())
      .filter(
        ([, s]) =>
          s.workspace === this.d.settings().workspace &&
          s.build === build &&
          s.endpoint === this.endpoint()
      )
      .map(([id, s]) => ({
        provider: this.provider,
        id,
        title: s.title,
        tag: build,
        modified: s.modified
      }))
      .sort((a, b) => b.modified - a.modified)
  }
  async history(id: string): Promise<AgentMsg[]> {
    return (await this.turns(id)).flatMap((t) => {
      let tagged = false
      return [
        ...t.items.flatMap((i) =>
          codexEvents(i, true).map((e) => {
            if (e.type === 'user' && !tagged) {
              tagged = true
              return { ...e, point: t.id }
            }
            return e
          })
        ),
        {
          type: 'turn-end' as const,
          id: t.id,
          text: t.error?.message ?? t.status,
          error: t.status === 'failed'
        }
      ]
    })
  }

  private async turns(id: string): Promise<Thread['turns']> {
    this.owned(id)
    const rpc = await this.ready()
    const turns: Thread['turns'] = []
    let cursor: string | null = null
    do {
      const page: { data: Thread['turns']; nextCursor: string | null } = await rpc.request(
        'thread/turns/list',
        { threadId: id, cursor, sortDirection: 'asc', itemsView: 'full' }
      )
      turns.push(...page.data)
      cursor = page.nextCursor
    } while (cursor)
    return turns
  }
  /** A copy of the thread to continue apart from it; tag is the build, or <build>#<lane> for a variant lane.
   *  When `point` is given, forks through that turn (inclusive) and drops later turns. */
  async fork(id: string, tag: string, point?: string): Promise<string> {
    if (!point) return this.forkThread(id, tag)
    const turns = await this.turns(id)
    const at = turns.findIndex(
      (t) => t.id === point && t.items.some((i) => i.type === 'userMessage')
    )
    if (at < 0) throw new Error('That turn is no longer in the conversation.')
    return this.forkThread(id, tag, at === turns.length - 1 ? undefined : turns[at].id)
  }

  async rewindPoints(id: string): Promise<{ id: string; text: string }[]> {
    return (await this.turns(id)).flatMap((t) =>
      t.items
        .flatMap((i) =>
          codexEvents(i, true).flatMap((e) =>
            e.type === 'user' ? [{ id: t.id, text: e.text }] : []
          )
        )
        .slice(0, 1)
    )
  }

  async rewind(id: string, tag: string, point: string): Promise<string | null> {
    const turns = await this.turns(id)
    const at = turns.findIndex(
      (t) => t.id === point && t.items.some((i) => i.type === 'userMessage')
    )
    if (at < 0) throw new Error('That turn is no longer in the conversation.')
    if (at === 0) return null
    return this.forkThread(id, tag, turns[at - 1].id)
  }

  private async forkThread(id: string, tag: string, lastTurnId?: string): Promise<string> {
    const { title } = this.owned(id)
    const rpc = await this.ready()
    const result = await rpc.request<ThreadResult>('thread/fork', {
      threadId: id,
      ...(lastTurnId ? { lastTurnId, excludeTurns: true } : {})
    })
    const fork = z.uuid().parse(result.thread.id)
    this.remember(fork, tag, title)
    // the fork stays loaded, and write-locked, in this app-server: the sessions owner (no session of its own) shuts
    // its server so a panel thread can resume the fork; a lane forks for itself and continues it here
    if (!this.lane && !this.state.sessionId && !this.authenticating) this.close()
    return fork
  }

  /** Codex starts MCP servers with the thread, so the thread is reopened with the server on or off. */
  async mcpToggle(name: string, enabled: boolean): Promise<void> {
    const { sessionId, build, mode, model, effort, status } = this.state
    if (!sessionId || !build)
      throw new Error('Send a message first: MCP servers start with the session.')
    if (status === 'running' || status === 'starting')
      throw new Error('Wait for the agent before switching MCP servers.')
    if (enabled) this.disabled.delete(name)
    else this.disabled.add(name)
    const wasPlan = this.threadPlanMode
    this.close()
    // reopen with the project's target, as send() does, so the thread keeps its Minecraft version
    const s = this.d.projectSettings?.(build) ?? this.d.settings()
    this.minecraftVersion = s.minecraftVersion
    const epoch = this.epoch
    this.set({ status: 'starting' })
    try {
      const rpc = await this.ready(s)
      const result = await rpc.request<ThreadResult>('thread/resume', {
        ...this.threadOptions(mode, model, s),
        threadId: sessionId
      })
      if (epoch !== this.epoch) throw new Error('Agent start cancelled')
      this.threadPlanMode = wasPlan
      this.set({ status: 'idle', build, sessionId, mode, model: result.model, effort })
    } catch (e) {
      if (epoch === this.epoch) this.fail(e)
      throw e
    }
  }
  async rename(id: string, title: string): Promise<void> {
    const session = this.owned(id)
    const rpc = await this.ready()
    await rpc.request('thread/name/set', { threadId: id, name: title })
    this.remember(id, session.build, title)
  }
  async remove(id: string): Promise<void> {
    this.owned(id)
    const rpc = await this.ready()
    await rpc.request('thread/archive', { threadId: id })
    const index = this.index()
    delete index[id]
    writeAtomic(join(this.d.home, 'sessions.json'), JSON.stringify(index, null, 2))
  }
  /** The workspace's enabled skills, offered after $. */
  async commands(): Promise<AgentCommand[]> {
    return (await this.skills(await this.ready())).map((k) => ({
      name: k.name,
      description: k.description,
      hint: ''
    }))
  }
  async mcp(): Promise<McpStatus[]> {
    const rpc = this.rpc
    if (!rpc || !this.state.sessionId) return []
    const list: McpStatus[] = []
    let cursor: string | null = null
    do {
      const page: {
        data: {
          name: string
          runtimeStatus: string | null
          pluginId: string | null
          toolsError: string | null
        }[]
        nextCursor: string | null
      } = await rpc.request('mcpServerStatus/list', {
        threadId: this.state.sessionId,
        detail: 'toolsAndAuthOnly',
        cursor
      })
      for (const m of page.data.filter((x) => !this.disabled.has(x.name)))
        list.push({
          name: m.name,
          status: m.runtimeStatus ?? 'notStarted',
          scope: m.pluginId ? 'plugin' : 'config',
          error: m.toolsError
        })
      cursor = page.nextCursor
    } while (cursor)
    // a server switched off is not started at all, so it is listed here to switch it back on
    for (const name of this.disabled)
      list.push({ name, status: 'disabled', scope: 'config', error: null })
    return list
  }
  async models(): Promise<AgentModel[]> {
    if (this.provider === 'ollama') {
      const model = this.d.settings().ollamaModel
      return model ? [{ value: model, name: model }] : []
    }
    const rpc = await this.ready()
    const result = await rpc.request<{
      data: {
        model: string
        displayName: string
        hidden: boolean
        isDefault?: boolean
        supportedReasoningEfforts?: { reasoningEffort: string }[]
        defaultReasoningEffort?: string
      }[]
    }>('model/list', {})
    return result.data
      .filter((m) => !m.hidden)
      .map((m) => ({
        value: m.model,
        name: m.displayName,
        isDefault: m.isDefault,
        efforts:
          m.supportedReasoningEfforts &&
          EFFORTS.filter((e) =>
            m.supportedReasoningEfforts?.some((option) => option.reasoningEffort === e)
          ),
        defaultEffort: EFFORTS.find((e) => e === m.defaultReasoningEffort)
      }))
  }
}
