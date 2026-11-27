// The Agent panel's store: one thread per conversation, several live at once, each with its transcript, open
// permission asks and agent state, fed by main's agent:* events. A thread belongs to `build`; `session` is the
// stored session its next send resumes. `primary` is the provider's own state (login, models, provider switch).
import { errorMessage } from '@/shared/ui/feedback/errors'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  CAPABILITIES,
  EFFORTS,
  type AgentModel,
  type AgentMode,
  type AgentState,
  type Effort,
  type PermissionAsk,
  type Provider,
  type SessionRef
} from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'
import { reduce, reduceLive, type Item } from './transcript'

export type Thread = {
  id: string
  build: string
  session: string | null
  title: string | null // the next new session's title
  items: Item[]
  asks: PermissionAsk[]
  suggestion: string | null
  state: AgentState
  mode: AgentMode
}

interface AgentStore {
  active: string // '' until a build is open
  threads: Record<string, Thread> // in creation order
  primary: AgentState
  loading: boolean // main's live threads, or a stored session's history, are on their way
}

export const useAgent = create<AgentStore>(() => ({
  active: '',
  threads: {},
  loading: true,
  primary: {
    provider: 'claude',
    capabilities: CAPABILITIES.claude,
    usage: null,
    build: null,
    sessionId: null,
    status: 'off',
    mode: 'default',
    model: null,
    effort: null,
    context: null,
    cost: 0,
    auth: null,
    error: null
  }
}))

/** What the user picked and keeps across restarts. */
type Prefs = {
  open: boolean
  model: string | null
  effort: Effort | null
  provider: Provider
  picks: Partial<Record<Provider, { model: string | null; effort: Effort | null }>>
  mode: AgentMode // the last mode picked other than plan; new threads start in it
}
export const useAgentPrefs = create<Prefs>()(
  persist<Prefs>(
    () => ({
      open: false,
      model: null,
      effort: null,
      provider: 'claude',
      picks: {},
      mode: 'auto'
    }),
    {
      name: 'agent-prefs'
    }
  )
)

export const agentModelsQuery = (
  provider: Provider
): { queryKey: readonly ['agent-models', Provider]; queryFn: () => Promise<AgentModel[]> } => ({
  queryKey: ['agent-models', provider],
  queryFn: () => studio.agent.models()
})

export function resolveAgentPrefs(
  provider: Provider,
  prefs: Pick<Prefs, 'model' | 'effort'>,
  models: AgentModel[] = []
): Pick<Prefs, 'model' | 'effort'> & { efforts: readonly Effort[] } {
  const model =
    provider === 'ollama'
      ? (models[0]?.value ?? null)
      : (prefs.model ??
        (provider === 'claude'
          ? 'sonnet'
          : (models.find((option) => option.isDefault)?.value ?? models[0]?.value ?? null)))
  const option = models.find((option) => option.value === model)
  const efforts = CAPABILITIES[provider].effort ? (option?.efforts ?? EFFORTS) : []
  const candidates = [prefs.effort, 'medium', option?.defaultEffort] as const
  const effort = candidates.find((e) => e && efforts.includes(e)) ?? efforts[0] ?? null
  return { model, effort, efforts }
}

export const effortLabel = (effort: Effort): string =>
  effort === 'xhigh' ? 'Extra high' : effort[0].toUpperCase() + effort.slice(1)

export async function requestAgentPrefs(
  provider: Provider
): Promise<Pick<Prefs, 'model' | 'effort'>> {
  const prefs = useAgentPrefs.getState()
  const query = agentModelsQuery(provider)
  const models =
    provider === 'claude'
      ? queryClient.getQueryData<AgentModel[]>(query.queryKey)
      : await queryClient.ensureQueryData(query)
  const resolved = resolveAgentPrefs(provider, prefs, models)
  if (!resolved.model)
    throw new Error('No models are available. Check your AI provider in Settings.')
  return resolved
}

export const busy = (s: AgentState): boolean => s.status === 'running' || s.status === 'starting'

/** The remembered mode, where this provider offers it. */
export const startMode = (primary: AgentState): AgentMode => {
  const { mode } = useAgentPrefs.getState()
  return primary.capabilities.modes.includes(mode) ? mode : 'default'
}

const blank = (id: string, build: string, primary: AgentState): Thread => ({
  id,
  build,
  session: null,
  title: null,
  items: [],
  asks: [],
  suggestion: null,
  mode: startMode(primary),
  state: {
    ...primary,
    build,
    sessionId: null,
    status: 'off',
    mode: 'default',
    context: null,
    usage: null,
    error: null
  }
})
/** A thread nothing has happened in yet; switching away drops it. */
const pristine = (t: Thread | undefined): boolean =>
  !!t && !t.session && !t.items.length && t.state.status === 'off'

