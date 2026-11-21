// The status bar: the running job with its stage, time and Stop; Recent jobs; the problems count; engine and
// assistant state. Below 640px container width it keeps one line: the job and Stop, then icons with hidden labels.
import type { ReactElement } from 'react'
import {
  Activity,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  Cpu,
  Hand,
  History,
  Loader2,
  PencilLine,
  Sparkles,
  TriangleAlert
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Tip } from '@/shared/ui/common/Tip'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover'
import { Kbd } from '@/shared/ui/common/parts'
import { useWorkbench } from '../model/context'
import { focusRing } from '@/shared/ui/common/styles'

export type JobState = 'queued' | 'running' | 'awaiting-approval' | 'done' | 'failed' | 'cancelled'
export interface StatusJob {
  /** The action, e.g. "Generate draft". */
  label: string
  /** The stage, e.g. "Checking blocks 2 of 5". */
  stage?: string
  /** m:ss since it started. */
  elapsed?: string
  state: JobState
  onStop?: () => void
  onOpen?: () => void
}
export type EngineState = 'ready' | 'starting' | 'offline' | 'error'
/** The open build's hand edits: blocks changed by hand and whether they are saved. */
export interface HandEdits {
  count: number
  save: 'saved' | 'saving' | 'failed'
}
const SAVE_WORD = { saved: 'saved', saving: 'saving…', failed: 'not saved' } as const
export type AssistantState = 'off' | 'idle' | 'working' | 'waiting'

const STATE_TEXT: Record<JobState, string> = {
  queued: 'text-state-queued',
  running: 'text-state-running',
  'awaiting-approval': 'text-state-awaiting-approval',
  done: 'text-state-done',
  failed: 'text-state-failed',
  cancelled: 'text-state-cancelled'
}
const JOB_ICON = {
  queued: CircleDashed,
  running: Loader2,
  'awaiting-approval': TriangleAlert,
  done: CircleCheck,
  failed: CircleX,
  cancelled: CircleDashed
} as const
/** The state in words; running has the spinner and Stop instead. */
const STATE_WORD: Record<JobState, string | null> = {
  queued: 'queued',
  running: null,
  'awaiting-approval': 'waiting',
  done: 'done',
  failed: 'failed',
  cancelled: 'stopped'
}
const ENGINE: Record<EngineState, { text: string; tone: string }> = {
  ready: { text: 'Engine ready', tone: 'text-fg-secondary' },
  starting: { text: 'Engine starting', tone: 'text-state-running' },
  offline: { text: 'Engine offline', tone: 'text-fg-muted' },
  error: { text: 'Engine error', tone: 'text-danger-text' }
}
const ASSISTANT: Record<AssistantState, { text: string; tone: string }> = {
  off: { text: 'Assistant off', tone: 'text-fg-muted' },
  idle: { text: 'idle', tone: 'text-fg-secondary' },
  working: { text: 'working', tone: 'text-state-running' },
  waiting: { text: 'waiting for you', tone: 'text-state-awaiting-approval' }
}

const item = 'flex min-w-0 shrink-0 items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:shrink-0'
const barButton = cn(
  item,
  'h-full rounded-sm px-1.5 transition-colors duration-fast hover:bg-surface-hover hover:text-fg',
  focusRing,
  'focus-visible:-outline-offset-2'
)
const Divider = (): ReactElement => (
  <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border-default @max-[40rem]:hidden" />
)

