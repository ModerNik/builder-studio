import { describe, expect, it } from 'vitest'
import type { PermissionAsk } from '@shared/api'
import type { Item } from './transcript'
import { formatPlanRevision, planRevisions } from './plans'

describe('formatPlanRevision', () => {
  it('returns trimmed note when there are no comments', () => {
    expect(formatPlanRevision([], '  Make the roof steeper.  ')).toBe('Make the roof steeper.')
    expect(formatPlanRevision([], '   ')).toBe('')
  })

  it('formats quoted selection comments with optional additional notes', () => {
    const out = formatPlanRevision(
      [
        { id: '1', quote: 'Raise keep walls\n  to 24 blocks', text: 'Keep at 20 blocks max' },
        { id: '2', quote: 'dark oak gable', text: 'Use spruce stairs instead' },
        { id: '3', quote: 'ignored', text: '   ' }
      ],
      'Keep parapet walkable'
    )
    expect(out).toBe(
      [
        'Please revise the plan based on these comments:',
        '',
        '1. On "Raise keep walls to 24 blocks":',
        '   Keep at 20 blocks max',
        '2. On "dark oak gable":',
        '   Use spruce stairs instead',
        '',
        'Additional notes:',
        'Keep parapet walkable'
      ].join('\n')
    )
  })
})

describe('planRevisions', () => {
  it('tracks consecutive Codex plan revisions, pairs diffs, and marks only the latest active', () => {
    const items: Item[] = [
      { kind: 'user', id: 'u1', text: 'Plan the keep' },
      { kind: 'text', id: 'p1', parent: null, text: '1. Walls 18', plan: true },
      { kind: 'user', id: 'u2', text: 'Make them 22' },
      { kind: 'text', id: 'p2', parent: null, text: '1. Walls 22', plan: true }
    ]
    const res = planRevisions(items)
    expect(res.byId.get('p1')).toEqual({ revision: 1 })
    expect(res.byId.get('p2')).toEqual({ revision: 2, previousPlan: '1. Walls 18' })
    expect(res.activeCodexPlanId).toBe('p2')

    // Once the user follows up after p2, p2 is no longer active.
    const afterReply = planRevisions([...items, { kind: 'user', id: 'u3', text: 'Implement' }])
    expect(afterReply.activeCodexPlanId).toBeNull()
  })

  it('resets revision numbering after mutating tool work begins', () => {
    const items: Item[] = [
      { kind: 'text', id: 'p1', parent: null, text: 'Phase 1 plan', plan: true },
      { kind: 'tool', id: 'e1', name: 'Edit', input: { file_path: 'build.py' }, parent: null },
      { kind: 'text', id: 'p2', parent: null, text: 'Phase 2 plan', plan: true }
    ]
    const res = planRevisions(items)
    expect(res.byId.get('p2')).toEqual({ revision: 1 })
    expect(res.activeCodexPlanId).toBe('p2')
  })

  it('pairs Claude ExitPlanMode asks with prior ExitPlanMode tool items without double-counting self', () => {
    const activeAsk: PermissionAsk = {
      id: 'exit-2',
      build: 'tower',
      tool: 'ExitPlanMode',
      kind: 'plan',
      input: { plan: 'v2 plan' },
      title: null,
      reason: null,
      guard: null,
      rule: null,
      agent: null
    }
    const items: Item[] = [
      {
        kind: 'tool',
        id: 'exit-1',
        name: 'ExitPlanMode',
        input: { plan: 'v1 plan' },
        parent: null
      },
      { kind: 'tool', id: 'exit-2', name: 'ExitPlanMode', input: { plan: 'v2 plan' }, parent: null }
    ]
    const res = planRevisions(items, activeAsk)
    expect(res.activeAsk).toEqual({ revision: 2, previousPlan: 'v1 plan' })
  })
})
