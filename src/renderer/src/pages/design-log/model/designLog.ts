// The Design log screen's logic: why main refused a save (main/review.ts writeDesign) and the fix for each,
// the Status block of a DESIGN.md, and the round headings' anchors.

/** The `## Status` section up to the next `## ` heading; the same rule as main/review.ts statusBlock. */
export function statusBlock(md: string): string {
  const m = /^##\s+Status\b[^\n]*\n(?:(?!##\s)[^\n]*\n?)*/im.exec(md)
  return m ? m[0] : ''
}

/** The edit with its Status block put back as it was in `base` (added at the top when the edit dropped it). */
export function restoreStatus(edit: string, base: string): string {
  const was = statusBlock(base)
  const now = statusBlock(edit)
  if (now) return edit.replace(now, () => was)
  if (!was) return edit
  const at = base.indexOf(was)
  const before = base.slice(0, at)
  return edit.startsWith(before) ? before + was + edit.slice(before.length) : was + edit
}

const lf = (s: string): string => s.replace(/\r\n/g, '\n')

/** The edit with the file's own line endings: a textarea hands back LF, and main compares the Status
 *  block byte for byte, so a CRLF file would otherwise always be refused. A file with mixed endings
 *  gets CRLF, with its Status block kept exactly as it was when only its endings differ. */
export function sameEol(md: string, base: string): string {
  if (!base.includes('\r\n')) return md
  const out = md.replace(/\r?\n/g, '\r\n')
  const was = statusBlock(base)
  const now = statusBlock(out)
  return now && was !== now && lf(was) === lf(now) ? out.replace(now, () => was) : out
}

/** Whether the edit differs from the file, line endings aside (the textarea turns CRLF into LF). */
export const edited = (md: string, base: string): boolean => lf(md) !== lf(base)

export type Refusal = 'status' | 'disk'

/** Which of main's two refusals an error is, or null for any other failure. */
export function refusal(error: unknown): Refusal | null {
  const s = String(error)
  if (/changed on disk/i.test(s)) return 'disk'
  if (/Status block/i.test(s)) return 'status'
  return null
}

export const roundId = (n: number): string => `round-${n}`

/** The round number of a `### Round N…` heading's text. */
export const roundOf = (heading: string): number | null => {
  const n = /^Round\s+(\d+)/i.exec(heading)?.[1]
  return n ? Number(n) : null
}

/** Where the `### Round n` heading starts in the raw markdown, or -1. */
export function roundLine(md: string, n: number): number {
  const m = new RegExp(String.raw`^###\s+Round\s+${n}\b`, 'im').exec(md)
  return m ? m.index : -1
}

/** The Status bullets as label/value rows: `Label: value` splits, a line without a colon is all value. */
export function statusItems(lines: string[]): { label: string; value: string }[] {
  return lines.map((raw, i) => {
    const line = raw.replace(/\*\*|__|`/g, '').trim()
    const at = line.indexOf(':')
    return at > 0 && at < 40
      ? { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() }
      : { label: `${i + 1}`, value: line }
  })
}
