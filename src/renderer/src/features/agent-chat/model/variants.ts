// The Variants screen's store: one transcript, ask list and state per lane, fed by main's variant:* events.
import { create } from 'zustand'
import type { AgentState, PermissionAsk } from '@shared/api'
import { studio } from '@/shared/api/studio'
import { reduce, type Item } from './transcript'

export interface Lane {
  items: Item[]
  asks: PermissionAsk[]
  state: AgentState | null
}
const empty = (): Lane => ({ items: [], asks: [], state: null })

/** What the round was started with, for its header and each lane's "Tries:" line (this window only). */
export interface Round {
  part: string
  brief: string
  forked: boolean
  tries: Record<string, string>
}

export const useVariants = create<{
  build: string | null
  lanes: Record<string, Lane>
  round?: Round
}>(() => ({
  build: null,
  lanes: {}
}))

const patch = (lane: string, f: (l: Lane) => Partial<Lane>): void =>
  useVariants.setState((s) => {
    const l = s.lanes[lane] ?? empty()
    return { lanes: { ...s.lanes, [lane]: { ...l, ...f(l) } } }
  })

studio.variants.onMsg(({ lane, data }) => patch(lane, (l) => ({ items: reduce(l.items, data) })))
studio.variants.onState(({ lane, data }) => patch(lane, () => ({ state: data })))
studio.variants.onAsk(({ lane, data: a }) =>
  patch(lane, (l) => ({
    asks:
      'done' in a
        ? l.asks.filter((x) => x.id !== a.done)
        : [...l.asks.filter((x) => x.id !== a.id), a]
  }))
)
void studio.variants.state().then((st) => {
  const build = Object.values(st).find((s) => s.build)?.build ?? null
  for (const [lane, state] of Object.entries(st)) patch(lane, () => ({ state }))
  useVariants.setState({ build })
})
void studio.variants
  .pending()
  .then((p) => p.forEach(({ lane, ask }) => patch(lane, (l) => ({ asks: [...l.asks, ask] }))))

/** Starts fresh transcripts for these lanes; main forks or starts their sessions. */
export function begin(build: string, prompts: Record<string, string>, round?: Round): void {
  useVariants.setState({
    build,
    round,
    lanes: Object.fromEntries(
      Object.entries(prompts).map(([l, text]) => [
        l,
        { ...empty(), items: [{ kind: 'user', id: `me:${l}`, text }] }
      ])
    )
  })
}

export function addUser(lane: string, text: string): void {
  patch(lane, (l) => ({ items: [...l.items, { kind: 'user', id: `me:${Date.now()}`, text }] }))
}

export function addError(lane: string, e: unknown): void {
  const text = String(e).replace(/^Error: (Error invoking remote method '[^']+': )?(Error: )?/, '')
  patch(lane, (l) => ({
    items: [...l.items, { kind: 'note', id: `err:${Date.now()}`, text, error: true }]
  }))
}
