import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { ReviewRoundSchema, type ReviewRound } from '@shared/api'
import {
  appendGist,
  gist,
  listRounds,
  nextRound,
  ReviewQueue,
  saveRound,
  statusBlock,
  writeDesign
} from './review'

it('cancels pending reviews with their turn and announces closure once, preserving answered rounds', async () => {
  const opened: string[] = []
  const closed: string[] = []
  const queue = new ReviewQueue(
    (r) => opened.push(r.id!),
    (id) => closed.push(id)
  )
  const abort = new AbortController()
  const request = queue.ask(
    { build: 'tower', question: 'Which?', variants: ['a'], parts: [] },
    abort.signal
  )
  abort.abort()
  expect(await request).toBeNull()
  expect(queue.list()).toEqual([])
  expect(closed).toEqual(opened)
  queue.answer(opened[0], null)
  expect(closed).toHaveLength(1)
})

const MD = `# Narkina5

## Status
- Current version: round 15.
- Next step: none open.

## 4. Process log
### Round 14: whirlpools v2 (2026-10-26)
- old feedback

### Round 15: final build (2026-10-27)
- shipped

## 5. Notes
- after the log
`

const ROUND: ReviewRound = {
  round: 1,
  build: 'narkina5',
  date: '2026-10-27',
  question: 'Which crown do we keep?',
  files: [
    {
      name: 'tower_A',
      path: 'builds/narkina5/out/tower_A.litematic',
      paste: [1200, 62, -340],
      sheet: null
    },
    {
      name: 'tower_B',
      path: 'builds/narkina5/out/tower_B.litematic',
      paste: [1200, 62, -340],
      sheet: 'builds/narkina5/out/tower_B_3d/sheet.png'
    }
  ],
  pick: 'tower_B',
  approved: ['crown'],
  notes: "B's crown,\nA's window rhythm",
  pins: [
    {
      n: 1,
      file: 'tower_B',
      block: [14, 96, 3],
      state: 'minecraft:polished_tuff_wall[east=low]',
      view: 'iso_se',
      text: 'frame reads too thin'
    },
    {
      n: 2,
      file: 'tower_B',
      sheet: 'builds/narkina5/out/tower_B_3d/sheet.png',
      px: [412, 80],
      text: ''
    }
  ]
}

describe('round schema', () => {
  it('takes the finalised shape and refuses paths outside builds/', () => {
    expect(ReviewRoundSchema.parse(ROUND)).toEqual(ROUND)
    const bad = { ...ROUND, files: [{ ...ROUND.files[0], path: 'builds/../secret.litematic' }] }
    expect(() => ReviewRoundSchema.parse(bad)).toThrow()
    expect(() => ReviewRoundSchema.parse({ ...ROUND, files: [] })).toThrow()
  })
})

describe('gist', () => {
  it('is a Round heading the timeline parses, with pick, notes and pins', () => {
    const g = gist({ ...ROUND, round: 16 })
    expect(g.split('\n')[0]).toBe('### Round 16: Which crown do we keep? (2026-10-27)')
    expect(g).toContain('pick **tower_B** of tower_A, tower_B; approved: crown.')
    expect(g).toContain("- Notes: B's crown,\n  A's window rhythm")
    expect(g).toContain(
      '- Pin 1, tower_B (14, 96, 3) polished_tuff_wall[east=low]: frame reads too thin'
    )
    expect(g).toContain('- Pin 2, tower_B sheet px (412, 80)')
  })

  it('goes at the end of the log section, leaves Status and later sections alone', () => {
    const out = appendGist(MD, '### Round 16: x (2026-10-27)\n- y')
    expect(statusBlock(out).trimEnd()).toBe(statusBlock(MD).trimEnd())
    expect(statusBlock(MD)).toContain('Next step: none open.')
    expect(out).toContain(
      '- shipped\n\n### Round 16: x (2026-10-27)\n- y\n\n## 5. Notes\n- after the log\n'
    )
  })

  it('starts a log section when there is none, and keeps CRLF', () => {
    const md = '# B\r\n\r\n## Status\r\n- s\r\n'
    expect(appendGist(md, '### Round 1: q (d)')).toBe(
      '# B\r\n\r\n## Status\r\n- s\r\n\r\n## Process log\r\n\r\n### Round 1: q (d)\r\n'
    )
  })
})

describe('saveRound', () => {
  it('numbers after DESIGN.md and the round files, writes both, lists them back', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'studio-review-'))
    const dir = join(repo, 'builds', 'narkina5')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'DESIGN.md'), MD)
    expect(await nextRound(repo, 'narkina5')).toBe(16)
    const { round, path } = await saveRound(repo, ROUND)
    expect(round.round).toBe(16)
    expect(path).toBe('builds/narkina5/review/round_16.json')
    expect(JSON.parse(readFileSync(join(repo, path), 'utf8'))).toEqual({ ...ROUND, round: 16 })
    const md = readFileSync(join(dir, 'DESIGN.md'), 'utf8')
    expect(statusBlock(md).trimEnd()).toBe(statusBlock(MD).trimEnd())
    expect(md).toContain('### Round 16: Which crown do we keep? (2026-10-27)')
    expect(await nextRound(repo, 'narkina5')).toBe(17)
    expect((await listRounds(repo, 'narkina5')).map((r) => r.round)).toEqual([16])
  })

  it('refuses a sheet of another build', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'studio-review-'))
    mkdirSync(join(repo, 'builds', 'narkina5'), { recursive: true })
    const other = {
      ...ROUND,
      files: [{ ...ROUND.files[0], sheet: 'builds/other/out/a_3d/sheet.png' }]
    }
    await expect(saveRound(repo, other)).rejects.toThrow(/not in builds\/narkina5/)
  })
})

describe('writeDesign', () => {
  it('writes edits outside Status, refuses Status edits and stale bases', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'studio-design-'))
    const dir = join(repo, 'builds', 'narkina5')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'DESIGN.md')
    writeFileSync(file, MD)
    const edited = MD.replace('- after the log', '- edited by the user')
    await writeDesign(repo, 'narkina5', MD, edited)
    expect(readFileSync(file, 'utf8')).toBe(edited)
    await expect(
      writeDesign(repo, 'narkina5', edited, edited.replace('none open', 'mine'))
    ).rejects.toThrow(/Status/)
    await expect(writeDesign(repo, 'narkina5', MD, MD)).rejects.toThrow(/changed on disk/)
    expect(readFileSync(file, 'utf8')).toBe(edited)
  })
})
