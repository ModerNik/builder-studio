import { useEffect, useState, type ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import { JobStageIndicator } from '@/shared/ui/status/JobStageIndicator'
import { JobStrip } from '@/shared/ui/status/JobStrip'
import { DRAFT_STAGES } from '@/shared/ui/status/stages'
import type { JobState } from '@/shared/ui/status/state'
import { Cell, Grid, Narrow, Sub, Touch } from '../composites-demo'

export const meta = { group: 'Status', title: 'Job progress' }

/** A draft that walks its stages, so the live region, sweep and timer can be seen moving. */
function LiveDraft(): ReactElement {
  const [run, setRun] = useState<{ stage: number; state: JobState; seconds: number }>({
    stage: 0,
    state: 'running',
    seconds: 0
  })
  useEffect(() => {
    if (run.state !== 'running') return
    const timer = setInterval(
      () =>
        setRun((r) =>
          r.seconds % 3 === 2 && r.stage === DRAFT_STAGES.length - 1
            ? { ...r, state: 'done', seconds: r.seconds + 1 }
            : { ...r, seconds: r.seconds + 1, stage: r.seconds % 3 === 2 ? r.stage + 1 : r.stage }
        ),
      1000
    )
    return () => clearInterval(timer)
  }, [run.state])
  return (
    <div className="flex flex-col gap-3">
      <JobStageIndicator
        title="Draft generation"
        stages={DRAFT_STAGES}
        current={DRAFT_STAGES[run.stage].id}
        state={run.state}
        seconds={run.seconds}
        onStop={() => setRun((r) => ({ ...r, state: 'cancelled' }))}
      />
      <Button
        size="xs"
        variant="outline"
        className="self-start"
        onClick={() => setRun({ stage: 0, state: 'running', seconds: 0 })}
      >
        Restart demo
      </Button>
    </div>
  )
}

export default function JobProgress(): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <Sub
        title="JobStageIndicator"
        note="A staged job: the current stage, step n of N, elapsed time, a segmented bar and Stop. Stage changes are announced; the timer is not."
      >
        <Grid min="22rem">
          <Cell label="Live (demo walks the five draft stages)">
            <LiveDraft />
          </Cell>
          <Cell label="Queued">
            <JobStageIndicator title="Full build" stages={DRAFT_STAGES} state="queued" />
          </Cell>
          <Cell label="Done">
            <JobStageIndicator
              title="Draft generation"
              stages={DRAFT_STAGES}
              current="render"
              state="done"
              seconds={14}
            />
          </Cell>
          <Cell label="Failed at a stage">
            <JobStageIndicator
              title="Draft generation"
              stages={DRAFT_STAGES}
              current="lint"
              state="failed"
              seconds={6}
            />
          </Cell>
          <Cell label="Stopped by the user">
            <JobStageIndicator
              title="Full build"
              stages={DRAFT_STAGES}
              current="hollow"
              state="cancelled"
              seconds={203}
            />
          </Cell>
          <Cell label="Narrow, touch density">
            <Narrow width={18.75}>
              <Touch>
                <JobStageIndicator
                  title="Draft generation"
                  stages={DRAFT_STAGES}
                  current="render"
                  state="running"
                  seconds={71}
                  onStop={() => undefined}
                />
              </Touch>
            </Narrow>
          </Cell>
        </Grid>
      </Sub>
      <Sub
        title="JobStrip"
        note="The activity bar under the view: state line, the version's size, paste position (click copies it), Stop and the log toggle. A hairline stage bar runs along its top edge while a job runs."
      >
        <div className="flex flex-col gap-3">
          <Cell label="Ready, no job yet" surface="none">
            <JobStrip
              state="idle"
              dims={[48, 31, 52]}
              paste={[-212, 64, 1408]}
              open={open}
              onToggle={() => setOpen(!open)}
            />
          </Cell>
          <Cell label="Running" surface="none">
            <JobStrip
              title="Draft generation"
              state="running"
              stages={DRAFT_STAGES}
              current="hollow"
              seconds={9}
              dims={[48, 31, 52]}
              onStop={() => undefined}
              open={open}
              onToggle={() => setOpen(!open)}
            />
          </Cell>
          <Cell label="Complete" surface="none">
            <JobStrip
              title="Draft generation"
              state="done"
              seconds={14}
              dims={[48, 31, 52]}
              paste={[-212, 64, 1408]}
              open={open}
              onToggle={() => setOpen(!open)}
            />
          </Cell>
          <Cell label="Failed" surface="none">
            <JobStrip
              title="Build check"
              state="failed"
              open={open}
              onToggle={() => setOpen(!open)}
            />
          </Cell>
          <Cell label="Narrow: wraps onto two lines" surface="none">
            <Narrow>
              <JobStrip
                title="Full build"
                state="running"
                stages={DRAFT_STAGES}
                current="write"
                seconds={125}
                dims={[128, 96, 140]}
                onStop={() => undefined}
                open={open}
                onToggle={() => setOpen(!open)}
              />
            </Narrow>
          </Cell>
        </div>
      </Sub>
    </div>
  )
}
