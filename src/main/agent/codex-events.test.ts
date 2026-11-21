import { expect, it } from 'vitest'
import { codexEvents } from './codex-events'

it('maps a completed plan item to a plan text event', () => {
  const plan = { type: 'plan', id: 'p1', text: '1. Walls\n2. Roof' }
  expect(codexEvents(plan, false)).toEqual([])
  expect(codexEvents(plan, true)).toEqual([
    { type: 'text', id: 'p1', text: '1. Walls\n2. Roof', parent: null, plan: true }
  ])
})
