import type { AgentMsg } from '@shared/api'

type Native = { type: string; [key: string]: unknown }
type Block = { type: string; [key: string]: unknown }
const blocks = (v: unknown): Block[] =>
  typeof v === 'string' ? [{ type: 'text', text: v }] : Array.isArray(v) ? v : []
const text = (v: unknown): string =>
  blocks(v)
    .map((b) => (b.type === 'text' ? String(b.text) : b.type === 'image' ? '[image]' : ''))
    .join('\n')
let n = 0

/** Preserve Claude's partial/final replacement and nested subagent transcript semantics. */
export function claudeEvents(m: Native): AgentMsg[] {
  const id = String(m.uuid ?? `claude:${++n}`)
  const parent = (m.parent_tool_use_id as string | null) ?? null
  if (m.type === 'system') {
    if (m.subtype === 'init')
      return [
        {
          type: 'note',
          id,
          text: `session ${String(m.session_id).slice(0, 8)} · ${String(m.model)} · key from ${String(m.apiKeySource)}`
        }
      ]
    if (m.subtype === 'compact_boundary') return [{ type: 'note', id, text: 'context compacted' }]
  }
  if (m.type === 'stream_event') {
    const e = m.event as { type: string; delta?: { type: string; text?: string } }
    if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta')
      return [
        { type: 'text', id: `live:${parent ?? ''}`, parent, text: e.delta.text ?? '', delta: true }
      ]
  }
  if (m.type === 'assistant') {
    const result: AgentMsg[] = []
    blocks((m.message as { content: unknown }).content).forEach((b, i) => {
      if (b.type === 'text' && String(b.text).trim())
        result.push({
          type: 'text',
          id: `${id}:${i}`,
          parent,
          text: String(b.text),
          replaceLive: true
        })
      if (b.type === 'tool_use')
        result.push({
          type: 'tool',
          id: String(b.id),
          name: String(b.name),
          input: (b.input ?? {}) as Record<string, unknown>,
          parent
        })
    })
    if (m.error)
      result.push({
        type: 'note',
        id: `${id}:error`,
        text: `error: ${String(m.error)}`,
        error: true
      })
    return result
  }
  if (m.type === 'user') {
    const result: AgentMsg[] = []
    const content = blocks((m.message as { content: unknown }).content)
    for (const b of content)
      if (b.type === 'tool_result')
        result.push({
          type: 'tool-result',
          id: String(b.tool_use_id),
          text: text(b.content),
          error: b.is_error === true
        })
    const said = content
      .filter((b) => b.type === 'text')
      .map((b) => String(b.text))
      .join('\n')
      .trim()
    if (said && !parent && !m.isSynthetic && !said.startsWith('<'))
      result.push({ type: 'user', id: `${id}:0`, text: said })
    return result
  }
  if (m.type === 'prompt_suggestion' && typeof m.suggestion === 'string' && m.suggestion.trim())
    return [{ type: 'suggestion', id, text: m.suggestion.trim() }]
  if (m.type === 'result') {
    const ok = m.subtype === 'success' && !m.is_error
    return [
      {
        type: 'turn-end',
        id,
        error: !ok,
        text: ok
          ? `done in ${Math.round(Number(m.duration_ms) / 100) / 10} s · ${String(m.num_turns)} turns`
          : `stopped: ${String(m.subtype).replace(/_/g, ' ')}${m.result ? ` · ${String(m.result).slice(0, 300)}` : ''}`
      }
    ]
  }
  return []
}
