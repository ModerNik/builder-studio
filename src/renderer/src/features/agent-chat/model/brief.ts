// DESIGN.md §1, the brief: the one section the app writes for the user. The Status block stays the agent's.

const BRIEF = /^## 1\. Brief\b.*$/m

/** md with its `## 1. Brief (date)` section replaced by `body`, or inserted before §2 (or at the end). */
export function setBrief(md: string, build: string, body: string, date: string): string {
  const section = `## 1. Brief (${date})\n\n${body.trim()}\n\n`
  const doc = md.trim() ? md.replace(/\s*$/, '\n\n') : `# ${build}\n\n`
  const at = doc.search(BRIEF)
  if (at >= 0) {
    const next = doc.slice(at + 1).search(/^## /m)
    return doc.slice(0, at) + section + (next < 0 ? '' : doc.slice(at + 1 + next))
  }
  const two = doc.search(/^## 2\./m)
  return two < 0 ? doc + section : doc.slice(0, two) + section + doc.slice(two)
}

/** The current brief's text, without its heading. */
export function getBrief(md: string): string {
  const at = md.search(BRIEF)
  if (at < 0) return ''
  const rest = md.slice(at).replace(BRIEF, '')
  const next = rest.search(/^## /m)
  return (next < 0 ? rest : rest.slice(0, next)).trim()
}

/** The highest `### Round N` in the process log, 0 if none. */
export const lastRound = (md: string): number =>
  Math.max(0, ...[...md.matchAll(/^### Round (\d+)/gm)].map((m) => Number(m[1])))
