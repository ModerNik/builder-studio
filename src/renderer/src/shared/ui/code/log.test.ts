import { describe, expect, it } from 'vitest'
import { findLines, follow, isNearBottom, lineTone, splitMatches, unseen, type Follow } from './log'

describe('isNearBottom', () => {
  it('treats a few pixels from the end as the bottom', () => {
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 800, clientHeight: 200 })).toBe(true)
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 780, clientHeight: 200 })).toBe(true)
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 700, clientHeight: 200 })).toBe(false)
  })
})

describe('follow (autoscroll pause)', () => {
  const start: Follow = { stuck: true, pausedAt: null }
  it('pauses when the user scrolls up and counts lines that arrive after', () => {
    const paused = follow(start, { type: 'scroll', nearBottom: false, total: 120 })
    expect(paused).toEqual({ stuck: false, pausedAt: 120 })
    expect(unseen(paused, 120)).toBe(0)
    expect(unseen(paused, 134)).toBe(14)
  })
  it('keeps the pause point while the user scrolls around above the end', () => {
    const paused = follow(start, { type: 'scroll', nearBottom: false, total: 120 })
    expect(follow(paused, { type: 'scroll', nearBottom: false, total: 150 })).toBe(paused)
  })
  it('resumes at the bottom or on jump', () => {
    const paused = follow(start, { type: 'scroll', nearBottom: false, total: 120 })
    expect(follow(paused, { type: 'scroll', nearBottom: true, total: 160 })).toEqual(start)
    expect(follow(paused, { type: 'jump' })).toEqual(start)
    expect(unseen(start, 999)).toBe(0)
    expect(follow(start, { type: 'scroll', nearBottom: true, total: 5 })).toBe(start)
  })
})

describe('log lines', () => {
  it('tones errors and warnings', () => {
    expect(lineTone('Traceback (most recent call last):')).toBe('error')
    expect(lineTone('lint: 3 problems, build failed')).toBe('error')
    expect(lineTone('WARNING: leaves may decay at 12 64 -3')).toBe('warning')
    expect(lineTone('@mcb stage generate')).toBeNull()
    expect(lineTone('terrorist')).toBeNull()
  })
  it('finds and splits matches without regard to case', () => {
    const lines = ['@mcb stage lint', 'Lint: 0 problems', 'wrote out/v3.litematic']
    expect(findLines(lines, 'lint')).toEqual([0, 1])
    expect(findLines(lines, '  ')).toEqual([])
    expect(splitMatches('Lint ok, lint done', 'LINT')).toEqual([
      { text: 'Lint', hit: true },
      { text: ' ok, ', hit: false },
      { text: 'lint', hit: true },
      { text: ' done', hit: false }
    ])
    expect(splitMatches('abc', '')).toEqual([{ text: 'abc', hit: false }])
  })
})
