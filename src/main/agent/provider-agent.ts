import { join } from 'path'
import type {
  AgentCommand,
  AgentMode,
  AgentRewindPoint,
  AgentRewindPreview,
  AgentSend,
  AgentState,
  Effort,
  McpStatus,
  PermissionAsk,
  Permit,
  Provider,
  ProviderDiagnostic,
  SessionRef
} from '@shared/api'
import { AgentService, NO_KEY, type AgentDeps } from './agent'
import { CodexAgent } from './codex-agent'
import { claudePrerequisites, ollamaModels, providerExecutable } from './provider-config'
import { AgentCheckpoints } from './agent-checkpoints'

/** At most this many threads hold a live session; a new one closes the oldest idle thread. */
export const MAX_LIVE = 4
export type Service = AgentService | CodexAgent
const working = (s: AgentState): boolean => s.status === 'running' || s.status === 'starting'

/** Dispatch at the process boundary, one service per Agent panel thread (like VariantService lanes).
 * The primary service never sends: it owns Codex sign-in, stored sessions and models. VariantService lanes are
 * made here too (lane()), so they run on whichever provider is selected. */
export class ProviderAgent {
  private primary: Service
  private provider: Provider
  // least recently sent first, so eviction takes the first idle one
  private threads = new Map<string, Service>()
  private checkpoints = new AgentCheckpoints()
  private rewinding = new Set<string>()

