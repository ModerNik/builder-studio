// Design log domain logic: DESIGN.md structured journal parser, engine boilerplate cleanup,
// Status-safe editing split/merge, review-round merging, and search filtering.
import type { ReviewRound } from '@shared/api'

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

/** Strips the agent-owned `## Status` block out of the text shown in the raw editor. */
export function splitForEdit(md: string): { body: string; hasStatus: boolean } {
  const block = statusBlock(md)
  if (!block) return { body: lf(md), hasStatus: false }
  const at = md.indexOf(block)
  const before = lf(md.slice(0, at)).replace(/\n+$/, '')
  const after = lf(md.slice(at + block.length)).replace(/^\n+/, '')
  const body = before && after ? `${before}\n\n${after}` : before ? `${before}\n` : after
  return { body, hasStatus: true }
}

/** Splices the exact original `## Status` block from `base` back into the user's edited markdown. */
export function mergeFromEdit(editedBody: string, base: string): string {
  const block = statusBlock(base)
  if (!block) return sameEol(editedBody, base)
  // If the user explicitly typed a Status heading back, replace it with the original Status block
  if (statusBlock(editedBody)) {
    return sameEol(restoreStatus(editedBody, base), base)
  }
  const bodyLf = lf(editedBody)
  const blockLf = lf(block).trimEnd()
  const nextSection = /^##\s+/m.exec(bodyLf)
  let merged: string
  if (nextSection) {
    const head = bodyLf.slice(0, nextSection.index).trimEnd()
    const tail = bodyLf.slice(nextSection.index)
    merged = head ? `${head}\n\n${blockLf}\n\n${tail}` : `${blockLf}\n\n${tail}`
  } else {
    const trimmed = bodyLf.trimEnd()
    merged = trimmed ? `${trimmed}\n\n${blockLf}\n` : `${blockLf}\n`
  }
  const withEol = sameEol(merged, base)
  // Ensure the Status block matches `base` byte-for-byte even when `base` had mixed endings
  const nowBlock = statusBlock(withEol)
  if (nowBlock && nowBlock.trimEnd() !== block.trimEnd()) {
    return withEol.replace(nowBlock, () => block)
  }
  return withEol
}

/** Clean starter markdown when creating a DESIGN.md from scratch. */
export function starterDesign(displayName: string, today: string): string {
  return `# ${displayName}

## 1. Brief (${today})
- Purpose, site and size: 
- Style and palette: 
- Survival or creative: 

## 2. Decisions

## 3. Process log
`
}

export interface StatusRow {
  key: string
  label: string
  value: string
  parts?: string[]
}

export interface JournalSection {
  id: string
  title: string
  date?: string
  kind: 'brief' | 'decisions' | 'references' | 'section'
  body: string
  empty: boolean
}

export interface JournalPin {
  n: number
  file: string
  location: string
  state?: string
  text: string
}

export type JournalEntry =
  | {
      id: string
      kind: 'round'
      round: number
      title: string
      date?: string
      pick?: string | null
      fileCount?: number
      approved: string[]
      sheet?: string
      notes?: string
      pins: JournalPin[]
      body: string
      archived?: boolean
    }
  | {
      id: string
      kind: 'export'
      title: string
      stem?: string
      date?: string
      body: string
      archived?: boolean
    }
  | {
      id: string
      kind: 'note'
      title: string
      date?: string
      body: string
      archived?: boolean
    }

export interface DesignDocument {
  title: string
  intro: string
  status: StatusRow[]
  brief: JournalSection | null
  sections: JournalSection[]
  entries: JournalEntry[]
}

const BOILERPLATE_RE =
  /Decision log for this build:|Workflow:\s*\S*pipeline\.md|Keep \*\*Status\*\* current:/i

/** Strips legacy engine scaffold boilerplate from the preamble before the first `##` heading. */
function cleanIntro(raw: string): string {
  const paragraphs = raw
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !BOILERPLATE_RE.test(p))
  return paragraphs.join('\n\n')
}

/** Strips empty scaffold bullets like `- Style and palette:` with nothing after the colon. */
function cleanTemplateBody(body: string): string {
  const kept = body.split('\n').filter((line) => !/^\s*[-*]\s+[^:\n]{1,64}:\s*$/.test(line))
  return kept.join('\n').trim()
}

function slugId(prefix: string, title: string, used: Set<string>): string {
  const base = `${prefix}-${
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'item'
  }`
  let id = base
  let n = 2
  while (used.has(id)) id = `${base}-${n++}`
  used.add(id)
  return id
}

function extractHeadingDate(raw: string): { title: string; date?: string } {
  const m = /^(.*?)\s*\((\d{4}-\d{2}-\d{2})\)\s*$/.exec(raw.trim())
  if (m) return { title: m[1].trim(), date: m[2] }
  return { title: raw.trim() }
}

