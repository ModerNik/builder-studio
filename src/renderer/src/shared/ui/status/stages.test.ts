import { describe, expect, it } from 'vitest'
import { DRAFT_STAGES, stageProgress } from './stages'
import { formatElapsed } from '@/shared/ui/common/time'

describe('stageProgress', () => {
  it('marks earlier stages done and the current one live', () => {
    const p = stageProgress(DRAFT_STAGES, 'lint', 'running')
    expect(p.index).toBe(1)
    expect(p.segments).toEqual(['done', 'current', 'pending', 'pending', 'pending'])
    expect(p.fraction).toBeCloseTo(0.2)
    expect(p.label).toBe('Checking blocks')
  })
  it('fills every segment when done, whatever the last stage event was', () => {
    const p = stageProgress(DRAFT_STAGES, 'write', 'done')
    expect(p.segments.every((s) => s === 'done')).toBe(true)
    expect(p.fraction).toBe(1)
    expect(p.label).toBe('Complete')
  })
  it('names the stage a failed or stopped job reached', () => {
    expect(stageProgress(DRAFT_STAGES, 'hollow', 'failed')).toMatchObject({
      label: 'Failed at Removing hidden blocks',
      segments: ['done', 'done', 'failed', 'pending', 'pending']
    })
    expect(stageProgress(DRAFT_STAGES, 'render', 'cancelled').label).toBe(
      'Stopped at Creating preview images'
    )
  })
  it('handles a job with no stage event yet or an unknown stage', () => {
    expect(stageProgress(DRAFT_STAGES, null, 'running')).toMatchObject({
      index: -1,
      fraction: 0,
      label: 'Starting'
    })
    expect(stageProgress(DRAFT_STAGES, 'mystery', 'failed').label).toBe('Failed before it started')
    expect(stageProgress(DRAFT_STAGES, undefined, 'queued').label).toBe('Waiting to start')
    expect(stageProgress([], null, 'running').fraction).toBe(0)
  })
})

describe('formatElapsed', () => {
  it('reads seconds, minutes and hours', () => {
    expect(formatElapsed(0)).toBe('0s')
    expect(formatElapsed(42.9)).toBe('42s')
    expect(formatElapsed(65)).toBe('1m 05s')
    expect(formatElapsed(3720)).toBe('1h 02m')
    expect(formatElapsed(-3)).toBe('0s')
  })
})