  constructor(
    private d: AgentDeps,
    private home: string,
    private openAuth: (url: string) => Promise<void>
  ) {
    this.provider = d.settings().provider
    this.primary = this.create(null)
  }
  // shortcut: one app-server per thread, multiplex one connection if memory becomes a problem
  private make(
    emit: AgentDeps['emit'],
    lane: string | null,
    checkpoint?: AgentDeps['checkpoint']
  ): Service {
    return this.provider === 'claude'
      ? new AgentService({ ...this.d, emit, checkpoint }, lane)
      : new CodexAgent(
          {
            ...this.d,
            emit,
            checkpoint,
            home: join(this.home, this.provider),
            openAuth: this.openAuth
          },
          this.provider,
          lane
        )
  }
  private create(thread: string | null): Service {
    let wasWorking = false
    return this.make(
      (ch, data) => {
        if (thread && ch === 'agent:state') {
          const state = data as AgentState
          if (state.status === 'off' && wasWorking) this.checkpoints.cancel(thread)
          wasWorking = working(state)
        }
        this.d.emit(ch, { thread, data })
      },
      null,
      thread ? (session, turn) => this.checkpoints.finish(thread, session, turn) : undefined
    )
  }
  /** A parallel variant lane (main/variants.ts) on the selected provider, held to its own files. */
  lane(lane: string, emit: AgentDeps['emit']): Service {
    return this.make(emit, lane)
  }
  get selected(): Provider {
    return this.provider
  }
  state(): { primary: AgentState; threads: Record<string, AgentState> } {
    return {
      primary: this.primary.state,
      threads: Object.fromEntries([...this.threads].map(([id, t]) => [id, t.state]))
    }
  }
  get authenticating(): boolean {
    return this.primary instanceof CodexAgent && this.primary.authenticating
  }
  busy(): boolean {
    return (
      this.authenticating ||
      this.rewinding.size > 0 ||
      [...this.threads.values()].some((t) => working(t.state))
    )
  }
  select(): void {
    this.closeAll()
    this.primary.close()
    this.provider = this.d.settings().provider
    this.primary = this.create(null)
    this.d.emit('agent:state', { thread: null, data: this.primary.state })
  }
  private check(ref: SessionRef): void {
    if (ref.provider !== this.provider)
      throw new Error('Select this session’s provider in Settings before opening it.')
  }
  private liveIn(id: string): string | undefined {
    return [...this.threads].find(
      ([, t]) => t.state.status !== 'off' && t.state.sessionId === id
    )?.[0]
  }
  async send(thread: string, a: AgentSend): Promise<string | undefined> {
    if (a.provider !== this.provider)
      throw new Error('Provider changed. Reopen the Agent panel before sending.')
    if (a.resume) this.check(a.resume)
    if (this.authenticating) throw new Error('Finish or cancel Codex sign-in before sending.')
    if (this.rewinding.has(a.build)) throw new Error('Wait for the conversation rewind to finish.')
    const holder = a.resume && this.liveIn(a.resume.id)
    if (holder && holder !== thread)
      throw new Error('This session is already open in another thread. Switch to that thread.')
    let s = this.threads.get(thread)
    if (s && working(s.state)) {
      if (s instanceof AgentService) this.checkpoints.cancel(thread)
      return s.send(a)
    }
    if (!s || s.state.status === 'off') this.makeRoom()
    s ??= this.create(thread)
    this.threads.delete(thread)
    this.threads.set(thread, s)
    if (!/^\/compact(?:\s|$)/.test(a.text)) {
      const isolated = ![...this.threads].some(
        ([id, t]) => id !== thread && t.state.build === a.build && working(t.state)
      )
      this.checkpoints.start(thread, this.d.settings().workspace, a.build, isolated)
    }
    try {
      return await s.send(a)
    } catch (e) {
      this.checkpoints.cancel(thread)
      throw e
    }
  }
  private makeRoom(): void {
    const live = [...this.threads.values()].filter((t) => t.state.status !== 'off')
    if (live.length < MAX_LIVE) return
    const idle = [...this.threads].find(([, t]) => t.state.status === 'idle')
    if (!idle)
      throw new Error(
        `${MAX_LIVE} agent threads are working. Wait for one to finish or stop one, then send again.`
      )
    this.close(idle[0])
  }
  async interrupt(thread: string): Promise<void> {
    await this.threads.get(thread)?.interrupt()
  }
  /** Ends the thread's live session; it stays resumable. */
  close(thread: string): void {
    this.checkpoints.cancel(thread)
    this.threads.get(thread)?.close()
    this.threads.delete(thread)
  }
  closeAll(): void {
    for (const id of [...this.threads.keys()]) this.close(id)
  }
  async configure(thread: string, model: string | null, effort: Effort | null): Promise<void> {
    await this.threads.get(thread)?.configure(model, effort)
  }
  async setMode(thread: string, mode: AgentMode): Promise<void> {
    await this.threads.get(thread)?.setMode(mode)
  }
  pending(): { thread: string; ask: PermissionAsk }[] {
    return [...this.threads].flatMap(([thread, t]) => t.pending().map((ask) => ({ thread, ask })))
  }
  permit(thread: string, p: Permit): void {
    this.threads.get(thread)?.permit(p)
  }
  /** Claude asks the thread's live session; Codex lists the workspace skills, the same for every thread. */
  commands(thread: string | null): Promise<AgentCommand[]> {
    const live = thread && this.provider === 'claude' ? this.threads.get(thread) : undefined
    return (live ?? this.primary).commands()
  }
  async mcp(thread: string | null): Promise<McpStatus[]> {
    return (await (thread ? this.threads.get(thread) : this.primary)?.mcp()) ?? []
  }
  async mcpToggle(thread: string, name: string, enabled: boolean): Promise<void> {
    const s = this.threads.get(thread)
    if (!s) throw new Error('Send a message first: MCP servers start with the session.')
    return s.mcpToggle(name, enabled)
  }
  sessions(build: string): ReturnType<AgentService['sessions']> {
    return this.primary.sessions(build)
  }
  history(ref: SessionRef): ReturnType<AgentService['history']> {
    this.check(ref)
    return this.primary.history(ref.id)
  }
  /** tag: the build, or `<build>#<lane>` for a variant lane, so lanes stay out of the panel's list. */
  async fork(ref: SessionRef, tag: string, point?: string): Promise<SessionRef> {
    this.check(ref)
    if (point) this.assertIdleSession(ref)
    return { provider: this.provider, id: await this.primary.fork(ref.id, tag, point) }
  }

  rewindPoints(ref: SessionRef): Promise<AgentRewindPoint[]> {
    this.check(ref)
    this.assertIdleSession(ref)
    return this.primary.rewindPoints(ref.id)
  }

  private assertIdleSession(ref: SessionRef): void {
    const live = this.liveIn(ref.id)
    if (live && working(this.threads.get(live)!.state))
      throw new Error('Wait for the current turn to finish before rewinding.')
  }

  private async rewindTurns(ref: SessionRef, point: string): Promise<string[]> {
    const points = await this.rewindPoints(ref)
    const at = points.findIndex((p) => p.id === point)
    if (at < 0) throw new Error('That turn is no longer in the conversation.')
    return points.slice(at).map((p) => p.id)
  }

  async rewindPreview(ref: SessionRef, build: string, point: string): Promise<AgentRewindPreview> {
    try {
      const turns = await this.rewindTurns(ref, point)
      const { files } = this.checkpoints.plan(this.d.settings().workspace, build, ref.id, turns)
      return { files, unavailable: null }
    } catch (e) {
      return { files: [], unavailable: e instanceof Error ? e.message : String(e) }
    }
  }

