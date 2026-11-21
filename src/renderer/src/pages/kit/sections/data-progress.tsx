import { useState, type ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import { Field } from '@/shared/ui/primitives/field'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { SplitView } from '@/shared/ui/layout/SplitView'
import { Checklist, ChecklistRow, Stepper, Timeline, type Step } from '@/shared/ui/data/progress'
import hero from '../../../../../../.github/assets/hero.svg?url'
import { Cell, Grid, Narrow, Sub } from '../composites-demo'

export const meta = { group: 'Data display', title: 'Timeline, stepper and checklist' }

const STEPS: Step[] = [
  { id: 'welcome', label: 'Welcome', status: 'done' },
  { id: 'workspace', label: 'Workspace', status: 'done', detail: 'D:\\Minecraft\\workspace' },
  { id: 'tools', label: 'Build tools', status: 'error', detail: 'Python not found' },
  { id: 'minecraft', label: 'Minecraft', status: 'current' },
  { id: 'assistant', label: 'AI assistant', status: 'upcoming', optional: true },
  { id: 'ready', label: 'Ready', status: 'upcoming' }
]
const SKIPPED: Step[] = STEPS.map((s) =>
  s.id === 'tools'
    ? { ...s, status: 'done', detail: undefined }
    : s.id === 'minecraft'
      ? { ...s, status: 'done' }
      : s.id === 'assistant'
        ? { ...s, status: 'skipped' }
        : s.id === 'ready'
          ? { ...s, status: 'current' }
          : s
)

const EXPORT = [
  {
    n: 1,
    label: 'Connect and check setup',
    status: 'done',
    detail: 'engine bridge ready · tools ok'
  },
  { n: 2, label: 'Lint zero', status: 'failed', detail: '3 problems: gravity 2, halves 1' },
  { n: 3, label: 'Full build', status: 'running', detail: '<cache>/ship/stone_watchtower/' },
  { n: 5, label: 'Bill of materials', status: 'warning', detail: '2 rare blocks' }
] as const
const FOUND: Record<number, string> = {
  1: 'Engine bridge answered in 0.4s. Python 3.12, WorldEdit schematic writer ok.',
  2: 'gravity: sand at 12 64 -3 and 13 64 -3 has air under it. halves: one slab faces the wrong way.',
  3: 'Building 4 of 7 modules… 18,204 blocks so far.',
  5: 'lodestone ×4 and sculk_catalyst ×1 are rare in survival; the BOM marks them.'
}

function ChecklistWithDetail(): ReactElement {
  const [step, setStep] = useState(2)
  const s = EXPORT.find((e) => e.n === step)!
  return (
    <SplitView
      preset="list-detail"
      labels={['Export steps', 'Step detail']}
      stackBelow={30}
      first={
        <Checklist label="Export steps">
          {EXPORT.map((e) => (
            <ChecklistRow
              key={e.n}
              {...e}
              selected={e.n === step}
              onSelect={() => setStep(e.n)}
              action={
                e.status === 'failed' ? (
                  <Button size="xs" variant="outline">
                    Fix
                  </Button>
                ) : undefined
              }
            />
          ))}
        </Checklist>
      }
      second={
        <div className="flex flex-col gap-2 p-3">
          <h4 className="font-medium">
            {s.n}. {s.label}
          </h4>
          <p className="font-mono text-sm break-words text-fg-secondary">{FOUND[s.n]}</p>
        </div>
      }
    />
  )
}

function ReviewRail(): ReactElement {
  const [round, setRound] = useState(3)
  return (
    <div className="flex w-72 flex-col gap-4">
      <Field label="Question for this round" hint="Shown above the sheet in Review.">
        <Textarea rows={2} defaultValue="Does the taller keep still read as one building?" />
      </Field>
      <Timeline
        current={round}
        onSelect={setRound}
        rounds={[
          { n: 3, title: 'Taller keep, stone roof', date: '2026-10-31', gist: 'Waiting for picks' },
          {
            n: 2,
            title: 'Second gatehouse option',
            date: '2026-10-29',
            gist: 'Picked none · 2 pins'
          }
        ]}
      />
    </div>
  )
}

export default function DataProgress(): ReactElement {
  const [round, setRound] = useState(3)
  return (
    <div>
      <Sub
        title="Timeline"
        note="Review rounds newest first, each with its sheet; click one to jump to it in the log."
      >
        <Grid min="18rem">
          <Cell label="Design log rounds">
            <Timeline
              current={round}
              onSelect={setRound}
              rounds={[
                {
                  n: 3,
                  title: 'Taller keep, stone roof',
                  date: '2026-10-31',
                  sheet: hero,
                  gist: 'Picked v3 · 4 pins · roof approved'
                },
                {
                  n: 2,
                  title: 'Second gatehouse option',
                  date: '2026-10-29',
                  gist: 'Picked none · 2 pins'
                },
                { n: 1, title: 'First draft', date: '2026-10-27', sheet: hero }
              ]}
            />
          </Cell>
          <Cell label="Narrow, read-only">
            <Narrow width={15}>
              <Timeline
                rounds={[
                  {
                    n: 12,
                    title: 'Final material pass before the export to the server',
                    date: '2026-11-02',
                    sheet: hero
                  }
                ]}
              />
            </Narrow>
          </Cell>
        </Grid>
      </Sub>
      <Sub
        title="Stepper"
        note="Done, current, upcoming, skipped and error steps, with an optional mark. Vertical rail beside the step, or horizontal above it (labels drop when narrow)."
      >
        <Grid min="16rem">
          <Cell label="Vertical, with an error step">
            <Stepper steps={STEPS} onSelect={() => undefined} label="Setup steps" />
          </Cell>
          <Cell label="Vertical, a step skipped">
            <Stepper steps={SKIPPED} label="Setup steps" />
          </Cell>
        </Grid>
        <Cell label="Vertical, compact: the 72px rail at tablet width, names in tooltips">
          <div className="w-18">
            <Stepper steps={STEPS} compact onSelect={() => undefined} label="Setup steps" />
          </div>
        </Cell>
        <Cell label="Horizontal">
          <Stepper steps={STEPS} orientation="horizontal" label="Setup steps" />
        </Cell>
        <Cell label="Horizontal, narrow: numbers only">
          <Narrow width={18.75}>
            <Stepper steps={STEPS} orientation="horizontal" label="Setup steps" />
          </Narrow>
        </Cell>
      </Sub>
      <Sub
        title="ChecklistRow"
        note="One Export line: status, number, label, a mono detail and its action. Actions wrap under the label when narrow."
      >
        <Grid min="22rem">
          <Cell label="Export checklist">
            <Checklist label="Export steps">
              <ChecklistRow
                n={1}
                label="Connect and check setup"
                status="done"
                detail="engine bridge ready · tools ok"
              />
              <ChecklistRow
                n={2}
                label="Lint zero"
                status="failed"
                detail="3 problems: gravity 2, halves 1"
                action={
                  <Button size="xs" variant="outline">
                    Show checks
                  </Button>
                }
              />
              <ChecklistRow
                n={3}
                label="Full build"
                status="running"
                detail="<cache>/ship/stone_watchtower-20261103-2140/"
              />
              <ChecklistRow n={4} label="Hollow count" status="idle" />
              <ChecklistRow
                n={5}
                label="Bill of materials"
                status="warning"
                detail="2 rare blocks: lodestone, sculk_catalyst"
              />
              <ChecklistRow
                n={7}
                label="Finalize"
                status="idle"
                action={
                  <Button size="xs" disabled>
                    Finalize…
                  </Button>
                }
              />
              <ChecklistRow
                n={10}
                label="Rejected variants"
                status="skipped"
                detail="no round with a pick"
              />
            </Checklist>
          </Cell>
          <Cell label="Unnumbered: requirements (Diagnostics)">
            <Checklist label="Requirements">
              <ChecklistRow
                label="Workspace folder"
                status="done"
                detail="D:\Minecraft\builder-workspace · writable"
              />
              <ChecklistRow
                label="Preview browser"
                status="failed"
                detail="chromium not found in runtime\browser"
                action={
                  <Button size="xs" variant="primary">
                    Install
                  </Button>
                }
              />
              <ChecklistRow
                label="Exported schematics folder"
                status="warning"
                action={
                  <Button size="xs" variant="outline">
                    Set up
                  </Button>
                }
              />
              <ChecklistRow label="AI assistant" status="running" />
            </Checklist>
          </Cell>
          <Cell label="Narrow">
            <Narrow width={18.75}>
              <Checklist label="Export steps">
                <ChecklistRow
                  n={9}
                  label="Git commit"
                  status="idle"
                  detail="M builds/stone_watchtower/build.py"
                  action={
                    <Button size="xs" variant="outline">
                      Commit…
                    </Button>
                  }
                />
              </Checklist>
            </Narrow>
          </Cell>
        </Grid>
      </Sub>
      <Sub
        title="ChecklistRow, selectable, with a detail pane"
        note="With onSelect the label and detail open the step in a list-detail SplitView; the selected row is surface-active with an accent bar. On phone the detail opens in a Sheet."
      >
        <Cell label="Export: pick a step">
          <ChecklistWithDetail />
        </Cell>
      </Sub>
      <Sub
        title="Review round rail (composed)"
        note="Field and a two-line Textarea for the round's question, then the round Timeline. No component of its own."
      >
        <Cell label="Review A rail">
          <ReviewRail />
        </Cell>
      </Sub>
    </div>
  )
}
