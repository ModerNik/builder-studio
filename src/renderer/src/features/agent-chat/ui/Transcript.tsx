// A conversation's transcript: lib/transcript's items drawn with the chat parts, subagent steps nested, the open
// permission asks and plans last (right above the composer) and the working line. It sticks to the bottom
// unless the reader scrolled up. The Agent panel and the Variants lanes both use it; neither passes IPC in.
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode
} from 'react'
import { ArrowDown } from 'lucide-react'
import type { PermissionAsk, Permit } from '@shared/api'
import { activity, isBuildRun, jobSummary, type Item } from '@/features/agent-chat/model/transcript'
import { planRevisions, type PlanRevisionInfo } from '@/features/agent-chat/model/plans'
import { cn } from '@/shared/lib/utils'
import { Prose } from '@/shared/ui/code/Prose'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
import { CommandPreview, PermissionCard, PlanCard, QuestionCard, WorkingIndicator } from './Cards'
import {
  AssistantMessage,
  MessageBubble,
  SystemNote,
  type Attachment,
  type MessageBubbleEditState
} from './Messages'
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
  /** Codex plan text: "Implement plan" (optional editedPlan if user edited before approving). */
  onImplementPlan?: (editedPlan?: string) => void
  /** Codex plan text: send revision comments or notes while staying in Plan mode. */
  onRevisePlan?: (feedback: string) => void
  /** Show / Sheet on a build.py job card: the path it wrote and whether it is the sheet. */
  onShowFile?: (path: string, sheet: boolean) => void
  /** Lint problems in an @mcb lint event; every count by default, undefined hides the badge. */
  lintProblems?: (counts: Record<string, number>) => number | undefined
  /** A thumbnail URL for an attached image. */
  fileUrl?: (path: string) => string
  /** Quick actions on user messages that have a persisted turn point. */
  onEditMessage?: (item: Extract<Item, { kind: 'user' }>) => void
  onForkMessage?: (item: Extract<Item, { kind: 'user' }>) => void
  onRewindMessage?: (item: Extract<Item, { kind: 'user' }>) => void
  /** Currently edited user message and its inline edit state. */
  editingMessage?: { id: string } & MessageBubbleEditState
  /** Disables Edit / Fork / Rewind actions while a turn or session operation runs. */
  messageActionsDisabled?: boolean
  /** Shown when there are no items or asks yet. */
  empty?: ReactNode
  /** Under the items: an error alert, say. */
  children?: ReactNode
  className?: string
}

const renderPlanDiff = (before: string, after: string): ReactElement => (
  <DiffView label="Plan revision diff" before={before} after={after} />
)

export function Transcript(props: TranscriptProps): ReactElement {
  const { items, asks, working = false, empty, children, className } = props
  const box = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const [scrolledUp, setScrolledUp] = useState(false)
  const activePlanAsk = asks.find((a) => a.tool === 'ExitPlanMode')
  const plans = useMemo(() => planRevisions(items, activePlanAsk), [items, activePlanAsk])
  const openAskIds = useMemo(() => new Set(asks.map((a) => a.id)), [asks])
  useEffect(() => {
    if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight
  }, [items, asks, working, children])
  // fetched when a turn starts, so a permission ask's diff is at its full height when the effect above
  // scrolls to it
  useEffect(() => {
    if (working) void loadDiffView()
  }, [working])
  const scrollToBottom = (): void => {
    const el = box.current
    if (!el) return
    stick.current = true
    setScrolledUp(false)
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }
  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
      <div
        ref={box}
        role="log"
        aria-label="Conversation"
        onScroll={(e) => {
          const el = e.currentTarget
          const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
          stick.current = nearBottom
          setScrolledUp((prev) => (prev === !nearBottom ? prev : !nearBottom))
        }}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      >
        <div className="mx-auto flex max-w-[68ch] min-w-0 flex-col gap-3 px-3 py-4 wrap-anywhere">
          {!items.length && !asks.length && !working && empty}
          <Items
            {...props}
            parent={null}
            planById={plans.byId}
            activeCodexPlanId={plans.activeCodexPlanId}
            openAskIds={openAskIds}
          />
          {asks.map((a) => (
            <Ask
              key={a.id}
              ask={a}
              planMeta={a.tool === 'ExitPlanMode' ? plans.activeAsk : undefined}
              {...props}
            />
          ))}
          {working && <Working label={activity(items, asks.length)} />}
          {children}
        </div>
      </div>
      {scrolledUp && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Scroll to latest messages"
          className="focus-ring absolute bottom-3 left-1/2 z-sticky inline-flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full border border-border-default bg-surface-overlay px-3 py-1 text-xs font-medium text-fg-secondary shadow-md transition-colors duration-fast ease-standard can-hover:bg-surface-hover can-hover:text-fg"
        >
          {working && <span aria-hidden className="working-dot" />}
          <ArrowDown aria-hidden className="size-3.5" />
          Latest messages
        </button>
      )}
    </div>
  )
}

