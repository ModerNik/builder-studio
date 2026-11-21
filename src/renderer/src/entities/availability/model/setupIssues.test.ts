import { describe, expect, it } from 'vitest'
import type { Availability } from '@shared/api'
import { keepDismissed, missingIssues, toastIssues } from './setupIssues'
import { clampCap } from '@/entities/settings/model/cap'

const availability = (missing: string[]): Availability =>
  ({
    checkedAt: 0,
    features: {},
    requirements: Object.fromEntries(
      ['workspace', 'engine', 'pack', 'browser', 'export', 'ai', 'claude', 'git', 'identity'].map(
        (r) => [r, { ok: !missing.includes(r), detail: '', repair: 'runtime' }]
      )
    )
  }) as unknown as Availability

describe('setup issues', () => {
  it('lists missing requirements, never the Claude provider choice', () => {
    expect(missingIssues(undefined)).toEqual([])
    expect(missingIssues(availability(['claude', 'browser', 'ai']))).toEqual(['browser', 'ai'])
  })
  it('toasts only issues not dismissed, and forgets dismissals of fixed issues', () => {
    expect(toastIssues(['browser', 'ai'], ['ai'])).toEqual(['browser'])
    expect(keepDismissed(['ai', 'git'], ['ai'])).toEqual(['ai'])
  })
  it('clamps variants drafted at once to 2 to 6, never NaN', () => {
    expect([undefined, NaN, '', 'x', 1, 2, 4.4, 9].map(clampCap)).toEqual([3, 3, 3, 3, 2, 2, 4, 6])
  })
})
