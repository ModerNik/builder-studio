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
import { IconAction } from '@/shared/ui/common/Tip'
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
import { SystemNote } from '@/features/agent-chat/ui/Messages'
import { buildUrl } from '@/shared/lib/urls'
import { useShow } from '@/entities/build/model/builds'
import {
  busy,
  follow,
  newThread,
  send,
  setMode,
  useAgent,
  useSiblingBusy,
  useThread
} from '@/features/agent-chat/model/agent'
import {
  forkThread,
  permitActive,
  renameThread,
  useRewind
} from '@/features/agent-chat/model/panel'
import type { Item } from '@/features/agent-chat/model/transcript'
import type { AgentMode, PermissionAsk, Permit, SessionRef } from '@shared/api'
import { lintProblems } from '@/shared/lib/format'
import { useCurrentBuild } from '@/entities/build/model/current-build'
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

function BuildAgent({ build }: { build: string }): ReactElement {
  const brief = useBriefDialog(build)
  const running = useThread((t) => busy(t.state))
  const [panel, setPanel] = useState<'threads' | 'mcp' | 'context' | 'rename' | 'rewind' | null>(
    null
  )
  const [title, setTitle] = useState('')
  const [renaming, setRenaming] = useState(false)
  const id = useThread((t) => t.id)
  const session = useThread((t) => t.session)
  const state = useThread((t) => t.state)
  const savedTitle = useThread((t) => t.title)
  const ref = session ? { provider: state.provider, id: session } : null
  const close = (): void => setPanel(null)
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
        if (name === 'rewind') setPanel('rewind')
        if (name === 'fork') forkThread(ref, build)
        break
    }
  }
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="flex h-(--density-control) shrink-0 items-center gap-1 border-b border-border-subtle px-1.5">
        <AgentThreads
          open={panel === 'threads'}
          setOpen={(open) => setPanel(open ? 'threads' : null)}
        />
        <span className="flex-1" />
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
      <ActiveTranscript build={build} onBrief={() => void brief.openBrief()} />
      <AgentComposer onCommand={command} />
      {panel === 'context' && <ContextDialog context={state.context} onClose={close} />}
      {panel === 'rewind' && ref && (
        <ActiveRewind key={ref.id} refId={ref} build={build} onClose={close} />
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
  onClose
}: {
  refId: SessionRef
  build: string
  onClose(): void
}): ReactElement {
  const { point, setPoint, running, error, setError, points, preview, rewind } = useRewind(
    refId,
    build,
    onClose
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
function ActiveTranscript({ build, onBrief }: { build: string; onBrief(): void }): ReactElement {
  const items = useThread((t) => t.items)
  const asks = useThread((t) => t.asks)
  const state = useThread((t) => t.state)
  const mode = useThread((t) => t.mode)
  const sibling = useSiblingBusy()
  const loading = useAgent((s) => s.loading)
  const last = items.findLast((i) => i.kind === 'user')
  return (
    <Transcript
      items={items}
      asks={asks}
      working={busy(state)}
      onSwitchToAuto={
        state.provider === 'claude' && mode !== 'auto' ? () => void setMode('auto') : undefined
      }
      onImplementPlan={() => void setMode(workMode()).then(() => send('Implement the plan.'))}
      empty={
        loading ? (
          <LoadingState label="Loading the conversation" layout="transcript" rows={5} />
        ) : (
          <EmptyState
            icon={Bot}
            size="panel"
            title={`Talk to the agent about ${build}`}
            action={
              <Button variant="outline" disabled={busy(state)} onClick={onBrief}>
                <FileText aria-hidden /> Write a brief
              </Button>
            }
          >
            Write a brief, or ask anything below.
          </EmptyState>
        )
      }
    >
      {sibling && (
        <SystemNote>Another thread is working on {build} too; their edits can collide.</SystemNote>
      )}
      {state.error && (
        <Alert
          tone="danger"
          title="The agent stopped"
          action={
            last?.kind === 'user' && !busy(state) ? (
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
  empty,
  children
}: {
  items: Item[]
  asks: PermissionAsk[]
  working?: boolean
  onPermit?: (p: Permit) => void
  onSwitchToAuto?: () => void
  onImplementPlan?: () => void
  empty?: React.ReactNode
  children?: React.ReactNode
}): ReactElement {
  const navigate = useNavigate()
  return (
    <KitTranscript
      items={items}
      asks={asks}
      working={working}
      onPermit={(p) => (onPermit ? onPermit(p) : permitActive(p))}
      onSwitchToAuto={onSwitchToAuto}
      planMode={workMode()}
      onImplementPlan={onImplementPlan}
      onShowFile={(path, sheet) => {
        const build = /^builds\/(.+?)\/out\//.exec(path)?.[1]
        if (!build) return
        reveal(path, sheet)
        void navigate({ to: '/build/$name', params: { name: build } })
      }}
      lintProblems={lintProblems}
      fileUrl={buildUrl}
      empty={empty}
    >
      {children}
    </KitTranscript>
  )
}
