import { expect, it, vi } from 'vitest'
import { batchDeltas } from './delta-batch'

const delta = (id: string, text: string, thread = 't1'): unknown => ({
  thread,
  data: { type: 'text', id, text, parent: null, delta: true }
})

it('merges a thread’s consecutive text deltas and flushes before its other messages', () => {
  vi.useFakeTimers()
  const send = vi.fn()
  const emit = batchDeltas(send, 50)
  emit('agent:msg', delta('a', 'Hel'))
  emit('agent:msg', delta('a', 'lo'))
  emit('agent:msg', delta('x', 'other thread', 't2'))
  expect(send).not.toHaveBeenCalled()
  emit('agent:state', { thread: 't1', data: { status: 'idle' } })
  expect(send.mock.calls).toEqual([
    [
      'agent:msg',
      { thread: 't1', data: { type: 'text', id: 'a', text: 'Hello', parent: null, delta: true } }
    ],
    ['agent:state', { thread: 't1', data: { status: 'idle' } }]
  ])
  vi.advanceTimersByTime(50)
  expect(send).toHaveBeenLastCalledWith('agent:msg', delta('x', 'other thread', 't2'))
  emit('agent:msg', delta('a', '1'))
  emit('agent:msg', delta('b', '2')) // a new item flushes the previous one
  expect(send).toHaveBeenLastCalledWith('agent:msg', delta('a', '1'))
  emit('variant:msg', { lane: 'A', data: { type: 'text', id: 'v', text: 'v', delta: true } })
  emit('jobs:update', { id: 1 })
  expect(send).toHaveBeenLastCalledWith('jobs:update', { id: 1 })
  vi.advanceTimersByTime(50)
  expect(send).toHaveBeenCalledTimes(7) // item b and the variant lane
  vi.useRealTimers()
})
