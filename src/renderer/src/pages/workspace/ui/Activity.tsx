// The Workspace Activity dock: the job's stages, timing and log, the version's size and paste position.
import type { ReactElement } from 'react'
import { History } from 'lucide-react'
import { CopyButton } from '@/shared/ui/common/CopyButton'
import { useElapsed } from '@/shared/ui/common/time'
import { LogViewer } from '@/shared/ui/code/LogViewer'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { JobStageIndicator } from '@/shared/ui/status/JobStageIndicator'
import { DRAFT_STAGES } from '@/shared/ui/status/stages'
import { lastOf, useJobs } from '@/entities/job/model/jobs'
import { cancelJob } from '@/entities/job/model/jobs'
import { JOB_LABELS } from '@/entities/build/model/workspace'
import { useFps } from '@/pages/workspace/model/analysis'
import type { ViewerStats } from '@/entities/viewer/ui/BuildViewer'
import type { Job } from '@shared/api'

const EMPTY_LOG: string[] = []
const stop = (job: Job): void => cancelJob(job.id)

/** The Activity dock: the running or last job with its stages and log, load time and frame rate. */
export function ActivityPane({ job, stats }: { job?: Job; stats: ViewerStats }): ReactElement {
  const fps = useFps((s) => s.fps)
  const log = useJobs((s) => (job && s.logs[job.id]) || job?.log || EMPTY_LOG)
  const live = job?.state === 'running'
  const { wrote } = lastOf(job)
  const elapsed = useElapsed(job?.started, live)
  const seconds = job
    ? live
      ? elapsed
      : Math.round(((job.ended ?? job.started) - job.started) / 1000)
    : undefined
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-muted">
        {stats.loadMs > 0 && (
          <span className="tabular-nums">Loaded in {(stats.loadMs / 1000).toFixed(1)} s</span>
        )}
        <span className="tabular-nums">{fps} fps</span>
        {stats.dims && (
          <span className="font-mono tabular-nums">
            {stats.dims.join(' × ')} <span className="font-sans">blocks</span>
            <span className="sr-only"> (width × height × depth)</span>
          </span>
        )}
        {wrote && (
          <span className="flex items-center gap-1">
            Paste at <span className="font-mono tabular-nums">{wrote.paste.join(', ')}</span>
            <CopyButton text={wrote.paste.join(' ')} label="Copy paste position" size="xs" />
          </span>
        )}
      </div>
      {job ? (
        <>
          <JobStageIndicator
            className="shrink-0"
            title={JOB_LABELS[job.spec.part]}
            stages={DRAFT_STAGES}
            current={job.stage}
            state={job.state}
            seconds={seconds}
            onStop={() => stop(job)}
          />
          <LogViewer
            lines={log.length ? log : ['No detailed output for this build.']}
            streaming={live}
            label={`${JOB_LABELS[job.spec.part]} log`}
            height="min-h-0 flex-1"
            className="min-h-24 flex-1"
          />
        </>
      ) : (
        <EmptyState icon={History} title="No build activity yet">
          Build activity will appear here after you generate or check a build.
        </EmptyState>
      )}
    </div>
  )
}
