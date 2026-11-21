import { describe, expect, it } from 'vitest'
import { headingAt } from './outline'

describe('headingAt', () => {
  const ids = ['a', 'b', 'c']
  it('is the first heading before any has reached the line', () => {
    expect(headingAt(ids, [40, 300, 900], 20)).toBe('a')
  })
  it('is the last heading that passed the line', () => {
    expect(headingAt(ids, [-500, 10, 400], 100)).toBe('b')
    expect(headingAt(ids, [-900, -400, 50], 100)).toBe('c')
  })
  it('is undefined with no headings', () => {
    expect(headingAt([], [], 100)).toBeUndefined()
  })
})