function parseStatusSection(body: string): StatusRow[] {
  const bullets: string[] = []
  for (const line of body.split('\n')) {
    if (!line.trim()) continue
    if (/^\s*[-*]\s/.test(line)) bullets.push(line.replace(/^\s*[-*]\s+/, ''))
    else if (bullets.length) bullets[bullets.length - 1] += ' ' + line.trim()
  }
  const rows: StatusRow[] = []
  bullets.forEach((raw, i) => {
    const clean = raw.replace(/\*\*|__|`/g, '').trim()
    if (!clean) return
    const at = clean.indexOf(':')
    const label = at > 0 && at < 40 ? clean.slice(0, at).trim() : `Item ${i + 1}`
    const value = at > 0 && at < 40 ? clean.slice(at + 1).trim() : clean
    if (!value) return // hide unfilled template placeholders like `- Current version:`
    let parts: string[] | undefined
    if (/approved\s+parts?/i.test(label) && !/^none\b|^-$/i.test(value)) {
      const split = value
        .split(/[,;]+/)
        .map((p) => p.replace(/\.$/, '').trim())
        .filter(Boolean)
      if (split.length > 0) parts = split
    }
    rows.push({ key: `${label}-${i}`, label, value, parts })
  })
  return rows
}

/** Strips auto-generated Builder Studio review gist bullets when structured round JSON is available. */
function stripAutoReviewGist(body: string): string {
  const lines = body.split('\n')
  const kept: string[] = []
  let skippingNotes = false
  for (const line of lines) {
    if (skippingNotes) {
      if (/^\s{2,}\S/.test(line)) continue
      skippingNotes = false
    }
    if (/^\s*-\s+Review in Builder Studio,\s+`review\/round_\d+\.json`:/i.test(line)) continue
    if (/^\s*-\s+Notes:/i.test(line)) {
      skippingNotes = true
      continue
    }
    if (/^\s*-\s+Pin\s+\d+,/i.test(line)) continue
    if (/^\s*-\s+\d+\s+more pins in the round file\.?\s*$/i.test(line)) continue
    kept.push(line)
  }
  return kept.join('\n').trim()
}

function shortBlock(state: string): string {
  return state.replace(/^minecraft:/, '')
}

function roundToPins(saved: ReviewRound): JournalPin[] {
  return saved.pins.map((p) =>
    'block' in p
      ? {
          n: p.n,
          file: p.file,
          location: p.block.join(', '),
          state: shortBlock(p.state),
          text: p.text.trim()
        }
      : {
          n: p.n,
          file: p.file,
          location: `px ${p.px.join(', ')}`,
          text: p.text.trim()
        }
  )
}

function pickSheet(saved: ReviewRound): string | undefined {
  return (
    saved.files.find((f) => f.name === saved.pick)?.sheet ??
    saved.files.find((f) => f.sheet)?.sheet ??
    undefined
  )
}

/** Parses `DESIGN.md` and saved `review/round_N.json` files into a clean Structured Build Journal. */
export function parseDesignDocument(md: string, savedRounds: ReviewRound[] = []): DesignDocument {
  const normalized = lf(md)
  const lines = normalized.split('\n')
  const usedIds = new Set<string>()
  const roundMap = new Map<number, ReviewRound>(savedRounds.map((r) => [r.round, r]))
  const matchedRounds = new Set<number>()

  let title = ''
  const preamble: string[] = []
  const h2Blocks: { heading: string; lines: string[] }[] = []
  let current: { heading: string; lines: string[] } | null = null

  for (const line of lines) {
    if (!current && !title && /^#\s+/.test(line)) {
      title = line.replace(/^#\s+/, '').trim()
      continue
    }
    const h2 = /^##\s+(.+)$/.exec(line)
    if (h2) {
      current = { heading: h2[1].trim(), lines: [] }
      h2Blocks.push(current)
      continue
    }
    if (current) current.lines.push(line)
    else preamble.push(line)
  }

  let status: StatusRow[] = []
  let brief: JournalSection | null = null
  const sections: JournalSection[] = []
  const entries: JournalEntry[] = []

  const parseSubEntries = (blockLines: string[], archived: boolean): void => {
    const subs: { heading: string; lines: string[] }[] = []
    const loose: string[] = []
    let sub: { heading: string; lines: string[] } | null = null

    for (const line of blockLines) {
      const h3 = /^###\s+(.+)$/.exec(line)
      if (h3) {
        sub = { heading: h3[1].trim(), lines: [] }
        subs.push(sub)
      } else if (sub) {
        sub.lines.push(line)
      } else {
        loose.push(line)
      }
    }

    const looseText = cleanTemplateBody(loose.join('\n'))
    if (looseText) {
      entries.push({
        id: slugId('note', archived ? 'archive-notes' : 'log-notes', usedIds),
        kind: 'note',
        title: archived ? 'Archived notes' : 'Log notes',
        body: looseText,
        archived
      })
    }

    for (const s of subs) {
      const roundMatch = /^Round\s+(\d+)\s*[:.\-–—]?\s*(.*)$/i.exec(s.heading)
      if (roundMatch) {
        const n = Number(roundMatch[1])
        const { title: parsedTitle, date } = extractHeadingDate(roundMatch[2] || `Round ${n}`)
        const saved = roundMap.get(n)
        if (saved) matchedRounds.add(n)
        const rawBody = s.lines.join('\n').trim()
        const body = saved ? stripAutoReviewGist(rawBody) : rawBody
        const id = usedIds.has(roundId(n)) ? slugId('round', `${n}`, usedIds) : roundId(n)
        usedIds.add(id)
        entries.push({
          id,
          kind: 'round',
          round: n,
          title: parsedTitle || saved?.question || `Review ${n}`,
          date: date ?? saved?.date,
          pick: saved?.pick,
          fileCount: saved?.files.length,
          approved: saved?.approved ?? [],
          sheet: saved ? pickSheet(saved) : undefined,
          notes: saved?.notes.trim() || undefined,
          pins: saved ? roundToPins(saved) : [],
          body,
          archived
        })
        continue
      }

      const shippedMatch = /^Shipped\s+(\S+)(.*)$/i.exec(s.heading)
      if (shippedMatch) {
        const { title: extraTitle, date } = extractHeadingDate(shippedMatch[2] || '')
        const stem = shippedMatch[1]
        entries.push({
          id: slugId('export', stem, usedIds),
          kind: 'export',
          stem,
          title: extraTitle ? `${stem} — ${extraTitle}` : `Exported ${stem}`,
          date,
          body: s.lines.join('\n').trim(),
          archived
        })
        continue
      }

      const { title: entryTitle, date } = extractHeadingDate(s.heading)
      const body = s.lines.join('\n').trim()
      if (!entryTitle && !body) continue
      entries.push({
        id: slugId('entry', entryTitle, usedIds),
        kind: 'note',
        title: entryTitle,
        date,
        body,
        archived
      })
    }
  }

  for (const block of h2Blocks) {
    const rawHeading = block.heading
    if (/^Status\b/i.test(rawHeading)) {
      status = parseStatusSection(block.lines.join('\n'))
      continue
    }
    if (/\blog\b/i.test(rawHeading)) {
      parseSubEntries(block.lines, false)
      continue
    }
    if (/^Archive\b/i.test(rawHeading)) {
      parseSubEntries(block.lines, true)
      continue
    }

    const strippedNum = rawHeading.replace(/^\d+\.\s*/, '')
    const { title: secTitle, date } = extractHeadingDate(strippedNum)
    const cleanedBody = cleanTemplateBody(block.lines.join('\n'))
    const isBrief = /^Brief\b/i.test(secTitle)
    const kind: JournalSection['kind'] = isBrief
      ? 'brief'
      : /^Decisions?\b/i.test(secTitle)
        ? 'decisions'
        : /^References?\b/i.test(secTitle)
          ? 'references'
          : 'section'

    const section: JournalSection = {
      id: slugId('section', secTitle, usedIds),
      title: secTitle,
      date,
      kind,
      body: cleanedBody,
      empty: cleanedBody.length === 0
    }
    if (isBrief && !brief) {
      brief = section
    } else if (!section.empty) {
      sections.push(section)
    }
  }

  // Reconcile any saved review/round_N.json not yet mirrored in DESIGN.md
  for (const saved of savedRounds) {
    if (matchedRounds.has(saved.round)) continue
    const id = usedIds.has(roundId(saved.round))
      ? slugId('round', `${saved.round}`, usedIds)
      : roundId(saved.round)
    usedIds.add(id)
    entries.push({
      id,
      kind: 'round',
      round: saved.round,
      title: saved.question.trim() || `Review ${saved.round}`,
      date: saved.date,
      pick: saved.pick,
      fileCount: saved.files.length,
      approved: saved.approved,
      sheet: pickSheet(saved),
      notes: saved.notes.trim() || undefined,
      pins: roundToPins(saved),
      body: ''
    })
  }

  return {
    title,
    intro: cleanIntro(preamble.join('\n')),
    status,
    brief,
    sections,
    entries
  }
}

/** Filters sections and journal entries by a free-text query. */
export function filterDesignDocument(doc: DesignDocument, query: string): DesignDocument {
  const q = query.trim().toLowerCase()
  if (!q) return doc
  const match = (...parts: (string | null | undefined)[]): boolean =>
    parts.some((p) => p?.toLowerCase().includes(q))

  const brief =
    doc.brief && !doc.brief.empty && match(doc.brief.title, doc.brief.body, doc.brief.date)
      ? doc.brief
      : null
  const sections = doc.sections.filter((s) => match(s.title, s.body, s.date))
  const entries = doc.entries.filter((e) => {
    if (e.kind === 'round') {
      return (
        match(`round ${e.round}`, `r${e.round}`, e.title, e.date, e.pick, e.notes, e.body) ||
        e.approved.some((a) => match(a)) ||
        e.pins.some((p) => match(p.file, p.state, p.location, p.text))
      )
    }
    return match(e.title, e.date, e.body)
  })
  const status = doc.status.filter((s) => match(s.label, s.value))
  return { ...doc, status, brief, sections, entries }
}