/** The working line, mounted for the length of one turn so its clock starts with it. */
function Working({ label }: { label: string }): ReactElement {
  const [start] = useState(Date.now)
  return <WorkingIndicator label={label} startedAt={start} />
}

function Items(
  p: TranscriptProps & {
    parent: string | null
    planById: Map<string, PlanRevisionInfo>
    activeCodexPlanId: string | null
    openAskIds: Set<string>
  }
): ReactNode {
  const {
    items,
    parent,
    fileUrl,
    onImplementPlan,
    onRevisePlan,
    onEditMessage,
    onForkMessage,
    onRewindMessage,
    editingMessage,
    messageActionsDisabled,
    working,
    planById,
    activeCodexPlanId,
    openAskIds
  } = p
  return items
    .filter((i) => (i.kind === 'user' || i.kind === 'note' ? parent === null : i.parent === parent))
    .map((i) => {
      if (i.kind === 'user')
        return (
          <MessageBubble
            key={i.id}
            timestamp={i.timestamp}
            attachments={i.attachments?.map((path): Attachment => ({ path, url: fileUrl?.(path) }))}
            onEdit={i.point && onEditMessage ? () => onEditMessage(i) : undefined}
            onFork={i.point && onForkMessage ? () => onForkMessage(i) : undefined}
            onRewind={i.point && onRewindMessage ? () => onRewindMessage(i) : undefined}
            actionsDisabled={messageActionsDisabled ?? working}
            editing={editingMessage?.id === i.id ? editingMessage : undefined}
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
      if (i.kind === 'text' && i.plan && !i.live) {
        const meta = planById.get(i.id)
        const active = i.id === activeCodexPlanId && !working && !!onImplementPlan
        return (
          <PlanCard
            key={i.id}
            plan={i.text}
            revision={meta?.revision}
            previousPlan={meta?.previousPlan}
            renderDiff={renderPlanDiff}
            approveLabel="Implement plan"
            onApprove={active ? onImplementPlan : undefined}
            onRevise={active ? onRevisePlan : undefined}
          />
        )
      }
      if (i.kind === 'text')
        return (
          <AssistantMessage key={i.id} streaming={i.live} timestamp={i.timestamp}>
            {i.text}
          </AssistantMessage>
        )
      if ((i.name === 'ExitPlanMode' || i.name === 'AskUserQuestion') && openAskIds.has(i.id))
        return null
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
  if (t.name === 'ExitPlanMode' && typeof t.input.plan === 'string' && t.input.plan) {
    return (
      <ToolCallRow name={t.name} input={t.input} status={status(t)}>
        <Prose variant="chat">{t.input.plan}</Prose>
        {result}
      </ToolCallRow>
    )
  }
  if (t.name === 'AskUserQuestion' && Array.isArray(t.input.questions)) {
    const qs = t.input.questions.filter(
      (q): q is { header?: string; question?: string } => !!q && typeof q === 'object'
    )
    return (
      <ToolCallRow name={t.name} input={t.input} status={status(t)}>
        <ul className="flex flex-col gap-1 text-sm text-fg-secondary">
          {qs.map((q, idx) => (
            <li key={idx} className="wrap-anywhere">
              {q.header ? <span className="font-medium text-fg">{q.header}: </span> : null}
              {q.question}
            </li>
          ))}
        </ul>
        {result}
      </ToolCallRow>
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
  planMeta,
  onPermit,
  onSwitchToAuto,
  planMode
}: TranscriptProps & { ask: PermissionAsk; planMeta?: PlanRevisionInfo }): ReactElement {
  const permit = (decision: Permit['decision'], extra?: Omit<Permit, 'id' | 'decision'>): void =>
    onPermit({ id: ask.id, decision, ...extra })
  if (ask.kind === 'question' || (ask.questions && ask.questions.length > 0))
    return (
      <QuestionCard
        questions={ask.questions ?? []}
        onSubmit={(answers, annotations) => permit('allow', { answers, annotations })}
        onSkip={() => permit('deny')}
      />
    )
  if (ask.tool === 'ExitPlanMode')
    return (
      <PlanCard
        plan={String(ask.input.plan ?? '')}
        revision={planMeta?.revision}
        previousPlan={planMeta?.previousPlan}
        renderDiff={renderPlanDiff}
        onApprove={(editedPlan) => permit('allow', { mode: planMode, editedPlan })}
        onRevise={(feedback) => permit('deny', { feedback })}
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
