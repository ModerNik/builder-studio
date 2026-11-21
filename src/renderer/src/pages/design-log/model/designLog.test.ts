import { expect, test } from 'vitest'
import {
  refusal,
  restoreStatus,
  roundLine,
  roundOf,
  sameEol,
  edited,
  statusBlock,
  statusItems
} from './designLog'

const BASE = '# Gate\n\n## Status\n- Round 2 open\n\n## Process log\n\n### Round 1: q\n'

test('restoring the Status block keeps the rest of the edit', () => {
  const edited = BASE.replace('Round 2 open', 'mine').replace(
    '### Round 1: q',
    '### Round 1: q, fixed'
  )
  const fixed = restoreStatus(edited, BASE)
  expect(statusBlock(fixed)).toBe(statusBlock(BASE))
  expect(fixed).toContain('### Round 1: q, fixed')
  // the edit dropped the block: it goes back where it was
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

test('keeps the file’s line endings', () => {
  expect(sameEol('a\nb\n', 'x\r\ny')).toBe('a\r\nb\r\n')
  expect(sameEol('a\r\nb', 'x\r\ny')).toBe('a\r\nb')
  expect(sameEol('a\nb', 'x\ny')).toBe('a\nb')
})

test('a file with mixed line endings is not dirty until edited, and its Status block saves as it was', () => {
  const base = '# T\r\n\r\n## Status\nRound: 1\n\r\n## Brief\r\nA tower\r\n'
  const shown = base.replace(/\r\n/g, '\n') // what the textarea hands back
  expect(edited(shown, base)).toBe(false)
  expect(edited(shown + 'more\n', base)).toBe(true)
  const out = sameEol(shown + 'more\n', base)
  expect(statusBlock(out)).toBe(statusBlock(base))
  expect(out.endsWith('A tower\r\nmore\r\n')).toBe(true)
})
