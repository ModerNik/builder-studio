// The Agent panel (G6.1 A, docked conversation) in the Assistant dock: one header row with the thread switcher, MCP,
// Brief and New thread, then the active thread's transcript with its asks above the composer.
// On phones Brief and New thread fold into a More menu in the header.
// Main runs each thread's query; this renders lib/agent's store with the kit's chat parts.
import { useEffect, useState, type ReactElement } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Bot, FileText, MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/shared/ui/primitives/dropdown-menu'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import { Alert } from '@/shared/ui/feedback/Alert'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
import { IconAction, Tip } from '@/shared/ui/common/Tip'
import { cn } from '@/shared/lib/utils'
import { ContextDialog, RewindDialog } from '@/features/agent-chat/ui/CommandDialogs'
import type { ChatCommand } from '@/features/agent-chat/model/commands'
import { errorMessage } from '@/shared/ui/feedback/errors'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/primitives/dialog'
import { Input } from '@/shared/ui/primitives/input'
import { Transcript as KitTranscript } from '@/features/agent-chat/ui/Transcript'
import { SystemNote, type MessageBubbleEditState } from '@/features/agent-chat/ui/Messages'
import { buildUrl } from '@/shared/lib/urls'
import { useShow } from '@/entities/build/model/builds'
import { openSheetViewer } from '@/features/render-studio/model/store'
import {
  busy,
  follow,
  implementPlan,
  newThread,
  revisePlan,
  send,
  setMode,
  useAgent,
  useSiblingBusy,
  useThread
} from '@/features/agent-chat/model/agent'
import {
  editMessageTurn,
  forkThread,
  permitActive,
  renameThread,
  useRewind,
  useRewindPreview
} from '@/features/agent-chat/model/panel'
import type { Item } from '@/features/agent-chat/model/transcript'
import {
  DEFAULT_LINTER_SETTINGS,
  type AgentMode,
  type PermissionAsk,
  type Permit,
  type SessionRef
} from '@shared/api'
import { hasEnabledLintRule, lintProblems } from '@/shared/lib/format'
import { useBuild } from '@/entities/build/model/builds'
import { useCurrentBuild } from '@/entities/build/model/current-build'
import { useSettings } from '@/entities/settings/model/settings'
import { useBriefDialog } from './BriefDialog'
import { AgentThreads } from './AgentThreads'
import { AgentComposer } from './AgentComposer'
import { McpButton } from './AgentMcp'

export function AgentPanel(): ReactElement {
  const route = useCurrentBuild()
  const navigate = useNavigate()
  useEffect(() => void (route && follow(route)), [route])
  const build = useThread((t) => t.build)

  if (!build)
    return (
      <EmptyState
        icon={Bot}
        size="panel"
        title="No build open"
        action={<Button onClick={() => void navigate({ to: '/' })}>Open a build</Button>}
      >
        Open a build to talk to the agent about it.
      </EmptyState>
    )
  return <BuildAgent build={build} />
}

const STARTER_PROMPTS = [
  {
    label: 'Check build & lint',
    text: 'Run a check on this build and list any lint or structural issues.'
  },
  {
    label: 'Suggest block palette',
    text: 'Suggest a cohesive block palette and material mix for this build.'
  },
  {
    label: 'Draft prototype',
    text: 'Generate a prototype build (`build.py proto`) and show the render sheet.'
  },
  {
    label: 'Review proportions',
    text: 'Review the current proportions, silhouette, and roof details and suggest improvements.'
  }
] as const

