import type { AgentMsg } from '@shared/api'

export type CodexItem = { type: string; id: string; [key: string]: unknown }
const stringify = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v ?? ''))
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

function parseTimestamp(item: CodexItem): number | undefined {
  for (const raw of [item.timestamp, item.completedAt, item.createdAt]) {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw > 1e12 ? raw : raw * 1000
    if (typeof raw === 'string' && raw) {
      const ms = Date.parse(raw)
      if (!Number.isNaN(ms)) return ms
    }
  }
  return undefined
}

/** Live completions and stored items use the same mapping, so reopening a session keeps tool results. */
export function codexEvents(item: CodexItem, completed: boolean): AgentMsg[] {
  const { id, type } = item
  const timestamp = parseTimestamp(item)
  if (type === 'agentMessage')
    return completed
      ? [
          {
            type: 'text',
            id,
            text: String(item.text ?? ''),
            parent: null,
            ...(timestamp !== undefined ? { timestamp } : {})
          }
        ]
      : []
  if (type === 'plan')
    return completed
      ? [
          {
            type: 'text',
            id,
            text: String(item.text ?? ''),
            parent: null,
            plan: true,
            ...(timestamp !== undefined ? { timestamp } : {})
          }
        ]
      : []
  if (type === 'userMessage')
    return completed
      ? [
          {
            type: 'user',
            id,
            text: (item.content as { type: string; text?: string }[])
              .filter((c) => c.type === 'text')
              .map((c) => c.text)
              .join('\n'),
            ...(timestamp !== undefined ? { timestamp } : {})
          }
        ]
      : []
  if (type === 'contextCompaction')
    return completed ? [{ type: 'note', id, text: 'context compacted' }] : []
  let name: string
  let input: Record<string, unknown>
  let result: string
  let error = item.status === 'failed' || item.status === 'declined'
  switch (type) {
    case 'commandExecution':
      name = 'shell'
      input = { command: item.command, cwd: item.cwd }
      result = String(item.aggregatedOutput ?? '')
      error ||= typeof item.exitCode === 'number' && item.exitCode !== 0
      break
    case 'fileChange':
      name = 'file changes'
      input = { changes: item.changes }
      result = stringify(item.changes)
      break
    case 'dynamicToolCall':
      name = String(item.tool)
      input = object(item.arguments)
      result =
        (item.contentItems as { text?: string }[] | null)?.map((c) => c.text ?? '').join('\n') ?? ''
      error ||= item.success === false
      break
    case 'mcpToolCall':
      name = `mcp__${String(item.server)}__${String(item.tool)}`
      input = object(item.arguments)
      result = stringify(item.error ?? item.result)
      error ||= !!item.error
      break
    case 'webSearch':
    case 'imageView':
    case 'collabAgentToolCall':
      name = type
      input = { ...item }
      result = stringify(item)
      break
    default:
      return []
  }
  const events: AgentMsg[] = [{ type: 'tool', id, name, input, parent: null }]
  if (completed) events.push({ type: 'tool-result', id, text: result, error })
  return events
}
