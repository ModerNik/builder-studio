import { describe, expect, it } from 'vitest'
import { effortIndexOf, shortEffortStopLabel } from './modelEffort'

describe('ModelEffortPicker helpers', () => {
  const five = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'Extra high' },
    { value: 'max', label: 'Max' }
  ]

  it('maps effort values to stop indices safely', () => {
    expect(effortIndexOf(five, 'low')).toBe(0)
    expect(effortIndexOf(five, 'high')).toBe(2)
    expect(effortIndexOf(five, 'max')).toBe(4)
    expect(effortIndexOf(five, 'unknown')).toBe(0)
    expect(effortIndexOf([], 'high')).toBe(0)
  })

  it('shortens crowded stop labels only when 4+ stops exist', () => {
    expect(shortEffortStopLabel('medium', 'Medium', 3)).toBe('Medium')
    expect(shortEffortStopLabel('medium', 'Medium', 5)).toBe('Med')
    expect(shortEffortStopLabel('xhigh', 'Extra high', 5)).toBe('XHigh')
    expect(shortEffortStopLabel('high', 'High', 5)).toBe('High')
  })
})