function ContextPill({
  context,
  onClick
}: {
  context: { tokens: number; max: number }
  onClick: () => void
}): ReactElement | null {
  if (!context.max) return null
  const ratio = Math.min(1, Math.max(0, context.tokens / context.max))
  const pct = Math.round(ratio * 100)
  const circumference = 2 * Math.PI * 6
  const offset = circumference * (1 - ratio)
  const tone =
    pct >= 90
      ? { text: 'text-danger-text', stroke: 'stroke-danger-solid' }
      : pct >= 75
        ? { text: 'text-warning-text', stroke: 'stroke-warning-solid' }
        : { text: 'text-fg-secondary', stroke: 'stroke-accent-solid' }
  return (
    <Tip
      label={`Context usage: ${context.tokens.toLocaleString()} / ${context.max.toLocaleString()} tokens (${pct}%)`}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Context usage ${pct} percent`}
        onClick={onClick}
        className={cn(
          'h-(--density-control-sm) shrink-0 gap-1 px-1.5 font-mono text-2xs tabular-nums',
          tone.text
        )}
      >
        <svg className="size-3.5 -rotate-90" viewBox="0 0 16 16" aria-hidden>
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            className="stroke-surface-active"
            strokeWidth="2"
          />
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            className={tone.stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span>{pct}%</span>
      </Button>
    </Tip>
  )
}

function BuildAgent({ build }: { build: string }): ReactElement {
  const brief = useBriefDialog(build)
  const running = useThread((t) => busy(t.state))
  const [panel, setPanel] = useState<'threads' | 'mcp' | 'context' | 'rename' | 'rewind' | null>(
    null
  )
  const [rewindPoint, setRewindPoint] = useState<string | undefined>(undefined)
  const [draftRequest, setDraftRequest] = useState<{ id: number; text: string } | null>(null)
  const [title, setTitle] = useState('')
  const [renaming, setRenaming] = useState(false)
  const id = useThread((t) => t.id)
  const session = useThread((t) => t.session)
  const state = useThread((t) => t.state)
  const savedTitle = useThread((t) => t.title)
  const ref = session ? { provider: state.provider, id: session } : null
  const close = (): void => {
    setPanel(null)
    setRewindPoint(undefined)
  }
  const rename = async (name: string): Promise<void> => {
    if (!name.trim() || renaming) return
    setRenaming(true)
    try {
      await renameThread(ref, id, state.provider, build, name.trim())
      close()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setRenaming(false)
    }
  }
  const command = (name: ChatCommand, args: string): void => {
    if (args && name !== 'rename' && !(name === 'compact' && state.provider === 'claude')) {
      toast.info(`/${name} runs without arguments.`)
      return
    }
    switch (name) {
      case 'clear':
        newThread(build)
        break
      case 'mcp':
        setPanel('mcp')
        break
      case 'resume':
        setPanel('threads')
        break
      case 'context':
        setPanel('context')
        break
      case 'rename':
        if (args) void rename(args)
        else {
          setTitle(savedTitle ?? '')
          setPanel('rename')
        }
        break
      case 'compact':
      case 'rewind':
      case 'fork':
        if (!ref) {
          toast.info('Send a message to start a conversation first.')
          return
        }
        if (busy(state)) {
          toast.info('Wait for the current turn to finish.')
          return
        }
        if (name === 'compact') void send(args ? `/compact ${args}` : '/compact', { command: true })
        if (name === 'rewind') {
          setRewindPoint(undefined)
          setPanel('rewind')
        }
        if (name === 'fork') void forkThread(ref, build)
        break
    }
  }
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="flex h-(--density-control) shrink-0 items-center gap-1 border-b border-border-subtle px-2">
        <AgentThreads
          open={panel === 'threads'}
          setOpen={(open) => setPanel(open ? 'threads' : null)}
        />
        <span className="flex-1" />
        {state.context && (
          <ContextPill context={state.context} onClick={() => setPanel('context')} />
        )}
        <McpButton open={panel === 'mcp'} setOpen={(open) => setPanel(open ? 'mcp' : null)} />
        <span className="flex items-center gap-1 max-sm:hidden">
          <IconAction
            label="Brief"
            tip="Brief: write DESIGN.md §1 and start a new thread with it"
            icon={FileText}
            disabled={running}
            onClick={() => void brief.openBrief()}
          />
          <IconAction label="New thread" icon={Plus} onClick={() => void newThread(build)} />
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="More: Brief, New thread" size="icon-sm" className="sm:hidden">
              <MoreHorizontal aria-hidden />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={running} onSelect={() => void brief.openBrief()}>
              <FileText aria-hidden /> Brief…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void newThread(build)}>
              <Plus aria-hidden /> New thread
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {brief.dialog}
      <ActiveTranscript
        key={id}
        build={build}
        onBrief={() => void brief.openBrief()}
        onStarter={(text) => setDraftRequest((prev) => ({ id: (prev?.id ?? 0) + 1, text }))}
        onRewind={(point) => {
          setRewindPoint(point)
          setPanel('rewind')
        }}
      />
      <AgentComposer onCommand={command} draftRequest={draftRequest} />
      {panel === 'context' && (
        <ContextDialog
          context={state.context}
          onCompact={ref ? () => command('compact', '') : undefined}
          compactDisabled={running}
          onClose={close}
        />
      )}
      {panel === 'rewind' && ref && (
        <ActiveRewind
          key={`${ref.id}:${rewindPoint ?? ''}`}
          refId={ref}
          build={build}
          initialPoint={rewindPoint}
          onClose={close}
        />
      )}
      {panel === 'rename' && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !renaming) close()
          }}
        >
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Rename conversation</DialogTitle>
              <DialogDescription>
                Give this conversation a name you can find in history.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                void rename(title)
              }}
            >
              <Input
                aria-label="Conversation name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                disabled={renaming}
              />
              <DialogFooter>
                <Button type="submit" disabled={!title.trim() || renaming}>
                  Rename
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function ActiveRewind({
  refId,
  build,
  initialPoint,
  onClose
}: {
  refId: SessionRef
  build: string
  initialPoint?: string
  onClose(): void
}): ReactElement {
  const { point, setPoint, running, error, setError, points, preview, rewind } = useRewind(
    refId,
    build,
    onClose,
    initialPoint
  )
  return (
    <RewindDialog
      points={points.data?.toReversed() ?? []}
      point={point}
      onPoint={(id) => {
        setPoint(id)
        setError(undefined)
      }}
      preview={
        preview.error
          ? { files: [], unavailable: errorMessage(preview.error) }
          : preview.isFetching
            ? undefined
            : preview.data
      }
      loading={points.isPending}
      error={error ?? (points.error ? errorMessage(points.error) : undefined)}
      running={running}
      onClose={onClose}
      onRewind={(files) => void rewind(files)}
    />
  )
}

// an approved plan is implemented in Auto, which every provider offers
const workMode = (): AgentMode => 'auto'

/** The active thread's transcript, bound to the store. */
function ActiveTranscript({
  build,
  onBrief,
  onStarter,
  onRewind
}: {
  build: string
  onBrief(): void
  onStarter(text: string): void
  onRewind(point: string): void
}): ReactElement {
  const id = useThread((t) => t.id)
  const displayName = useBuild(build).data?.displayName || build
  const session = useThread((t) => t.session)
  const items = useThread((t) => t.items)
  const asks = useThread((t) => t.asks)
  const state = useThread((t) => t.state)
  const mode = useThread((t) => t.mode)
  const sibling = useSiblingBusy()
  const loading = useAgent((s) => s.loading)
  const working = busy(state)
  const ref = session ? { provider: state.provider, id: session } : null
  const [editTarget, setEditTarget] = useState<{
    threadId: string
    itemCount: number
    id: string
    point: string
    attachments?: string[]
  } | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string>()
  const [forking, setForking] = useState(false)

  const activeEdit =
    editTarget && editTarget.threadId === id && editTarget.itemCount === items.length && !working
      ? editTarget
      : null
  const editPreview = useRewindPreview(activeEdit ? ref : null, build, activeEdit?.point ?? null)
  const previewValue = editPreview.error
    ? { files: [], unavailable: errorMessage(editPreview.error) }
    : editPreview.isFetching
      ? undefined
      : editPreview.data

  const submitEdit = async (text: string, undoFiles: boolean): Promise<void> => {
    if (!activeEdit || !ref || editSubmitting) return
    const files = undoFiles && previewValue && !previewValue.unavailable ? previewValue.files : null
    setEditSubmitting(true)
    setEditError(undefined)
    try {
      await editMessageTurn(ref, build, activeEdit.point, text, files, activeEdit.attachments)
      setEditTarget(null)
    } catch (e) {
      setEditError(errorMessage(e))
      void editPreview.refetch()
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleFork = async (item: Extract<Item, { kind: 'user' }>): Promise<void> => {
    if (!ref || !item.point || forking || working || editSubmitting) return
    setEditTarget(null)
    setEditError(undefined)
    setForking(true)
    try {
      await forkThread(ref, build, item.point)
    } finally {
      setForking(false)
    }
  }

  const last = items.findLast((i) => i.kind === 'user')
  return (
    <Transcript
      items={items}
      asks={asks}
      working={working}
      onSwitchToAuto={
        state.provider === 'claude' && mode !== 'auto' ? () => void setMode('auto') : undefined
      }
      onImplementPlan={(editedPlan) => void implementPlan(editedPlan)}
      onRevisePlan={(feedback) => void revisePlan(feedback)}
      onEditMessage={
        ref
          ? (item) => {
              if (!item.point) return
              setEditError(undefined)
              setEditTarget({
                threadId: id,
                itemCount: items.length,
                id: item.id,
                point: item.point,
                attachments: item.attachments
              })
            }
          : undefined
      }
      onForkMessage={ref && state.capabilities.fork ? (item) => void handleFork(item) : undefined}
      onRewindMessage={
        ref
          ? (item) => {
              if (!item.point) return
              setEditTarget(null)
              setEditError(undefined)
              onRewind(item.point)
            }
          : undefined
      }
      editingMessage={
        activeEdit
          ? {
              id: activeEdit.id,
              preview: previewValue,
              submitting: editSubmitting,
              error: editError,
              onSubmit: (text, undoFiles) => void submitEdit(text, undoFiles),
              onCancel: () => {
                setEditTarget(null)
                setEditError(undefined)
              }
            }
          : undefined
      }
      messageActionsDisabled={working || forking || editSubmitting}
      empty={
        loading ? (
          <LoadingState label="Loading the conversation" layout="transcript" rows={5} />
        ) : (
          <EmptyState
            icon={Bot}
            size="panel"
            title={`Talk to the agent about ${displayName}`}
            action={
              <div className="flex flex-col items-center gap-3">
                <Button variant="outline" disabled={working} onClick={onBrief}>
                  <FileText aria-hidden /> Write a brief
                </Button>
                <div className="flex max-w-80 flex-wrap justify-center gap-1.5">
                  {STARTER_PROMPTS.map((starter) => (
                    <button
                      key={starter.label}
                      type="button"
                      disabled={working}
                      onClick={() => onStarter(starter.text)}
                      className="focus-ring cursor-pointer rounded-full border border-border-subtle bg-surface-sunken px-2.5 py-1 text-xs text-fg-secondary transition-colors duration-fast ease-standard can-hover:border-border-default can-hover:bg-surface-hover can-hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {starter.label}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            Write a brief, pick a starter, or ask anything below.
          </EmptyState>
        )
      }
    >
      {sibling && (
        <SystemNote>
          Another thread is working on {displayName} too; their edits can collide.
        </SystemNote>
      )}
      {state.error && (
        <Alert
          tone="danger"
          title="The agent stopped"
          action={
            last?.kind === 'user' && !working ? (
              <Button size="sm" variant="outline" onClick={() => void send(last.text)}>
                Retry message
              </Button>
            ) : undefined
          }
        >
          <span className="font-mono text-sm break-words whitespace-pre-wrap">{state.error}</span>
        </Alert>
      )}
    </Transcript>
  )
}

const reveal = (path: string, sheet: boolean): void =>
  useShow.setState(
    sheet ? { path: null, sheet: path, t: Date.now() } : { path, sheet: null, t: Date.now() }
  )

/**
 * The kit transcript with the app's defaults: Allow and Deny go to the Agent panel's own thread unless
 * `onPermit` is given (Variants passes a lane's), Show opens the file in its build's workspace.
 */
export function Transcript({
  items,
  asks,
  working = false,
  onPermit,
  onSwitchToAuto,
  onImplementPlan,
  onRevisePlan,
  onEditMessage,
  onForkMessage,
  onRewindMessage,
  editingMessage,
  messageActionsDisabled,
  empty,
  children
}: {
  items: Item[]
  asks: PermissionAsk[]
  working?: boolean
  onPermit?: (p: Permit) => void
  onSwitchToAuto?: () => void
  onImplementPlan?: (editedPlan?: string) => void
  onRevisePlan?: (feedback: string) => void
  onEditMessage?: (item: Extract<Item, { kind: 'user' }>) => void
  onForkMessage?: (item: Extract<Item, { kind: 'user' }>) => void
  onRewindMessage?: (item: Extract<Item, { kind: 'user' }>) => void
  editingMessage?: { id: string } & MessageBubbleEditState
  messageActionsDisabled?: boolean
  empty?: React.ReactNode
  children?: React.ReactNode
}): ReactElement {
  const navigate = useNavigate()
  const linter = useSettings().data?.linter ?? DEFAULT_LINTER_SETTINGS
  const countLint = (counts: Record<string, number>): number | undefined =>
    linter.enabled && hasEnabledLintRule(linter.rules)
      ? lintProblems(counts, linter.rules)
      : undefined
  return (
    <KitTranscript
      items={items}
      asks={asks}
      working={working}
      onPermit={(p) => (onPermit ? onPermit(p) : permitActive(p))}
      onSwitchToAuto={onSwitchToAuto}
      planMode={workMode()}
      onImplementPlan={onImplementPlan}
      onRevisePlan={onRevisePlan}
      onEditMessage={onEditMessage}
      onForkMessage={onForkMessage}
      onRewindMessage={onRewindMessage}
      editingMessage={editingMessage}
      messageActionsDisabled={messageActionsDisabled}
      onShowFile={(path, sheet) => {
        const build = /^builds\/(.+?)\/out\//.exec(path)?.[1]
        if (!build) return
        if (sheet) {
          openSheetViewer({ build, path, mtime: Date.now() })
          return
        }
        reveal(path, false)
        void navigate({ to: '/build/$name', params: { name: build } })
      }}
      lintProblems={countLint}
      fileUrl={buildUrl}
      empty={empty}
    >
      {children}
    </KitTranscript>
  )
}
