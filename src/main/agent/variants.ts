// Parallel variant sessions: A/B/C agents on one build at once, each its own agent service ("lane") on the selected
// provider. Two agents must never edit the same files, so a lane writes only builds/<build>/<stem>_<L>.<ext> and runs
// builds only with --name <name>_<L>; laneGuard (main/lanes.ts) enforces that on every tool call or approval request,
// whatever the prompt said.
import type { AgentState, Permit, PermissionAsk, Provider, VariantStart } from '@shared/api'
import type { AgentDeps } from './agent'
import type { Service } from './provider-agent'

export class VariantService {
  private lanes = new Map<string, Service>()

  constructor(
    private make: (lane: string, emit: AgentDeps['emit']) => Service,
    private provider: () => Provider,
    private broadcast: (channel: string, payload: unknown) => void,
    private cap: () => number
  ) {}

  private lane(l: string): Service {
    let a = this.lanes.get(l)
    // a lane made for another provider is replaced (provider changes need every lane off)
    if (!a || a.state.provider !== this.provider()) {
      a?.close()
      // agent:msg -> variant:msg and so on, tagged with the lane
      const emit: AgentDeps['emit'] = (ch, data) =>
        this.broadcast(ch.replace('agent:', 'variant:'), { lane: l, data })
      a = this.make(l, emit)
      this.lanes.set(l, a)
    }
    return a
  }

  private running(): string[] {
    return [...this.lanes]
      .filter(([, a]) => a.state.status === 'running' || a.state.status === 'starting')
      .map(([l]) => l)
  }

  /** Forks `from` (the main panel's session) per lane, or starts fresh, and sends each lane its prompt. */
  async start(v: VariantStart): Promise<void> {
    const provider = this.provider()
    const lanes: string[] = v.lanes.map((x) => x.lane)
    const busy = this.running()
    if (new Set(lanes).size !== lanes.length) throw new Error('each variant needs its own letter')
    for (const l of lanes) if (busy.includes(l)) throw new Error(`variant ${l} is still running`)
    if (busy.length + lanes.length > this.cap())
      throw new Error(
        `at most ${this.cap()} variants at once (Settings); ${busy.join(', ')} still running`
      )
    for (const { lane, text } of v.lanes) {
      const s = this.lane(lane)
      s.close()
      // the lane forks for itself: a Codex fork stays write-locked in the app-server that made it
      const resume = v.from ? await s.fork(v.from, `${v.build}#${lane}`) : null
      await s.send({
        provider,
        build: v.build,
        text,
        resume: resume ? { provider, id: resume } : null,
        model: v.model,
        effort: v.effort,
        title: `${v.build} · variant ${lane}`,
        mode: v.mode === 'plan' ? 'default' : v.mode
      })
    }
  }

  async send(lane: string, text: string): Promise<void> {
    const a = this.lanes.get(lane)
    if (!a?.state.build) throw new Error(`no variant ${lane}`)
    if (!this.running().includes(lane) && this.running().length >= this.cap())
      throw new Error(`at most ${this.cap()} variants at once (Settings)`)
    const { provider, build, sessionId, model, effort, mode } = a.state
    if (provider !== this.provider()) throw new Error(`variant ${lane} ran on another provider`)
    await a.send({
      provider,
      build,
      text,
      resume: sessionId ? { provider, id: sessionId } : null,
      model,
      effort,
      mode
    })
  }

  interrupt(lane: string): Promise<void> {
    return this.lanes.get(lane)?.interrupt() ?? Promise.resolve()
  }

  /** Ends every lane's live query (the sessions stay resumable). */
  closeAll(): void {
    for (const a of this.lanes.values()) a.close()
  }

  reset(): void {
    this.closeAll()
    this.lanes.clear()
  }

  state(): Record<string, AgentState> {
    return Object.fromEntries([...this.lanes].map(([l, a]) => [l, a.state]))
  }

  pending(): { lane: string; ask: PermissionAsk }[] {
    return [...this.lanes].flatMap(([lane, a]) => a.pending().map((ask) => ({ lane, ask })))
  }

  permit(lane: string, p: Permit): void {
    this.lanes.get(lane)?.permit(p)
  }
}
