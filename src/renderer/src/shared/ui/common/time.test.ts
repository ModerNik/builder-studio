import { describe, expect, it } from 'vitest'
import { formatElapsed, formatFullDateTime, formatRelativeTime } from './time'

describe('time formatting', () => {
  const base = Date.UTC(2026, 10, 27, 14, 30, 0)

  it('formats elapsed durations', () => {
    expect(formatElapsed(0)).toBe('0s')
    expect(formatElapsed(42)).toBe('42s')
    expect(formatElapsed(185)).toBe('3m 05s')
    expect(formatElapsed(3720)).toBe('1h 02m')
  })

  it('formats relative timestamps across ranges', () => {
    expect(formatRelativeTime(base - 10_000, base)).toBe('just now')
    expect(formatRelativeTime(base + 5_000, base)).toBe('just now')
    expect(formatRelativeTime(base - 5 * 60_000, base)).toBe('5m ago')
    expect(formatRelativeTime(base - 3 * 3600_000, base)).toBe('3h ago')
    expect(formatRelativeTime(base - 2 * 86_400_000, base)).toBe('2d ago')
    const older = formatRelativeTime(base - 14 * 86_400_000, base)
    expect(older).toMatch(/13/)
  })

  it('formats a non-empty full date and time string', () => {
    const full = formatFullDateTime(base)
    expect(full.length).toBeGreaterThan(8)
    expect(full).toMatch(/2026/)
  })
})
