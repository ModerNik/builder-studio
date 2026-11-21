import { describe, expect, it } from 'vitest'
import { clampNumber, pageWindow, parseNumber } from './math'

describe('clampNumber', () => {
  it('clamps to min and max', () => {
    expect(clampNumber(-5, { min: 0, max: 10 })).toBe(0)
    expect(clampNumber(50, { min: 0, max: 10 })).toBe(10)
    expect(clampNumber(4, { min: 0, max: 10 })).toBe(4)
  })
  it('rounds to the step decimals', () => {
    expect(clampNumber(0.1 + 0.2, { step: 0.1 })).toBe(0.3)
    expect(clampNumber(2.6, { step: 1 })).toBe(3)
  })
})

describe('parseNumber', () => {
  it('reads numbers with a dot or comma', () => {
    expect(parseNumber(' 12 ')).toBe(12)
    expect(parseNumber('-3.5')).toBe(-3.5)
    expect(parseNumber('1,25')).toBe(1.25)
    expect(parseNumber('.5')).toBe(0.5)
  })
  it('rejects text that is not a number', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('1e3')).toBeNull()
    expect(parseNumber('-')).toBeNull()
  })
})

describe('pageWindow', () => {
  it('keeps the ends and the neighbours, with gaps', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10])
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4])
  })
})
