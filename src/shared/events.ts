import type { McbEvent } from './api'

const PREFIX = '@mcb '

/** An `@mcb {json}` line as an event; null for human lines, or for event lines that don't parse. */
export function parseEvent(line: string): McbEvent | null {
  if (!line.startsWith(PREFIX)) return null
  try {
    const e = JSON.parse(line.slice(PREFIX.length))
    return e && typeof e === 'object' && typeof e.event === 'string' ? (e as McbEvent) : null
  } catch {
    return null
  }
}

/** Splits a stream into lines: feed() chunks, get back the whole lines (CRLF or LF); flush() the rest. */
export function lineSplitter(): { feed(chunk: string): string[]; flush(): string[] } {
  let rest = ''
  return {
    feed(chunk) {
      const parts = (rest + chunk).split(/\r?\n/)
      rest = parts.pop()!
      return parts
    },
    flush() {
      const r = rest
      rest = ''
      return r ? [r] : []
    }
  }
}
