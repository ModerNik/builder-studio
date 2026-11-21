import { type ReactElement } from 'react'
import { StatusBar, type StatusJob } from '@/widgets/workbench-shell/ui/StatusBar'
import { Specimen } from './shell-demo/Specimen'

export const meta = { group: 'Shell', title: 'Status bar' }

const noop = (): void => {}
const JOBS: [string, StatusJob | null][] = [
  [
    'Running, with Stop',
    {
      label: 'Generate draft',
      stage: 'Checking blocks 2 of 5',
      elapsed: '0:21',
      state: 'running',
      onStop: noop,
      onOpen: noop
    }
  ],
  [
    'Waiting for approval',
    {
      label: 'Generate draft',
      stage: 'Run this command?',
      elapsed: '1:04',
      state: 'awaiting-approval',
      onOpen: noop
    }
  ],
  ['Queued', { label: 'Render preview', stage: 'After the draft', state: 'queued', onOpen: noop }],
  [
    'Failed',
    {
      label: 'Generate draft',
      stage: 'Python stopped at line 22',
      elapsed: '0:48',
      state: 'failed',
      onOpen: noop
    }
  ],
  [
    'Failed, after it ended (no stage)',
    { label: 'qa_broken · Draft generation', elapsed: '0:22', state: 'failed', onOpen: noop }
  ],
  [
    'Done',
    {
      label: 'Generate draft',
      stage: 'stone_bridge_v4 is ready',
      elapsed: '1:12',
      state: 'done',
      onOpen: noop
    }
  ],
  ['Nothing running', null]
]

export default function StatusBarDemo(): ReactElement {
  return (
    <div>
      <p className="mb-4 max-w-prose text-fg-secondary">
        One line under the workbench: the current job with Stop, Recent jobs, problems, the engine
        and the assistant. A job that is not running says its state in words after its label. Under
        640px the stage and the state labels drop out; screen readers still hear them.
      </p>
      <Specimen
        label="Job states"
        resizable
        className="flex w-[60rem] flex-col gap-2 bg-surface-sunken"
      >
        {JOBS.map(([label, job], i) => (
          <div key={label}>
            <p className="mb-1 text-xs text-fg-muted">{label}</p>
            <StatusBar
              job={job}
              problems={[3, 0, 0, 1, 0, 0][i]}
              onProblems={noop}
              engine="ready"
              assistant={i === 1 ? 'waiting' : i === 0 ? 'working' : 'idle'}
              assistantName="Claude Code"
            />
          </div>
        ))}
      </Specimen>
      <Specimen
        label="Engine and assistant states; the second has no problems count (app page)"
        resizable
        className="flex w-[60rem] flex-col gap-2 bg-surface-sunken"
      >
        <StatusBar engine="starting" assistant="off" problems={12} onProblems={noop} />
        {/* no problems prop: an app page, where no problems are known, so the item is hidden */}
        <StatusBar engine="offline" assistant="idle" assistantName="Codex" />
        <StatusBar
          engine="error"
          assistant="working"
          assistantName="Claude Code"
          problems={1}
          onProblems={noop}
        />
      </Specimen>
      <Specimen
        label="Recent jobs: the last four, newest first, in a popover above the bar; a row opens Activity"
        resizable
        className="flex w-[60rem] flex-col gap-2 bg-surface-sunken"
      >
        <StatusBar
          job={JOBS[0][1]}
          recent={[JOBS[0][1]!, JOBS[3][1]!, JOBS[5][1]!, JOBS[4][1]!]}
          engine="ready"
          assistant="working"
          assistantName="Claude Code"
        />
      </Specimen>
      <Specimen
        label="Needs you: asks waiting on the user, beside problems; hidden at 0"
        resizable
        className="flex w-[60rem] flex-col gap-2 bg-surface-sunken"
      >
        <StatusBar
          job={JOBS[1][1]}
          needsYou={1}
          onNeedsYou={noop}
          engine="ready"
          assistant="waiting"
          assistantName="Claude Code"
        />
        <StatusBar
          job={JOBS[0][1]}
          needsYou={3}
          onNeedsYou={noop}
          problems={2}
          onProblems={noop}
          engine="ready"
          assistant="waiting"
          assistantName="Claude Code"
        />
      </Specimen>
      <Specimen
        label="Hand edits: blocks changed by hand in the open build, saved, saving or not saved"
        resizable
        className="flex w-[60rem] flex-col gap-2 bg-surface-sunken"
      >
        {(['saved', 'saving', 'failed'] as const).map((save, i) => (
          <StatusBar
            key={save}
            handEdits={{ count: [12, 1, 240][i], save }}
            problems={0}
            onProblems={noop}
            engine="ready"
            assistant="idle"
            assistantName="Claude Code"
          />
        ))}
      </Specimen>
      <Specimen label="Phone width" className="w-[24.375rem] max-w-full bg-surface-sunken">
        <StatusBar
          job={JOBS[0][1]}
          recent={[JOBS[0][1]!, JOBS[3][1]!]}
          problems={3}
          onProblems={noop}
          needsYou={2}
          onNeedsYou={noop}
          handEdits={{ count: 12, save: 'saved' }}
          engine="ready"
          assistant="waiting"
          assistantName="Claude Code"
        />
      </Specimen>
    </div>
  )
}