/** The last jobs in a popover: one row each with the state icon and word, label and time; a row opens Activity. */
function RecentJobs({ jobs }: { jobs: StatusJob[] }): ReactElement {
  return (
    <Popover>
      <Tip label="Recent jobs">
        <PopoverTrigger className={barButton} aria-label="Recent jobs">
          <History aria-hidden="true" />
          <span className="@max-[40rem]:hidden">Recent jobs</span>
        </PopoverTrigger>
      </Tip>
      <PopoverContent side="top" align="start" className="w-80 p-1">
        <h4 className="px-2 pt-1 pb-0.5 text-xs font-medium text-fg-muted">Recent jobs</h4>
        <ul className="flex flex-col">
          {jobs.slice(0, 4).map((j, i) => {
            const Icon = JOB_ICON[j.state]
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={j.onOpen}
                  disabled={!j.onOpen}
                  aria-description={j.onOpen ? 'Show in Activity' : undefined}
                  className={cn(
                    'flex min-h-(--density-row) w-full items-center gap-2 rounded-md px-2 text-start text-sm',
                    'enabled:hover:bg-surface-hover [&_svg]:size-3.5 [&_svg]:shrink-0',
                    focusRing
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      STATE_TEXT[j.state],
                      j.state === 'running' && 'animate-spin motion-reduce:animate-none'
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{j.label}</span>
                  <span className={cn('shrink-0 text-xs', STATE_TEXT[j.state])}>
                    <span className="sr-only">, </span>
                    {STATE_WORD[j.state] ?? 'running'}
                  </span>
                  {j.elapsed && (
                    <span className="shrink-0 font-mono text-2xs text-fg-muted tabular-nums">
                      <span className="sr-only">, </span>
                      {j.elapsed}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export function StatusBar({
  job,
  recent,
  problems,
  onProblems,
  needsYou = 0,
  onNeedsYou,
  engine,
  assistant,
  assistantName = 'Assistant',
  activity,
  handEdits,
  className
}: {
  job?: StatusJob | null
  /** The last jobs, newest first: a Recent jobs button opens up to four of them. Hidden when empty. */
  recent?: StatusJob[]
  /** The build's problems; leave it out where none are known (app pages) and the item is hidden. */
  problems?: number
  onProblems?: () => void
  /** Asks waiting on the user (permission prompts, questions); hidden at 0. Opens the Agent panel. */
  needsYou?: number
  onNeedsYou?: () => void
  engine?: EngineState
  assistant?: AssistantState
  /** The connected assistant, e.g. "Claude Code". */
  assistantName?: string
  activity?: boolean
  /** Shown while the open build has hand edits, or they are being or failed to be saved. */
  handEdits?: HandEdits
  className?: string
}): ReactElement {
  const { dock, openPanels } = useWorkbench()
  const JobIcon = job ? JOB_ICON[job.state] : null
  const engineInfo = engine && ENGINE[engine]
  const assistantInfo = assistant && ASSISTANT[assistant]
  return (
    <div
      className={cn(
        '@container flex h-[max(var(--shell-statusbar),var(--density-control-sm))] min-w-0 items-center gap-1 border-t border-border-default bg-surface px-1.5 text-xs text-fg-secondary',
        className
      )}
    >
      {activity && (
        <Tip label="Activity (Ctrl `)">
          <button
            type="button"
            aria-label="Activity"
            aria-keyshortcuts="Control+`"
            aria-pressed={openPanels?.includes('activity')}
            onClick={() => dock({ type: 'toggle', id: 'activity' })}
            className={cn(barButton, 'aria-pressed:bg-surface-active')}
          >
            <Activity aria-hidden="true" />
            <span className="@max-[40rem]:hidden">Activity</span>
          </button>
        </Tip>
      )}
      {/* polite: stage changes are announced, not interrupting */}
      <div role="status" aria-live="polite" className="flex min-w-0 flex-1 items-center gap-1">
        {job && JobIcon ? (
          <>
            <button
              type="button"
              onClick={job.onOpen}
              disabled={!job.onOpen}
              aria-description={job.onOpen ? 'Show in Activity' : undefined}
              className={cn(barButton, 'min-w-0 shrink disabled:pointer-events-none')}
            >
              <JobIcon
                aria-hidden="true"
                className={cn(
                  STATE_TEXT[job.state],
                  job.state === 'running' && 'animate-spin motion-reduce:animate-none'
                )}
              />
              <span className="min-w-0 truncate text-fg">{job.label}</span>
              {STATE_WORD[job.state] && (
                <span className={cn('shrink-0', STATE_TEXT[job.state])}>
                  {/* flex items have no spaces between them: say them to screen readers */}
                  <span className="sr-only">, </span>
                  {STATE_WORD[job.state]}
                </span>
              )}
              {job.stage && <span className="truncate @max-[40rem]:hidden">· {job.stage}</span>}
              {job.elapsed && (
                <span className="shrink-0 font-mono text-2xs tabular-nums">
                  <span className="sr-only">, </span>
                  {job.elapsed}
                </span>
              )}
            </button>
            {job.onStop &&
              (job.state === 'running' ||
                job.state === 'queued' ||
                job.state === 'awaiting-approval') && (
                <button
                  type="button"
                  onClick={job.onStop}
                  aria-keyshortcuts="Escape"
                  className={cn(barButton, 'text-danger-text hover:text-danger-text')}
                >
                  Stop
                  <Kbd keys="Esc" className="@max-[40rem]:hidden" />
                </button>
              )}
          </>
        ) : (
          <span className={cn(item, 'px-1.5 text-fg-muted')}>Nothing running</span>
        )}
      </div>
      {recent && recent.length > 0 && (
        <>
          <Divider />
          <RecentJobs jobs={recent} />
        </>
      )}
      {needsYou > 0 && (
        <>
          <Divider />
          <button
            type="button"
            onClick={onNeedsYou}
            disabled={!onNeedsYou}
            className={cn(
              barButton,
              'font-medium text-state-awaiting-approval disabled:pointer-events-none'
            )}
            aria-label={`${needsYou} ${needsYou === 1 ? 'ask needs' : 'asks need'} you`}
          >
            <Hand aria-hidden="true" />
            <span className="tabular-nums" aria-hidden="true">
              {needsYou}
              <span className="@max-[40rem]:hidden"> {needsYou === 1 ? 'needs' : 'need'} you</span>
            </span>
          </button>
        </>
      )}
      {handEdits && (
        <>
          <Divider />
          <span
            className={cn(
              item,
              'px-1.5',
              handEdits.save === 'failed' ? 'text-danger-text' : 'text-fg-secondary'
            )}
          >
            <PencilLine aria-hidden="true" />
            <span className="tabular-nums">
              {handEdits.count.toLocaleString()}
              <span className="@max-[40rem]:sr-only">
                {' '}
                hand {handEdits.count === 1 ? 'edit' : 'edits'}
              </span>
            </span>
            <span className={cn(handEdits.save === 'saved' && '@max-[40rem]:sr-only')}>
              <span className="sr-only">, </span>
              <span aria-hidden="true">· </span>
              {SAVE_WORD[handEdits.save]}
            </span>
          </span>
        </>
      )}
      {problems !== undefined && (
        <>
          <Divider />
          <button
            type="button"
            onClick={onProblems}
            disabled={!onProblems}
            className={cn(
              barButton,
              problems ? 'text-warning-text' : 'text-fg-secondary',
              'disabled:pointer-events-none'
            )}
            aria-label={`${problems || 'No'} ${problems === 1 ? 'problem' : 'problems'}`}
          >
            {problems ? <CircleAlert aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
            <span className="tabular-nums" aria-hidden="true">
              {problems}
              <span className="@max-[40rem]:hidden">
                {' '}
                {problems === 1 ? 'problem' : 'problems'}
              </span>
            </span>
          </button>
        </>
      )}
      {engineInfo && (
        <>
          <Divider />
          <Tip label={engineInfo.text}>
            <span className={cn(item, 'px-1.5', engineInfo.tone)}>
              <Cpu aria-hidden="true" />
              <span className="@max-[40rem]:sr-only">{engineInfo.text}</span>
            </span>
          </Tip>
        </>
      )}
      {assistantInfo && (
        <>
          <Divider />
          <Tip label={`${assistantName}: ${assistantInfo.text}`}>
            <span className={cn(item, 'px-1.5', assistantInfo.tone)}>
              <Sparkles aria-hidden="true" />
              <span className="truncate @max-[40rem]:sr-only">
                {assistant === 'off'
                  ? assistantInfo.text
                  : `${assistantName} · ${assistantInfo.text}`}
              </span>
            </span>
          </Tip>
        </>
      )}
    </div>
  )
}
