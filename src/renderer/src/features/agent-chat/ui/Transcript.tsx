// A conversation's transcript: lib/transcript's items drawn with the chat parts, subagent steps nested, the open
// permission asks and plans last (right above the composer) and the working line. It sticks to the bottom
// unless the reader scrolled up. The Agent panel and the Variants lanes both use it; neither passes IPC in.
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode
} from 'react'
import type { PermissionAsk, Permit } from '@shared/api'
import { activity, isBuildRun, jobSummary, type Item } from '@/features/agent-chat/model/transcript'
import { cn } from '@/shared/lib/utils'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
import { CommandPreview, PermissionCard, PlanCard, WorkingIndicator } from './Cards'
import { AssistantMessage, MessageBubble, SystemNote, type Attachment } from './Messages'
import { JobCard, SubagentCard, ToolCallRow, ToolResult, type ToolStatus } from './ToolCallRow'

type Tool = Extract<Item, { kind: 'tool' }>
const SUBAGENT = new Set(['Agent', 'Task'])
const status = (t: Tool): ToolStatus =>
  t.result === undefined ? 'running' : t.error ? 'error' : 'done'
const sum = (counts: Record<string, number>): number =>
  Object.values(counts).reduce((a, b) => a + b, 0)
const name = (tool: string): string => tool.replace(/^mcp__([^_]+)__/, '$1 · ')

// CodeMirror is only needed once an Edit or a Write is on screen: its code loads on demand
const loadDiffView = (): Promise<typeof import('@/shared/ui/code/DiffView')> =>
  import('@/shared/ui/code/DiffView')
const LazyDiffView = lazy(() => loadDiffView().then((m) => ({ default: m.DiffView })))
function DiffView(props: ComponentProps<typeof LazyDiffView>): ReactElement {
  return (
    <Suspense fallback={<LoadingState label="Loading changes" rows={3} />}>
      <LazyDiffView {...props} />
    </Suspense>
  )
}

export interface TranscriptProps {
  items: Item[]
  asks: PermissionAsk[]
  /** On a turn: the working line shows what it is doing and for how long. */
  working?: boolean
  onPermit: (p: Permit) => void
  /** Offer "Allow and switch to Auto" on asks (Claude, the Agent panel, while not in Auto). */
  onSwitchToAuto?: () => void
  /** The mode an approved plan continues in. */
  planMode?: Permit['mode']
  /** Codex plan text: "Implement plan". Omit where plans cannot be acted on. */
  onImplementPlan?: () => void
  /** Show / Sheet on a build.py job card: the path it wrote and whether it is the sheet. */
  onShowFile?: (path: string, sheet: boolean) => void
  /** Lint problems in an @mcb lint event; every count by default. */
  lintProblems?: (counts: Record<string, number>) => number
  /** A thumbnail URL for an attached image. */
  fileUrl?: (path: string) => string
  /** Shown when there are no items or asks yet. */
  empty?: ReactNode
  /** Under the items: an error alert, say. */
  children?: ReactNode
  className?: string
}

export function Transcript(props: TranscriptProps): ReactElement {
  const { items, asks, working = false, empty, children, className } = props
  const box = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  useEffect(() => {
    if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight
  }, [items, asks, working, children])
  // fetched when a turn starts, so a permission ask's diff is at its full height when the effect above
  // scrolls to it
  useEffect(() => {
    if (working) void loadDiffView()
  }, [working])
  return (
    <div
      ref={box}
      role="log"
      aria-label="Conversation"
      onScroll={(e) => {
        const el = e.currentTarget
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      }}
      className={cn('min-h-0 flex-1 overflow-y-auto', className)}
    >
      <div className="mx-auto flex max-w-[68ch] min-w-0 flex-col gap-3 px-3 py-4">
        {!items.length && !asks.length && !working && empty}
        <Items {...props} parent={null} />
        {asks.map((a) => (
          <Ask key={a.id} ask={a} {...props} />
        ))}
        {working && <Working label={activity(items, asks.length)} />}
        {children}
      </div>
    </div>
  )
}

/** The working line, mounted for the length of one turn so its clock starts with it. */
function Working({ label }: { label: string }): ReactElement {
  const [start] = useState(Date.now)
  return <WorkingIndicator label={label} startedAt={start} />
}

