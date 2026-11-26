import { expect, test } from 'vitest'
import type { ReviewRound } from '@shared/api'
import {
  edited,
  filterDesignDocument,
  mergeFromEdit,
  parseDesignDocument,
  refusal,
  restoreStatus,
  roundLine,
  roundOf,
  sameEol,
  splitForEdit,
  starterDesign,
  statusBlock,
  statusItems
} from './designLog'

const BASE = '# Gate\n\n## Status\n- Round 2 open\n\n## Process log\n\n### Round 1: q\n'

const FULL_DOC = `# Stone Watchtower

Decision log for this build: every brief answer, reference, review and result goes here
(newest at the bottom). Workflow: C:/Users/me/docs/pipeline.md. Keep **Status** current: it is all a new session
reads before the newest review entry.

## Status
- Current version: proto_v2
- Approved parts: foundation, lower wall
- Open items: roof overhang

## 1. Brief (2026-11-01)
- Purpose, site and size: Cliffside lookout, 16x32x16
- Style and palette: Deepslate & oxidized copper
- Paste spot:

## 2. References

## 3. Decisions
- Use copper grates for lantern housing.

## 4. Process log

### Round 1: Gatehouse roof pitch (2026-11-02)
- Review in Builder Studio, \`review/round_1.json\`: pick **proto_v2** of proto_v1, proto_v2; approved: foundation.
- Notes: Pitch feels right on v2.
- Pin 1, proto_v2 (12, 68, 4) oak_stairs[facing=north]: add corbel below.
- Agent follow-up: added stone brick corbels under the eaves.

### Shipped final_v1 (2026-11-05)

| Check | Result |
| --- | --- |
| Blocks | 4,210 |
`

const SAVED_ROUND_1: ReviewRound = {
  round: 1,
  build: 'watchtower',
  date: '2026-11-02',
  question: 'Gatehouse roof pitch',
  files: [
    {
      name: 'proto_v1',
      path: 'builds/watchtower/out/proto_v1.litematic',
      paste: null,
      sheet: null
    },
    {
      name: 'proto_v2',
      path: 'builds/watchtower/out/proto_v2.litematic',
      paste: [0, 64, 0],
      sheet: 'builds/watchtower/out/proto_v2_3d/sheet.png'
    }
  ],
  pick: 'proto_v2',
  approved: ['foundation'],
  notes: 'Pitch feels right on v2.',
  pins: [
    {
      n: 1,
      file: 'proto_v2',
      block: [12, 68, 4],
      state: 'minecraft:oak_stairs[facing=north]',
      view: 'iso_se',
      text: 'add corbel below'
    }
  ]
}

test('restoring the Status block keeps the rest of the edit', () => {
  const changed = BASE.replace('Round 2 open', 'mine').replace(
    '### Round 1: q',
    '### Round 1: q, fixed'
  )
  const fixed = restoreStatus(changed, BASE)
  expect(statusBlock(fixed)).toBe(statusBlock(BASE))
  expect(fixed).toContain('### Round 1: q, fixed')
  const dropped = '# Gate\n\n## Process log\n'
  expect(restoreStatus(dropped, BASE)).toBe(
    '# Gate\n\n## Status\n- Round 2 open\n\n## Process log\n'
  )
})

test('tells the two refusals apart', () => {
  expect(refusal(new Error('DESIGN.md changed on disk since you started editing'))).toBe('disk')
  expect(refusal('Error: The Status block is the agent’s: put it back as it was.')).toBe('status')
  expect(refusal(new Error('EACCES'))).toBeNull()
})

test('reads round numbers from headings', () => {
  expect(roundOf('Round 12: taller keep')).toBe(12)
  expect(roundOf('Notes')).toBeNull()
})

test('finds a round heading and splits Status lines', () => {
  expect(roundLine(BASE, 1)).toBe(BASE.indexOf('### Round 1'))
  expect(roundLine(BASE, 3)).toBe(-1)
  expect(statusItems(['**Round:** 2 open', 'no colon here'])).toEqual([
    { label: 'Round', value: '2 open' },
    { label: '2', value: 'no colon here' }
  ])
})

