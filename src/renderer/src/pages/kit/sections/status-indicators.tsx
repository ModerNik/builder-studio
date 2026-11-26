import type { ReactElement } from 'react'
import { CircleCheck, KeyRound, Unplug } from 'lucide-react'
import { JOB_STATES, STATE } from '@/shared/ui/status/state'
import { StatusDot } from '@/shared/ui/status/StatusDot'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { LiveStatusPill } from '@/shared/ui/status/LiveStatusPill'
import { Cell, Grid, Sub } from '../composites-demo'

export const meta = { group: 'Status', title: 'Status indicators' }

export default function StatusIndicators(): ReactElement {
  return (
    <div>
      <Sub
        title="StatusDot"
        note="Every job and agent state has its own shape and colour, and its name for screen readers. Running spins unless motion is reduced."
      >
        <Cell label="All states">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {JOB_STATES.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <StatusDot state={s} label="" />
                <span className="text-sm text-fg-secondary">{STATE[s].label}</span>
              </li>
            ))}
          </ul>
        </Cell>
      </Sub>
      <Sub
        title="StatusBadge"
        note="A job state as a chip, or a tone with its own words, like the provider cards in Settings."
      >
        <Grid min="20rem">
          <Cell label="Job states">
            <div className="flex flex-wrap gap-2">
              {JOB_STATES.map((s) => (
                <StatusBadge key={s} state={s} />
              ))}
            </div>
          </Cell>
          <Cell label="Provider status (tones)">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="success" icon={CircleCheck}>
                Ready
              </StatusBadge>
              <StatusBadge tone="warning" icon={KeyRound}>
                Sign-in needed
              </StatusBadge>
              <StatusBadge tone="neutral" icon={Unplug}>
                Not connected
              </StatusBadge>
              <StatusBadge tone="danger">lint 3 problems</StatusBadge>
              <StatusBadge tone="info">dry run</StatusBadge>
            </div>
          </Cell>
          <Cell label="Long text in a narrow cell" className="w-48">
            <StatusBadge state="awaiting-approval">
              Awaiting approval from the builder for Bash
            </StatusBadge>
          </Cell>
        </Grid>
      </Sub>
      <Sub
        title="LiveStatusPill"
        note="What is live now, for toolbars and dock headers. A polite live region: a new label is announced."
      >
        <Grid min="16rem">
          <Cell label="Running">
            <LiveStatusPill state="running" label="Assistant working" detail="42s" />
          </Cell>
          <Cell label="Awaiting approval (clickable)">
            <LiveStatusPill
              state="awaiting-approval"
              label="Approval needed"
              onClick={() => undefined}
            />
          </Cell>
          <Cell label="Ready">
            <LiveStatusPill state="done" label="Engine ready" />
          </Cell>
          <Cell label="Queued, with a count">
            <LiveStatusPill state="queued" label="Jobs queued" detail="2" />
          </Cell>
          <Cell label="Failed">
            <LiveStatusPill state="failed" label="Engine bridge stopped" />
          </Cell>
          <Cell label="Off">
            <LiveStatusPill state="idle" label="Assistant off" />
          </Cell>
        </Grid>
      </Sub>
    </div>
  )
}