// the stand-in while no thread is active, cached so selectors that return it stay stable
// (keyed on primary itself: blank() copies it into a new state object)
let none: { primary: AgentState; thread: Thread } | null = null
const empty = (primary: AgentState): Thread =>
  none?.primary === primary
    ? none.thread
    : (none = { primary, thread: blank('', '', primary) }).thread

/** The active thread (an empty stand-in, build '', while there is none). */
export const activeThread = (s: AgentStore): Thread => s.threads[s.active] ?? empty(s.primary)
/** Reads the active thread, see activeThread. */
export const useThread = <T>(selector: (t: Thread) => T): T =>
  useAgent((s) => selector(activeThread(s)))

/** Another thread is working on the active thread's build: their edits can collide. */
export const useSiblingBusy = (): boolean =>
  useAgent((s) => {
    const a = s.threads[s.active]
    return (
      !!a &&
      Object.values(s.threads).some((t) => t.id !== a.id && t.build === a.build && busy(t.state))
    )
  })

function patch(id: string, f: (t: Thread) => Partial<Thread>): void {
  useAgent.setState((s) =>
    s.threads[id]
      ? { threads: { ...s.threads, [id]: { ...s.threads[id], ...f(s.threads[id]) } } }
      : s
  )
}
const fail = (id: string) => (e: unknown) =>
  patch(id, (t) => ({
    items: [
      ...t.items,
      { kind: 'note', id: `err:${Date.now()}`, text: errorMessage(e), error: true }
    ]
  }))

/** Makes `id` active (adding `extra` threads first) and drops the active thread if nothing happened in it. */
export function activate(id: string, extra: Thread[] = []): void {
  useAgent.setState((s) => {
    const threads = { ...s.threads, ...Object.fromEntries(extra.map((t) => [t.id, t])) }
    if (s.active !== id && pristine(s.threads[s.active])) delete threads[s.active]
    return { active: id, threads }
  })
}

function receivePrimary(state: AgentState): void {
  const prefs = useAgentPrefs.getState()
  if (prefs.provider !== state.provider) {
    const picks = { ...prefs.picks, [prefs.provider]: { model: prefs.model, effort: prefs.effort } }
    useAgentPrefs.setState({
      provider: state.provider,
      picks,
      ...(picks[state.provider] ?? { model: null, effort: null })
    })
  }
  const s = useAgent.getState()
  if (s.primary.provider === state.provider) return useAgent.setState({ primary: state })
  // main closed every thread on the switch; keep the panel on its build with an empty one
  const build = s.threads[s.active]?.build
  useAgent.setState({ primary: state, threads: {}, active: '' })
  if (build) newThread(build)
}
function receiveState(id: string, state: AgentState): void {
  const t = useAgent.getState().threads[id]
  if (!t) {
    if (state.build)
      useAgent.setState((s) => ({
        threads: {
          ...s.threads,
          [id]: {
            ...blank(id, state.build!, s.primary),
            session: state.sessionId,
            state,
            mode: state.mode
          }
        }
      }))
    return
  }
  if (state.provider === 'claude' && state.sessionId && !t.session) {
    void queryClient.invalidateQueries({ queryKey: agentModelsQuery(state.provider).queryKey })
  }
  patch(id, (t) => ({
    state,
    ...(busy(state) ? { suggestion: null } : {}),
    ...(state.status !== 'off' ? { mode: state.mode } : {}),
    ...(state.build === t.build && state.sessionId ? { session: state.sessionId } : {})
  }))
}

studio.agent.onMsg(({ thread, data }) => {
  if (thread) {
    if (data.type === 'suggestion')
      patch(thread, (t) => ({
        suggestion: !busy(t.state) && !t.asks.length ? data.text : null
      }))
    else
      patch(thread, (t) => ({
        items: reduceLive(t.items, data),
        ...(data.type === 'user' || data.type === 'text' || data.type === 'tool'
          ? { suggestion: null }
          : {})
      }))
  }
  if (data.type === 'turn-end') void queryClient.invalidateQueries({ queryKey: ['agent-sessions'] })
})
studio.agent.onState(({ thread, data }) =>
  thread ? receiveState(thread, data) : receivePrimary(data)
)
studio.agent.onAsk(({ thread, data }) => {
  if (thread)
    patch(thread, (t) => ({
      asks:
        'done' in data
          ? t.asks.filter((x) => x.id !== data.done)
          : [...t.asks.filter((x) => x.id !== data.id), data],
      ...('done' in data ? {} : { suggestion: null })
    }))
})
void studio.agent
  .state()
  .then(({ primary, threads }) => {
    receivePrimary(primary)
    for (const [id, state] of Object.entries(threads)) receiveState(id, state)
    // the panel may have opened an empty thread before main's live ones arrived
    const s = useAgent.getState()
    const live = Object.values(s.threads).findLast((t) => t.build === s.threads[s.active]?.build)
    if (live && pristine(s.threads[s.active])) activate(live.id)
  })
  .finally(() => useAgent.setState({ loading: false }))
void studio.agent.pending().then((asks) => {
  for (const { thread, ask } of asks) patch(thread, (t) => ({ asks: [...t.asks, ask] }))
})

