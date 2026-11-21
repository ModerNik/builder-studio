import { describe, expect, it, vi } from 'vitest'
import type { ReviewRound } from '@shared/api'
import { lintText, rareBlocks, rejectedVariants, stacks } from './ship'
vi.mock('@/entities/job/model/jobs', () => ({ useJobs: {} }))

const round = (n: number, pick: string | null, names: string[]): ReviewRound =>
  ({
    round: n,
    pick,
    files: names.map((name) => ({ name, path: `builds/b/out/${name}.litematic` }))
  }) as unknown as ReviewRound

describe('ship', () => {
  it('lists the newest pick round’s other files still on disk', () => {
    const rounds = [
      round(1, 'a', ['a', 'b']),
      round(2, 'c', ['c', 'd', 'e']),
      round(3, null, ['f'])
    ]
    const r = rejectedVariants(rounds, ['builds/b/out/c.litematic', 'builds/b/out/d.litematic'])
    expect(r.round?.round).toBe(2)
    expect(r.paths).toEqual(['builds/b/out/d.litematic'])
    expect(rejectedVariants([], []).round).toBeUndefined()
  })

  it('says lint in words, leaving out info counts', () => {
    expect(lintText(undefined)).toBe('not run')
    expect(lintText({ palette: 4, floating: 1 })).toBe('clean')
    expect(lintText({ gravity: 3, palette: 1 })).toBe('falls (gravity) 3')
  })

  it('flags rare blocks', () => {
    expect(
      rareBlocks([
        ['minecraft:stone', 9],
        ['minecraft:sea_lantern', 2]
      ])
    ).toEqual([['minecraft:sea_lantern', 2]])
  })

  it('counts stacks of 64', () => {
    expect(stacks(12)).toBe('12')
    expect(stacks(1842)).toBe('28 × 64 + 50')
    expect(stacks(128)).toBe('2 × 64')
  })
})
