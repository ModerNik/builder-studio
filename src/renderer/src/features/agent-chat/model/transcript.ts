// The Agent panel's transcript: normalized live or stored provider events reduced to a flat list
// of items. Subagent items carry the Agent/Task tool call they belong to in `parent`.
import type { AgentMsg, McbEvent } from '@shared/api'
import { parseEvent } from '@shared/events'

export type Item =
  | {
      kind: 'user'
      id: string
      text: string
      attachments?: string[]
      point?: string
      timestamp?: number
    } // workspace-relative paths
  | {
      kind: 'text'
      id: string
      text: string
      parent: string | null
      live?: boolean
      plan?: boolean // a plan-mode proposal
      timestamp?: number
    }
  | {
      kind: 'tool'
      id: string
      name: string
      input: Record<string, unknown>
      parent: string | null
      result?: string
      error?: boolean
      events?: McbEvent[] // a Bash run of build.py: its @mcb lines
    }
  | { kind: 'note'; id: string; text: string; error?: boolean }

export const isBuildRun = (input: Record<string, unknown>): boolean =>
  /\bbuild\.py\b/.test(String(input.command ?? ''))

export function reduce(items: Item[], m: AgentMsg): Item[] {
  if (m.type === 'suggestion') return items
  if (m.type === 'tool-result') {
    const at = items.findIndex((x) => x.kind === 'tool' && x.id === m.id)
    if (at < 0) return items
    const t = items[at] as Extract<Item, { kind: 'tool' }>
    const events = isBuildRun(t.input)
      ? m.text.split(/\r?\n/).flatMap((l) => parseEvent(l.trim()) ?? [])
      : undefined
    return items.with(at, { ...t, result: m.text, error: m.error, events })
  }
  if (m.type === 'text') {
    const liveItem = m.replaceLive
      ? items.find((x) => x.kind === 'text' && x.id === `live:${m.parent ?? ''}`)
      : undefined
    const kept = m.replaceLive ? items.filter((x) => x.id !== `live:${m.parent ?? ''}`) : items
    const at = kept.findIndex((x) => x.id === m.id)
    const previous = kept[at]
    const timestamp =
      m.timestamp ??
      (previous?.kind === 'text' ? previous.timestamp : undefined) ??
      (liveItem?.kind === 'text' ? liveItem.timestamp : undefined)
    const item: Item = {
      kind: 'text',
      id: m.id,
      parent: m.parent,
      text: m.delta && previous?.kind === 'text' ? previous.text + m.text : m.text,
      ...(m.delta ? { live: true } : {}),
      ...(m.plan ? { plan: true } : {}),
      ...(timestamp !== undefined ? { timestamp } : {})
    }
    return at < 0 ? [...kept, item] : kept.with(at, item)
  }
  if (m.type === 'turn-end')
    return [
      ...items.map((x) => (x.kind === 'text' && x.live ? { ...x, live: false } : x)),
      { kind: 'note', id: m.id, text: m.text, error: m.error }
    ]
  const at = items.findIndex((x) => x.id === m.id)
  const previous = items[at]
  const userTimestamp =
    m.type === 'user'
      ? (m.timestamp ?? (previous?.kind === 'user' ? previous.timestamp : undefined))
      : undefined
  const item: Item =
    m.type === 'tool'
      ? { kind: 'tool', id: m.id, name: m.name, input: m.input, parent: m.parent }
      : m.type === 'user'
        ? {
            kind: 'user',
            id: m.id,
            text: m.text,
            ...(m.point ? { point: m.point } : {}),
            ...(userTimestamp !== undefined ? { timestamp: userTimestamp } : {})
          }
        : { kind: 'note', id: m.id, text: m.text, error: m.error }
  return at < 0 ? [...items, item] : items.with(at, item)
}

/** Applies a live event, stamping `now` when the provider did not include a timestamp. */
export function reduceLive(items: Item[], m: AgentMsg, now = Date.now()): Item[] {
  if (m.type === 'user' && m.timestamp === undefined) {
    return reduce(items, { ...m, timestamp: now })
  }
  if (m.type === 'text' && m.timestamp === undefined) {
    const existing = m.replaceLive
      ? items.find((x) => x.kind === 'text' && x.id === `live:${m.parent ?? ''}`)
      : items.find((x) => x.kind === 'text' && x.id === m.id)
    const timestamp = existing?.kind === 'text' ? (existing.timestamp ?? now) : now
    return reduce(items, { ...m, timestamp })
  }
  return reduce(items, m)
}

/** The newest event of each kind in a job card. */
export function jobSummary(events: McbEvent[]): {
  [K in 'stage' | 'lint' | 'wrote' | 'sheet' | 'done']: Extract<McbEvent, { event: K }> | undefined
} {
  const last = <E extends McbEvent['event']>(e: E): Extract<McbEvent, { event: E }> | undefined =>
    events.findLast((x) => x.event === e) as Extract<McbEvent, { event: E }> | undefined
  return {
    stage: last('stage'),
    lint: last('lint'),
    wrote: last('wrote'),
    sheet: last('sheet'),
    done: last('done')
  }
}

const VERBS: [RegExp, string][] = [
  [/^(Edit|MultiEdit|Write|NotebookEdit)$/, 'Editing'],
  [/^Read$/, 'Reading'],
  [/^(Grep|Glob|LS|ToolSearch)$/, 'Searching'],
  [/^Web(Fetch|Search)$/, 'Browsing'],
  [/^(Agent|Task)$/, 'Delegating'],
  [/^(TodoWrite|ExitPlanMode)$/, 'Planning'],
  [/^(AskUserQuestion|request_user_input)$/, 'Asking'],
  [/__request_review$/, 'Waiting for review']
]

/** What a working agent is doing now, for the status line: its newest unfinished tool, else writing or thinking. */
export function activity(items: Item[], asks: number): string {
  if (asks) return 'Waiting for you'
  const tool = items.findLast((x) => x.kind === 'tool' && x.result === undefined)
  if (tool?.kind === 'tool') {
    if (tool.name === 'Bash') return isBuildRun(tool.input) ? 'Building' : 'Running'
    return VERBS.find(([re]) => re.test(tool.name))?.[1] ?? 'Working'
  }
  const last = items.at(-1)
  return last?.kind === 'text' && last.live ? 'Writing' : 'Thinking'
}
