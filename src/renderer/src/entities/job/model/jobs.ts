// The job stream from the main process as a zustand store.
import { create } from 'zustand'
import { MAX_JOB_LOG, type Job, type JobUpdate, type McbEvent } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'

interface JobStore {
  jobs: Job[] // newest first
  // running jobs' output, kept out of `jobs` so a log batch doesn't re-render every job list
  logs: Record<number, string[]>
  apply(u: JobUpdate): void
}

export const useJobs = create<JobStore>((set) => ({
  jobs: [],
  logs: {},
  apply: (u) =>
    set(({ jobs, logs }) => {
      if (u.kind === 'start') return { jobs: [u.job, ...jobs.filter((j) => j.id !== u.id)] }
      if (u.kind === 'log') {
        const log = logs[u.id] ?? jobs.find((j) => j.id === u.id)?.log ?? []
        return { logs: { ...logs, [u.id]: [...log, ...u.lines].slice(-MAX_JOB_LOG) } }
      }
      const { [u.id]: log, ...rest } = logs
      return {
        logs: u.kind === 'end' ? rest : logs,
        jobs: jobs.map((j) => {
          if (j.id !== u.id) return j
          if (u.kind === 'event')
            return {
              ...j,
              events: [...j.events, u.event],
              stage: u.event.event === 'stage' ? u.event.name : j.stage
            }
          return { ...j, log: log ?? j.log, state: u.state, code: u.code, ended: Date.now() }
        })
      }
    })
}))

void studio.jobs.list().then((jobs) => useJobs.setState({ jobs }))
studio.jobs.onUpdate((u) => {
  useJobs.getState().apply(u)
  if (u.kind === 'end') void queryClient.invalidateQueries({ queryKey: ['builds'] })
})

/** The newest job of a build, and what its events say. */
export function lastOf(job: Job | undefined): {
  [K in 'wrote' | 'sheet' | 'lint' | 'blocks' | 'done' | 'bill']:
    Extract<McbEvent, { event: K }> | undefined
} {
  const ev = <E extends Job['events'][number]['event']>(
    name: E
  ): Extract<McbEvent, { event: E }> | undefined =>
    job?.events.findLast((e) => e.event === name) as
      Extract<Job['events'][number], { event: E }> | undefined
  return {
    wrote: ev('wrote'),
    sheet: ev('sheet'),
    lint: ev('lint'),
    blocks: ev('blocks'),
    done: ev('done'),
    bill: ev('bill')
  }
}

/** What a job's part is called in status lines and toasts. */
export const PART_LABEL: Record<Job['spec']['part'], string> = {
  proto: 'Draft generation',
  check: 'Build check',
  full: 'Full build',
  dump: 'Layer export'
}

export const cancelJob = (id: number): void => void studio.jobs.cancel(id)