function Items(p: TranscriptProps & { parent: string | null }): ReactNode {
  const { items, parent, fileUrl, onImplementPlan } = p
  return items
    .filter((i) => (i.kind === 'user' || i.kind === 'note' ? parent === null : i.parent === parent))
    .map((i) => {
      if (i.kind === 'user')
        return (
          <MessageBubble
            key={i.id}
            attachments={i.attachments?.map((path): Attachment => ({ path, url: fileUrl?.(path) }))}
          >
            {i.text}
          </MessageBubble>
        )
      if (i.kind === 'note')
        return (
          <SystemNote key={i.id} tone={i.error ? 'error' : 'neutral'}>
            {i.text}
          </SystemNote>
        )
      if (i.kind === 'text' && i.plan && !i.live && onImplementPlan)
        return (
          <PlanCard
            key={i.id}
            plan={i.text}
            approveLabel="Implement plan"
            onApprove={onImplementPlan}
          />
        )
      if (i.kind === 'text')
        return (
          <AssistantMessage key={i.id} streaming={i.live}>
            {i.text}
          </AssistantMessage>
        )
      if (SUBAGENT.has(i.name))
        return (
          <SubagentCard
            key={i.id}
            type={String(i.input.subagent_type ?? 'Subagent')}
            description={String(i.input.description ?? '')}
            status={status(i)}
            result={i.result !== undefined && <ToolResult text={i.result} error={i.error} />}
          >
            <Items {...p} parent={i.id} />
          </SubagentCard>
        )
      return <ToolItem key={i.id} t={i} {...p} />
    })
}

/** An Edit's or Write's change as a diff; null for any other tool. */
function change(tool: string, input: Record<string, unknown>): ReactElement | null {
  const label =
    String(input.file_path ?? '')
      .split(/[\\/]/)
      .pop() || tool
  if (tool === 'Edit')
    return (
      <DiffView
        label={label}
        before={String(input.old_string ?? '')}
        after={String(input.new_string ?? '')}
      />
    )
  if (tool === 'Write')
    return <DiffView label={label} before="" after={String(input.content ?? '')} />
  return null
}

function ToolItem({
  t,
  onShowFile,
  lintProblems = sum
}: TranscriptProps & { t: Tool }): ReactElement {
  const result = t.result !== undefined && <ToolResult text={t.result} error={t.error} />
  if (isBuildRun(t.input)) {
    const s = jobSummary(t.events ?? [])
    return (
      <JobCard
        command={String(t.input.command ?? '')}
        status={status(t)}
        seconds={s.done?.seconds}
        stoppedAt={s.stage?.name}
        lintProblems={s.lint && lintProblems(s.lint.counts)}
        wrote={s.wrote?.path}
        onShow={s.wrote && onShowFile ? () => onShowFile(s.wrote!.path, false) : undefined}
        onSheet={s.sheet && onShowFile ? () => onShowFile(s.sheet!.path, true) : undefined}
      >
        {result}
      </JobCard>
    )
  }
  return (
    <ToolCallRow name={t.name} input={t.input} status={status(t)}>
      {change(t.name, t.input) ?? <ToolResult text={JSON.stringify(t.input, null, 2)} />}
      {result}
    </ToolCallRow>
  )
}

function Ask({
  ask,
  onPermit,
  onSwitchToAuto,
  planMode
}: TranscriptProps & { ask: PermissionAsk }): ReactElement {
  const permit = (decision: Permit['decision'], mode?: Permit['mode']): void =>
    onPermit({ id: ask.id, decision, mode })
  if (ask.tool === 'ExitPlanMode')
    return (
      <PlanCard
        plan={String(ask.input.plan ?? '')}
        onApprove={() => permit('allow', planMode)}
        onKeepPlanning={() => permit('deny')}
      />
    )
  return (
    <PermissionCard
      tool={name(ask.tool)}
      title={ask.title ?? undefined}
      subagent={!!ask.agent}
      rule={ask.rule ?? undefined}
      guard={ask.guard ?? undefined}
      canSwitchToAuto={!!onSwitchToAuto}
      onDecide={(d) => {
        if (d === 'allow-auto') {
          permit('allow')
          onSwitchToAuto?.()
        } else permit(d)
      }}
    >
      {change(ask.tool, ask.input) ?? (
        <CommandPreview>
          {ask.tool === 'Bash'
            ? String(ask.input.command ?? '')
            : JSON.stringify(ask.input, null, 2)}
        </CommandPreview>
      )}
    </PermissionCard>
  )
}
