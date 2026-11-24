import { beforeEach, expect, it, vi } from 'vitest'
import type { SessionRef } from '@shared/api'

const mocks = vi.hoisted(() => ({
  fork: vi.fn(),
  rewind: vi.fn(),
  openSession: vi.fn(async () => {}),
  newThread: vi.fn(),
  send: vi.fn(async () => {}),
  invalidateQueries: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError
  }
}))

vi.mock('@/shared/api/studio', () => ({
  queryClient: { invalidateQueries: mocks.invalidateQueries },
  studio: {
    agent: {
      fork: mocks.fork,
      rewind: mocks.rewind
    }
  }
}))

vi.mock('./agent', () => ({
  openSession: mocks.openSession,
  newThread: mocks.newThread,
  send: mocks.send,
  setThreadTitle: vi.fn(),
  useAgent: { getState: () => ({ active: 't1' }) }
}))

const REF: SessionRef = { provider: 'claude', id: '00000000-0000-4000-8000-000000000001' }
const FORK: SessionRef = { provider: 'claude', id: '00000000-0000-4000-8000-000000000002' }

beforeEach(() => {
  vi.clearAllMocks()
})

it('forks a conversation from a specific turn and opens the new session', async () => {
  mocks.fork.mockResolvedValueOnce(FORK)
  const { forkThread } = await import('./panel')
  await forkThread(REF, 'tower', 'turn-2')
  expect(mocks.fork).toHaveBeenCalledWith(REF, 'tower', 'turn-2')
  expect(mocks.openSession).toHaveBeenCalledWith(FORK, 'tower')
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['agent-sessions', 'claude', 'tower']
  })
  expect(mocks.toastSuccess).toHaveBeenCalledWith('Forked conversation from this turn.')
})

it('edits a later message by rewinding to before it, restoring files when requested, and resending', async () => {
  mocks.rewind.mockResolvedValueOnce(FORK)
  const { editMessageTurn } = await import('./panel')
  await editMessageTurn(
    REF,
    'tower',
    'turn-2',
    'Updated prompt',
    ['build.py'],
    ['builds/tower/attachments/ref.png']
  )
  expect(mocks.rewind).toHaveBeenCalledWith(REF, 'tower', 'turn-2', ['build.py'])
  expect(mocks.openSession).toHaveBeenCalledWith(FORK, 'tower')
  expect(mocks.newThread).not.toHaveBeenCalled()
  expect(mocks.send).toHaveBeenCalledWith('Updated prompt', {
    attachments: ['builds/tower/attachments/ref.png']
  })
})

it('opens a fresh thread when editing the first message of a session', async () => {
  mocks.rewind.mockResolvedValueOnce(null)
  const { editMessageTurn } = await import('./panel')
  await editMessageTurn(REF, 'tower', 'turn-1', 'New first prompt', null)
  expect(mocks.rewind).toHaveBeenCalledWith(REF, 'tower', 'turn-1', null)
  expect(mocks.openSession).not.toHaveBeenCalled()
  expect(mocks.newThread).toHaveBeenCalledWith('tower')
  expect(mocks.send).toHaveBeenCalledWith('New first prompt', { attachments: undefined })
})