/** A new empty thread on `build`, now active; its first send starts a new session titled `title`. */
export function newThread(build: string, title: string | null = null): string {
  const id = crypto.randomUUID()
  activate(id, [{ ...blank(id, build, useAgent.getState().primary), title }])
  return id
}

/** Shows a build's most recent thread, or an empty new one. Running threads keep running. */
export function follow(build: string): void {
  const s = useAgent.getState()
  if (s.threads[s.active]?.build === build) return
  const last = Object.values(s.threads).findLast((t) => t.build === build)
  if (last) activate(last.id)
  else newThread(build)
}

/** Switches to the thread holding `ref`, or opens it with its history in a new thread on the active build. */
export async function openSession(ref: SessionRef, onBuild?: string): Promise<void> {
  const s = useAgent.getState()
  const live = Object.values(s.threads).find((t) => t.session === ref.id)
  if (live) return activate(live.id)
  const build = onBuild ?? s.threads[s.active]?.build
  if (!build) return
  useAgent.setState({ loading: true })
  const msgs = await studio.agent.history(ref).finally(() => useAgent.setState({ loading: false }))
  if (ref.provider !== useAgent.getState().primary.provider) return
  const id = crypto.randomUUID()
  activate(id, [
    {
      ...blank(id, build, useAgent.getState().primary),
      session: ref.id,
      items: msgs.reduce((acc, m) => reduce(acc, m), [] as Item[])
    }
  ])
}

export function setThreadTitle(id: string, title: string): void {
  patch(id, () => ({ title }))
}

export async function send(
  text: string,
  opts: { title?: string; attachments?: string[]; command?: boolean } = {}
): Promise<void> {
  const { active, threads, primary } = useAgent.getState()
  const t = threads[active]
  if (!t) return
  const attachments = opts.attachments?.length ? opts.attachments : undefined
  const itemId = `me:${crypto.randomUUID()}`
  if (!opts.command)
    patch(active, (t) => ({
      title: t.session ? t.title : null,
      suggestion: null,
      items: [
        ...t.items,
        {
          kind: 'user',
          id: itemId,
          text,
          timestamp: Date.now(),
          ...(attachments ? { attachments } : {})
        }
      ]
    }))
  else patch(active, () => ({ suggestion: null }))
  await requestAgentPrefs(primary.provider)
    .then(({ model, effort }) =>
      studio.agent.send(active, {
        provider: primary.provider,
        build: t.build,
        text,
        resume: t.session ? { provider: primary.provider, id: t.session } : null,
        model,
        effort,
        title: t.session ? undefined : (opts.title ?? t.title ?? undefined),
        mode: t.mode,
        attachments
      })
    )
    .then((point) => {
      if (point && !opts.command)
        patch(active, (cur) => ({
          items: cur.items.map((x) => (x.kind === 'user' && x.id === itemId ? { ...x, point } : x))
        }))
    })
    .catch(fail(active))
}

/** The active thread's mode; a live thread switches now, an idle one on its next send. */
export async function setMode(mode: AgentMode): Promise<void> {
  const { active, threads } = useAgent.getState()
  if (!threads[active]) return
  patch(active, () => ({ mode }))
  if (mode !== 'plan') useAgentPrefs.setState({ mode })
  if (threads[active].state.status !== 'off')
    await studio.agent.setMode(active, mode).catch(fail(active))
}

/** Clears the active thread's ghost-text prompt suggestion. */
export function dismissSuggestion(): void {
  const { active } = useAgent.getState()
  if (active) patch(active, () => ({ suggestion: null }))
}

/** Implements a Codex plan (with optional user edits), switching back to the remembered working mode. */
export async function implementPlan(editedPlan?: string): Promise<void> {
  const mode = startMode(useAgent.getState().primary)
  await setMode(mode)
  await send(
    editedPlan !== undefined
      ? `Implement this updated plan:\n\n${editedPlan}`
      : 'Implement the plan.'
  )
}

/** Sends revision feedback for a Codex plan while staying in Plan mode. */
export async function revisePlan(feedback: string): Promise<void> {
  const text = feedback.trim()
  if (!text) return
  if (activeThread(useAgent.getState()).mode !== 'plan') await setMode('plan')
  await send(text)
}

/** Stops the active thread's turn; its session stays live. */
export async function interrupt(): Promise<void> {
  const { active } = useAgent.getState()
  if (active) await studio.agent.interrupt(active)
}

/** Ends a thread's live session (it stays resumable from the session list) and drops it from the panel. */
export async function closeThread(id: string): Promise<void> {
  const t = useAgent.getState().threads[id]
  if (!t) return
  await studio.agent.close(id)
  useAgent.setState((s) => {
    const threads = { ...s.threads }
    delete threads[id]
    return { threads, active: s.active === id ? '' : s.active }
  })
  if (!useAgent.getState().active) follow(t.build)
}
