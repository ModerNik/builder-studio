import { expect, it, vi } from 'vitest'
import { type Job } from '@shared/api'
import { MAX_JOB_LOG, MAX_JOBS } from '@shared/constants'

// every window.studio call resolves to [] and every subscription is a no-op
vi.hoisted(() => {
  const api: object = new Proxy(() => Promise.resolve([]), { get: () => api })
  Object.assign(globalThis, { window: { studio: api, location: {} } })
})
const { useJobs } = await import('./jobs')

it('keeps a running job log out of the job list, capped, and folds it in at the end', () => {
  const job = {
    id: 1,
    spec: { build: 'b', part: 'proto' },
    state: 'running',
    events: [],
    log: ['x']
  }
  const { apply } = useJobs.getState()
  apply({ id: 1, kind: 'start', job: job as unknown as Job })
  const jobs = useJobs.getState().jobs
  apply({ id: 1, kind: 'log', lines: ['a', 'b'] })
  expect(useJobs.getState().jobs).toBe(jobs)
  expect(useJobs.getState().logs[1]).toEqual(['x', 'a', 'b'])
  apply({ id: 1, kind: 'log', lines: Array.from({ length: MAX_JOB_LOG }, (_, i) => String(i)) })
  expect(useJobs.getState().logs[1]).toHaveLength(MAX_JOB_LOG)
  apply({ id: 1, kind: 'end', state: 'failed', code: 1 })
  expect(useJobs.getState().logs).toEqual({})
  expect(useJobs.getState().jobs[0].log.at(-1)).toBe(String(MAX_JOB_LOG - 1))
})

it('keeps only the newest jobs, like main', () => {
  const { apply } = useJobs.getState()
  for (let id = 100; id < 100 + MAX_JOBS + 5; id++)
    apply({ id, kind: 'start', job: { id, events: [], log: [] } as unknown as Job })
  const ids = useJobs.getState().jobs.map((j) => j.id)
  expect(ids).toHaveLength(MAX_JOBS)
  expect(ids[0]).toBe(100 + MAX_JOBS + 4)
})
