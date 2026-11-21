import { describe, expect, it } from 'vitest'
import { normaliseHex } from './colour'

describe('normaliseHex', () => {
  it('accepts #rgb and #rrggbb with or without the hash, in any case', () => {
    expect(normaliseHex('#ABC')).toBe('#aabbcc')
    expect(normaliseHex(' 8a6f4e ')).toBe('#8a6f4e')
  })
  it('rejects anything else', () => {
    for (const t of ['', '#12', '#12345', 'rgb(1,2,3)', '#ggg']) expect(normaliseHex(t)).toBeNull()
  })
})
