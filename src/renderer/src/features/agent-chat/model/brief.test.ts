import { describe, expect, it } from 'vitest'
import { getBrief, lastRound, setBrief } from './brief'

const MD = `# Narkina 5

## Status
Round 3 approved. Next: crown.

## 1. Brief (2026-09-01)

A prison tower.

## 2. References

- ref

## 4. Process log

### Round 2
x
### Round 3
y
`

describe('brief', () => {
  it('replaces §1 and leaves Status and the rest alone', () => {
    const out = setBrief(MD, 'narkina5', 'A taller tower.', '2026-10-27')
    expect(out).toContain('## Status\nRound 3 approved. Next: crown.\n')
    expect(out).toContain('## 1. Brief (2026-10-27)\n\nA taller tower.\n\n## 2. References')
    expect(out).not.toContain('A prison tower.')
    expect(getBrief(out)).toBe('A taller tower.')
  })

  it('inserts §1 before §2, or starts a new file', () => {
    const noBrief = MD.replace(/## 1\. Brief[\s\S]*?(?=## 2\.)/, '')
    expect(setBrief(noBrief, 'n', 'B', 'd')).toMatch(
      /## Status\n[^#]*\n## 1\. Brief \(d\)\n\nB\n\n## 2\./
    )
    expect(setBrief('', 'n', 'B', 'd')).toBe('# n\n\n## 1. Brief (d)\n\nB\n\n')
  })

  it('finds the last round', () => {
    expect(lastRound(MD)).toBe(3)
    expect(lastRound('')).toBe(0)
  })
})
