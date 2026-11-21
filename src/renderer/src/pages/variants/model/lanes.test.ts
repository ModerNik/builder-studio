import { describe, expect, it } from 'vitest'
import { laneFiles, lanePrompt, laneState, laneSummary } from './lanes'

describe('lanePrompt', () => {
  it('names the lane’s own files and run', () => {
    const p = lanePrompt('B', 2, 'tower', 'walk', 'Make the walkway.', 'arched')
    expect(p).toContain('variant B, one of 2')
    expect(p).toContain('Your direction (variant B): arched')
    expect(p).toContain('copying builds/tower/walk.py to builds/tower/walk_B.py')
    expect(p).toContain('--name walk_B')
  })
  it('skips an empty direction', () => {
    expect(lanePrompt('A', 2, 't', 'build', 'x', '  ')).not.toContain('Your direction')
  })
})

describe('laneFiles', () => {
  it('takes the newest file per lane', () => {
    const versions = [
      { path: 'builds/t/out/walk_B.litematic' },
      { path: 'builds/t/out/walk.litematic' },
      { path: 'builds/t/out/walk_A.litematic' },
      { path: 'builds/t/out/old_A.litematic' }
    ]
    expect(laneFiles(versions, ['A', 'B', 'C'])).toEqual([
      'builds/t/out/walk_A.litematic',
      'builds/t/out/walk_B.litematic'
    ])
  })
})

describe('lane state', () => {
  it('reads Starting, Needs you, Running, Failed and Done', () => {
    const st = (
      status: string,
      error: string | null = null
    ): { status: string; error: string | null } => ({ status, error })
    expect(laneState(undefined)).toBe('queued')
    expect(laneState({ asks: [1], state: st('running') })).toBe('awaiting-approval')
    expect(laneState({ asks: [], state: st('running') })).toBe('running')
    expect(laneState({ asks: [], state: st('idle', 'boom') })).toBe('failed')
    expect(laneState({ asks: [], state: st('idle') })).toBe('done')
    expect(laneSummary(['awaiting-approval', 'failed', 'done', 'running'])).toBe(
      '1 needs you · 1 failed · 1 done'
    )
  })
})
