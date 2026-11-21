// Review rounds: builds/<name>/review/round_N.json plus a short gist in the DESIGN.md log. The `## Status` block
// belongs to the agent: every DESIGN.md write here checks it came through unchanged.
import { existsSync, renameSync, rmSync, writeFileSync } from 'fs'
import { mkdir, readdir, readFile } from 'fs/promises'
import { join, posix } from 'path'
import {
  ReviewRoundSchema,
  type ReviewRequest,
  type ReviewRound,
  type SavedRound
} from '@shared/api'
import { buildDir, parseDesign } from './projects'

/** tmp + rename, so a reader (the agent, the watcher) never sees half a file. */
export function writeAtomic(file: string, text: string): void {
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, text)
  try {
    renameSync(tmp, file)
  } catch (e) {
    rmSync(tmp, { force: true })
    throw e
  }
}

/** The `## Status` heading and its body, up to the next `## ` heading ('' when there is none). */
export function statusBlock(md: string): string {
  const m = /^##\s+Status\b[^\n]*\n(?:(?!##\s)[^\n]*\n?)*/im.exec(md)
  return m ? m[0] : ''
}

/** md with `gist` added at the end of the log section (the `## … log` heading), or in a new one at the end. */
export function appendGist(md: string, gist: string): string {
  const lines = md.split(/\r?\n/)
  const nl = md.includes('\r\n') ? '\r\n' : '\n'
  const log = lines.findIndex((l) => /^##\s.*\blog\b/i.test(l))
  let end = log < 0 ? lines.length : lines.findIndex((l, i) => i > log && /^##\s/.test(l))
  if (end < 0) end = lines.length
  let at = end
  while (at > 0 && !lines[at - 1].trim()) at--
  // no log yet: start one, so the gist can't run on inside a trailing Status block
  const head = log < 0 ? ['', '## Process log'] : []
  const block = [...head, '', ...gist.trimEnd().split('\n'), ...(end < lines.length ? [''] : [])]
  const out = [...lines.slice(0, at), ...block, ...lines.slice(end)].join(nl)
  if (statusBlock(out).trimEnd() !== statusBlock(md).trimEnd())
    throw new Error('the gist would change the Status block')
  return out.endsWith(nl) ? out : out + nl
}

const short = (s: string): string => s.replace(/^minecraft:/, '')

/** The few lines a DESIGN.md reader needs; the round file has the rest. */
export function gist(r: ReviewRound): string {
  const names = r.files.map((f) => f.name)
  const head = `### Round ${r.round}: ${r.question.trim().replace(/\s+/g, ' ') || 'review'} (${r.date})`
  const pick = r.pick ? `pick **${r.pick}**` : 'no pick'
  const lines = [
    head,
    `- Review in Builder Studio, \`review/round_${r.round}.json\`: ${pick} of ${names.join(', ')}` +
      (r.approved.length ? `; approved: ${r.approved.join(', ')}.` : '.')
  ]
  if (r.notes.trim()) lines.push(`- Notes: ${r.notes.trim().replace(/\r?\n/g, '\n  ')}`)
  const MAX = 12
  for (const p of r.pins.slice(0, MAX)) {
    const where =
      'block' in p ? `(${p.block.join(', ')}) ${short(p.state)}` : `sheet px (${p.px.join(', ')})`
    lines.push(`- Pin ${p.n}, ${p.file} ${where}${p.text.trim() ? `: ${p.text.trim()}` : ''}`)
  }
  if (r.pins.length > MAX) lines.push(`- ${r.pins.length - MAX} more pins in the round file.`)
  return lines.join('\n')
}

/** Every valid review/round_N.json of a build, oldest first (bad files are skipped). */
export async function listRounds(repo: string, build: string): Promise<ReviewRound[]> {
  const dir = join(buildDir(repo, build), 'review')
  const names = (await readdir(dir).catch(() => [] as string[])).filter((f) =>
    /^round_\d+\.json$/.test(f)
  )
  const rounds = await Promise.all(
    names.map(async (f) => {
      try {
        return ReviewRoundSchema.parse(JSON.parse(await readFile(join(dir, f), 'utf8')))
      } catch {
        return null
      }
    })
  )
  return rounds.filter((r): r is ReviewRound => !!r).sort((a, b) => a.round - b.round)
}

/** One past both the round files and the DESIGN.md `### Round N` headings. */
export async function nextRound(repo: string, build: string): Promise<number> {
  const dir = buildDir(repo, build)
  const md = await readFile(join(dir, 'DESIGN.md'), 'utf8').catch(() => '')
  const files = await readdir(join(dir, 'review')).catch(() => [] as string[])
  const ns = [
    ...parseDesign(md).rounds.map((r) => r.n),
    ...files.map((f) => Number(/^round_(\d+)\.json$/.exec(f)?.[1] ?? 0))
  ]
  return Math.max(0, ...ns) + 1
}

/** Writes the round file (numbered here, not by the caller) and the DESIGN.md gist. */
export async function saveRound(repo: string, input: ReviewRound): Promise<SavedRound> {
  const dir = buildDir(repo, input.build)
  const prefix = posix.join('builds', input.build) + '/'
  const r = ReviewRoundSchema.parse({ ...input, round: await nextRound(repo, input.build) })
  for (const p of [
    ...r.files.flatMap((f) => [f.path, f.sheet]),
    ...r.pins.map((p) => ('sheet' in p ? p.sheet : null))
  ])
    if (p && !p.startsWith(prefix)) throw new Error(`${p} is not in ${prefix}`)
  await mkdir(join(dir, 'review'), { recursive: true })
  const file = join(dir, 'review', `round_${r.round}.json`)
  if (existsSync(file)) throw new Error(`round_${r.round}.json exists`)
  writeAtomic(file, JSON.stringify(r, null, 2) + '\n')
  const design = join(dir, 'DESIGN.md')
  const md = await readFile(design, 'utf8').catch(() => null)
  writeAtomic(
    design,
    md === null ? `# ${input.build}\n\n## Process log\n\n${gist(r)}\n` : appendGist(md, gist(r))
  )
  return { round: r, path: posix.join('builds', r.build, 'review', `round_${r.round}.json`) }
}

/** Reviews the agent is waiting on (MCP request_review): answered by review:save, or null on review:cancel. */
export class ReviewQueue {
  private waiting = new Map<string, { req: ReviewRequest; done: (r: SavedRound | null) => void }>()
  private n = 0

  constructor(
    private notify: (req: ReviewRequest) => void,
    private closed?: (id: string) => void
  ) {}

  ask(req: Omit<ReviewRequest, 'id'>, signal?: AbortSignal): Promise<SavedRound | null> {
    if (signal?.aborted) return Promise.resolve(null)
    const id = `r${++this.n}-${Date.now()}`
    return new Promise((done) => {
      const abort = (): void => this.answer(id, null)
      this.waiting.set(id, {
        req: { ...req, id },
        done: (r) => {
          signal?.removeEventListener('abort', abort)
          done(r)
        }
      })
      signal?.addEventListener('abort', abort, { once: true })
      this.notify({ ...req, id })
    })
  }

  list(): ReviewRequest[] {
    return [...this.waiting.values()].map((w) => w.req)
  }

  answer(id: string, r: SavedRound | null): void {
    if (!this.waiting.has(id)) return
    this.waiting.get(id)?.done(r)
    this.waiting.delete(id)
    this.closed?.(id)
  }
}

/** The user's Edit of DESIGN.md: refused if the agent changed the file since `base` was read, or if the
 *  edit touches the Status block. */
export async function writeDesign(
  repo: string,
  build: string,
  base: string,
  md: string
): Promise<void> {
  const file = join(buildDir(repo, build), 'DESIGN.md')
  const now = await readFile(file, 'utf8').catch(() => '')
  if (now !== base)
    throw new Error('DESIGN.md changed on disk since you started editing: reload it first.')
  if (statusBlock(md).trimEnd() !== statusBlock(base).trimEnd())
    throw new Error('The Status block is the agent’s: put it back as it was.')
  writeAtomic(file, md)
}
