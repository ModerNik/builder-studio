/** Within `threshold` px of the end counts as at the bottom, so sub-pixel rounding never pauses a log. */
export function isNearBottom(
  el: { scrollHeight: number; scrollTop: number; clientHeight: number },
  threshold = 24
): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
}

/** A streaming log follows new lines until the user scrolls up; then it counts what they have not seen. */
export type Follow = { stuck: boolean; pausedAt: number | null }

export type FollowEvent = { type: 'scroll'; nearBottom: boolean; total: number } | { type: 'jump' }

export function follow(state: Follow, event: FollowEvent): Follow {
  if (event.type === 'jump') return { stuck: true, pausedAt: null }
  if (event.nearBottom) return state.stuck ? state : { stuck: true, pausedAt: null }
  return state.stuck ? { stuck: false, pausedAt: event.total } : state
}

/** Lines that arrived since the user scrolled up. */
export const unseen = (state: Follow, total: number): number =>
  state.stuck || state.pausedAt === null ? 0 : Math.max(0, total - state.pausedAt)

export type LineTone = 'error' | 'warning' | null

/** Tints a log line by what it says; the text stays the same, so tone is never colour alone. */
export function lineTone(line: string): LineTone {
  if (/\b(error|traceback|exception|failed|fatal)\b/i.test(line)) return 'error'
  if (/\b(warn|warning|deprecated)\b/i.test(line)) return 'warning'
  return null
}

/** Indices of the lines containing `query`, ignoring case; none for an empty query. */
export function findLines(lines: readonly string[], query: string): number[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits: number[] = []
  lines.forEach((l, i) => l.toLowerCase().includes(q) && hits.push(i))
  return hits
}

/** A line cut around each case-insensitive match of `query`, for highlighting. */
export function splitMatches(line: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim().toLowerCase()
  if (!q) return [{ text: line, hit: false }]
  const parts: { text: string; hit: boolean }[] = []
  const lower = line.toLowerCase()
  let at = 0
  for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, at)) {
    if (i > at) parts.push({ text: line.slice(at, i), hit: false })
    parts.push({ text: line.slice(i, i + q.length), hit: true })
    at = i + q.length
  }
  if (at < line.length) parts.push({ text: line.slice(at), hit: false })
  return parts
}
