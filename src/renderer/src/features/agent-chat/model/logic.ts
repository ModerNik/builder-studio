// Pure helpers behind the agent composites: tool rows, the composer's skill picker and the usage meter.

export type ToolKind =
  'edit' | 'read' | 'search' | 'run' | 'web' | 'todo' | 'agent' | 'mcp' | 'other'

const TOOLS: [RegExp, ToolKind, string][] = [
  [/^(Edit|MultiEdit|NotebookEdit)$/, 'edit', 'Edited'],
  [/^Write$/, 'edit', 'Wrote'],
  [/^Read$/, 'read', 'Read'],
  [/^(Grep|Glob|LS|ToolSearch)$/, 'search', 'Searched'],
  [/^Bash$/, 'run', 'Ran'],
  [/^Web(Fetch|Search)$/, 'web', 'Browsed'],
  [/^TodoWrite$/, 'todo', 'Updated todos'],
  [/^(Agent|Task)$/, 'agent', 'Subagent']
]

const count = (s: unknown): number => (typeof s === 'string' && s ? s.split('\n').length : 0)

/** A tool call as a row: kind (its icon), past-tense verb, one-line gist and line counts for edits. */
export function toolLook(
  name: string,
  input: Record<string, unknown>
): { kind: ToolKind; verb: string; gist: string; added: number; removed: number } {
  const mcp = /^mcp__([^_]+)__(.+)$/.exec(name)
  const hit = TOOLS.find(([re]) => re.test(name))
  const kind: ToolKind = hit?.[1] ?? (mcp ? 'mcp' : 'other')
  const verb =
    kind === 'agent'
      ? String(input.subagent_type ?? 'Subagent')
      : (hit?.[2] ?? (mcp ? `${mcp[1]} · ${mcp[2]}` : name))
  const gist = String(
    input.command ??
      input.file_path ??
      input.pattern ??
      input.path ??
      input.description ??
      input.url ??
      input.query ??
      ''
  ).split('\n')[0]
  const added = count(name === 'Write' ? input.content : input.new_string)
  const removed = name === 'Edit' ? count(input.old_string) : 0
  return { kind, verb, gist, added, removed }
}

export type Command = { name: string; description?: string; hint?: string; skill?: boolean }

/**
 * The skill picker's query and matches for the composer text: open only while the text is one token
 * starting with a sigil ("/" for Claude Code, "$" or "/" for Codex). Name prefixes rank before other hits.
 */
export function matchCommands(
  text: string,
  sigils: readonly string[],
  commands: readonly Command[]
): { query: string | null; matches: Command[] } {
  const m = /^(\S)(\S*)$/.exec(text)
  if (!m || !sigils.includes(m[1])) return { query: null, matches: [] }
  const q = m[2].toLowerCase()
  const prefix: Command[] = []
  const rest: Command[] = []
  for (const c of commands) {
    const name = c.name.toLowerCase()
    if (name.startsWith(q)) prefix.push(c)
    else if (name.includes(q) || c.description?.toLowerCase().includes(q)) rest.push(c)
  }
  return { query: q, matches: [...prefix, ...rest] }
}

/** Context thresholds from docs/ai-assistant.md: amber from 150k tokens, red from 200k. */
export const CONTEXT_AMBER = 150_000
export const CONTEXT_RED = 200_000

export function contextTone(tokens: number): 'ok' | 'warning' | 'danger' {
  return tokens >= CONTEXT_RED ? 'danger' : tokens >= CONTEXT_AMBER ? 'warning' : 'ok'
}

/** Tokens as "48k", "1.2M". */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}
