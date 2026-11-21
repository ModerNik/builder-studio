import { describe, expect, it } from 'vitest'
import { comparisonBaseline, toggleComparedVersion } from './comparison'

describe('comparison selection', () => {
  it('keeps the current four versions when a fifth is selected', () => {
    expect(toggleComparedVersion(['a', 'b', 'c', 'd'], 'e')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('allows removing the final selection and selecting again', () => {
    const selected = toggleComparedVersion(['a'], 'a')
    expect(selected).toEqual([])
    expect(toggleComparedVersion(selected, 'b')).toEqual(['b'])
  })
})

describe('comparison baseline', () => {
  const versions = [
    { path: 'old', mtime: 10 },
    { path: 'new', mtime: 30 },
    { path: 'middle', mtime: 20 }
  ]

  it('defaults to the closest older version regardless of list order', () => {
    expect(comparisonBaseline(versions, versions[1], null)?.path).toBe('middle')
  })

  it('honors a selected baseline and recovers when it disappears', () => {
    expect(comparisonBaseline(versions, versions[1], 'old')?.path).toBe('old')
    expect(comparisonBaseline(versions, versions[1], 'deleted')?.path).toBe('middle')
  })

  it('never compares a version with itself and supports the oldest target', () => {
    expect(comparisonBaseline(versions, versions[0], 'old')?.path).toBe('new')
    expect(comparisonBaseline([versions[0]], versions[0], null)).toBeNull()
    expect(comparisonBaseline(versions, null, null)).toBeNull()
  })
})