  async rewind(
    ref: SessionRef,
    build: string,
    point: string,
    files: string[] | null,
    assertIdle: () => void
  ): Promise<SessionRef | null> {
    this.check(ref)
    this.assertIdleSession(ref)
    if (this.rewinding.has(build)) throw new Error('A rewind is already running on this build.')
    const owned = (await this.sessions(build)).some((session) => session.id === ref.id)
    if (!owned) throw new Error('This conversation does not belong to the open build.')
    this.assertIdleSession(ref)
    if (this.rewinding.has(build)) throw new Error('A rewind is already running on this build.')
    this.rewinding.add(build)
    const service = this.primary
    try {
      const workspace = this.d.settings().workspace
      const turns = files ? await this.rewindTurns(ref, point) : []
      const plan = (): ReturnType<AgentCheckpoints['plan']> => {
        assertIdle()
        if ([...this.threads.values()].some((t) => t.state.build === build && working(t.state)))
          throw new Error('Wait for active turns on this build to finish.')
        return this.checkpoints.plan(workspace, build, ref.id, turns)
      }
      const verify = (): ReturnType<AgentCheckpoints['plan']> => {
        const current = plan()
        if (JSON.stringify(current.files) !== JSON.stringify(files))
          throw new Error('The file checkpoint changed. Preview it again.')
        return current
      }
      if (files) verify()
      const id = await service.rewind(ref.id, build, point)
      try {
        if (files) verify().apply()
      } catch (e) {
        if (id) await service.remove(id).catch(() => undefined)
        throw e
      }
      return id ? { provider: ref.provider, id } : null
    } finally {
      this.rewinding.delete(build)
    }
  }
  rename(ref: SessionRef, title: string): Promise<void> {
    this.check(ref)
    return this.primary.rename(ref.id, title)
  }
  async remove(ref: SessionRef): Promise<void> {
    this.check(ref)
    if (this.liveIn(ref.id)) throw new Error('Close the thread using this session first.')
    return this.primary.remove(ref.id)
  }
  models(): ReturnType<AgentService['models']> {
    return this.primary.models()
  }
  login(): Promise<void> {
    if (!(this.primary instanceof CodexAgent))
      throw new Error('Claude has no sign-in here. Add your Anthropic API key in Settings → AI.')
    return this.primary.login()
  }
  cancelLogin(): Promise<void> {
    return this.primary instanceof CodexAgent ? this.primary.cancelLogin() : Promise.resolve()
  }
  async diagnose(only?: Provider): Promise<ProviderDiagnostic[]> {
    const s = this.d.settings()
    return Promise.all(
      (only ? [only] : (['claude', 'codex', 'ollama'] as const)).map(async (provider) => {
        let probe: CodexAgent | undefined
        try {
          if (provider === 'claude') {
            const bash = claudePrerequisites(s)
            if (!this.d.apiKey()) throw new Error(NO_KEY)
            return {
              provider,
              ok: true,
              detail: `Claude Code found and your Anthropic API key is set${bash ? `; Git Bash: ${bash}` : ''}. The key is verified by a real turn.`
            }
          }
          providerExecutable(s)
          if (provider === 'ollama') {
            const models = await ollamaModels(s)
            if (!s.ollamaModel || !models.includes(s.ollamaModel))
              throw new Error(
                'Set an already-installed Ollama model in Settings. No models are downloaded by Builder Studio.'
              )
          }
          probe = new CodexAgent(
            { ...this.d, emit: () => {}, home: join(this.home, provider), openAuth: this.openAuth },
            provider
          )
          // A protocol handshake is checked for both providers; no inference or model download.
          await probe.checkConnection()
          if (provider === 'codex' && !(await probe.account()))
            throw new Error(
              'Codex executable works. Sign in with ChatGPT below; Builder Studio uses its own Codex credentials and sessions.'
            )
          return {
            provider,
            ok: true,
            detail:
              provider === 'ollama'
                ? 'Endpoint and installed model found. A real turn must verify Responses/tool compatibility.'
                : 'Codex app-server and app-owned login available. Model access is verified by a real turn.'
          }
        } catch (e) {
          return { provider, ok: false, detail: e instanceof Error ? e.message : String(e) }
        } finally {
          probe?.close()
        }
      })
    )
  }
}