test('keeps the file’s line endings and mixed-ending Status blocks unchanged', () => {
  expect(sameEol('a\nb\n', 'x\r\ny')).toBe('a\r\nb\r\n')
  expect(sameEol('a\r\nb', 'x\r\ny')).toBe('a\r\nb')
  expect(sameEol('a\nb', 'x\ny')).toBe('a\nb')

  const base = '# T\r\n\r\n## Status\nRound: 1\n\r\n## Brief\r\nA tower\r\n'
  const shown = base.replace(/\r\n/g, '\n')
  expect(edited(shown, base)).toBe(false)
  expect(edited(shown + 'more\n', base)).toBe(true)
  const out = sameEol(shown + 'more\n', base)
  expect(statusBlock(out)).toBe(statusBlock(base))
  expect(out.endsWith('A tower\r\nmore\r\n')).toBe(true)
})

test('splitForEdit and mergeFromEdit hide Status from the editor and preserve it byte-for-byte', () => {
  const crlfBase = FULL_DOC.replace(/\n/g, '\r\n')
  const { body, hasStatus } = splitForEdit(crlfBase)
  expect(hasStatus).toBe(true)
  expect(body).not.toContain('## Status')
  expect(body).toContain('## 1. Brief')

  const editedBody = body.replace('copper grates', 'waxed copper grates')
  const merged = mergeFromEdit(editedBody, crlfBase)
  expect(statusBlock(merged).trimEnd()).toBe(statusBlock(crlfBase).trimEnd())
  expect(merged).toContain('waxed copper grates')
  expect(merged).toContain('\r\n')
})

test('parseDesignDocument strips boilerplate, empty placeholders, and merges saved review JSON', () => {
  const doc = parseDesignDocument(FULL_DOC, [SAVED_ROUND_1])
  expect(doc.title).toBe('Stone Watchtower')
  expect(doc.intro).toBe('') // legacy Workflow boilerplate stripped
  expect(doc.status).toHaveLength(3)
  expect(doc.status[1]).toMatchObject({
    label: 'Approved parts',
    parts: ['foundation', 'lower wall']
  })

  // Brief strips unfilled `- Paste spot:` placeholder
  expect(doc.brief?.empty).toBe(false)
  expect(doc.brief?.date).toBe('2026-11-01')
  expect(doc.brief?.body).toContain('Cliffside lookout')
  expect(doc.brief?.body).not.toContain('Paste spot:')

  // Empty `## 2. References` section is omitted; `## 3. Decisions` is kept
  expect(doc.sections.map((s) => s.title)).toEqual(['Decisions'])

  // Process log entries: Round 1 merged with JSON (no duplicate gist bullets) + Export entry
  expect(doc.entries).toHaveLength(2)
  const r1 = doc.entries[0]
  expect(r1.kind).toBe('round')
  if (r1.kind === 'round') {
    expect(r1.pick).toBe('proto_v2')
    expect(r1.approved).toEqual(['foundation'])
    expect(r1.sheet).toBe('builds/watchtower/out/proto_v2_3d/sheet.png')
    expect(r1.notes).toBe('Pitch feels right on v2.')
    expect(r1.pins).toEqual([
      {
        n: 1,
        file: 'proto_v2',
        location: '12, 68, 4',
        state: 'oak_stairs[facing=north]',
        text: 'add corbel below'
      }
    ])
    expect(r1.body).toBe('- Agent follow-up: added stone brick corbels under the eaves.')
  }

  const exp = doc.entries[1]
  expect(exp.kind).toBe('export')
  if (exp.kind === 'export') {
    expect(exp.stem).toBe('final_v1')
    expect(exp.date).toBe('2026-11-05')
  }
})

test('detects untouched scaffold template as empty Status and empty Brief, and filters entries', () => {
  const scaffold = starterDesign('My Keep', '2026-11-10')
  const doc = parseDesignDocument(scaffold)
  expect(doc.status).toEqual([])
  expect(doc.brief?.empty).toBe(true)
  expect(doc.sections).toEqual([])
  expect(doc.entries).toEqual([])

  const full = parseDesignDocument(FULL_DOC, [SAVED_ROUND_1])
  const filtered = filterDesignDocument(full, 'corbel')
  expect(filtered.entries).toHaveLength(1)
  expect(filtered.sections).toEqual([])
})
