// The Agent panel's thread switcher: the live threads of every build (each its own agent, several at once) and the
// stored sessions of the active thread's build, with search, rename, fork and delete (archive for Codex).
import { useState, type ReactElement } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, GitFork, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover'
import { ThreadListItem } from '@/features/agent-chat/ui/ThreadListItem'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { ConfirmDestructive } from '@/shared/ui/feedback/ConfirmDestructive'
import { IconAction } from '@/shared/ui/common/Tip'
import { cn } from '@/shared/lib/utils'
import {
  activate,
  busy,
  closeThread,
  newThread,
  openSession,
  useAgent,
  useSiblingBusy,
  useThread,
  type Thread
} from '@/features/agent-chat/model/agent'
import {
  forkSession,
  removeSession,
  renameSession,
  useAgentSessions
} from '@/features/agent-chat/model/threads'
import type { AgentSession } from '@shared/api'

/** The session's stored title, else the thread's first message. */
const label = (t: Thread, sessions: AgentSession[] = []): string =>
  sessions.find((s) => s.id === t.session)?.title ||
  t.title ||
  t.items.find((i) => i.kind === 'user')?.text.slice(0, 60) ||
  'New thread'
const err = (e: unknown): void => void toast.error(errorMessage(e))

export function AgentThreads({
  open,
  setOpen
}: {
  open: boolean
  setOpen(open: boolean): void
}): ReactElement {
  const active = useThread((t) => t)
  const threads = Object.values(useAgent((s) => s.threads))
  const provider = useAgent((s) => s.primary.provider)
  const capabilities = useAgent((s) => s.primary.capabilities)
  const sibling = useSiblingBusy()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<{ s: AgentSession; title: string } | null>(null)
  const [removing, setRemoving] = useState<AgentSession | null>(null)
  const build = active.build
  const list = useAgentSessions(provider, build)
  const refresh = (): void => void list.refetch()
  const running = threads.filter((t) => busy(t.state)).length
  const q = query.trim().toLowerCase()
  const hit = (...s: string[]): boolean => !q || s.some((x) => x.toLowerCase().includes(q))
  const shownThreads = threads.filter((t) => hit(label(t, list.data), t.build))
  const shownSessions = (list.data ?? []).filter((s) => hit(s.title, s.id))
  const verb = provider === 'claude' ? 'Delete' : 'Archive'

  const show = (t: Thread): void => {
    activate(t.id)
    setOpen(false)
    if (t.build !== build) void navigate({ to: '/build/$name', params: { name: t.build } })
  }
  const remove = async (s: AgentSession): Promise<void> => {
    await removeSession(s, threads)
    refresh()
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          setRenaming(null)
          if (!o) setQuery('')
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Threads and sessions: ${label(active, list.data)}`}
            className="h-(--density-control-sm) min-w-0 shrink gap-1 px-1.5 font-medium"
          >
            <span className="truncate">{label(active, list.data)}</span>
            {running > 0 && (
              <span className="shrink-0 font-mono text-xs text-state-running">
                {running} running
              </span>
            )}
            <ChevronDown aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-1 p-1"
        >
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-muted"
            />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search threads and sessions…"
              aria-label="Search threads and sessions"
              className="pl-8"
            />
          </div>
          {sibling && (
            <InlineNotice tone="warning" className="px-2 py-1">
              Another thread is working on {build} too; their edits can collide.
            </InlineNotice>
          )}
          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            <Heading>Threads</Heading>
            {shownThreads.map((t) => (
              <ThreadListItem
                key={t.id}
                title={label(t, list.data)}
                build={t.build}
                state={busy(t.state) ? 'busy' : t.state.status === 'off' ? 'off' : 'live'}
                awaiting={t.asks.length > 0}
                active={t.id === active.id}
                onSelect={() => show(t)}
                onClose={() => void closeThread(t.id)}
              />
            ))}
            {build && (
              <>
                <Heading>Sessions of {build}</Heading>
                {list.error && (
                  <InlineNotice tone="danger" className="px-2 py-1">
                    {String(list.error)}
                  </InlineNotice>
                )}
                {list.data?.length === 0 && (
                  <p className="px-2 py-1 text-sm text-fg-secondary">No sessions yet.</p>
                )}
                {shownSessions.map((s) =>
                  renaming?.s.id === s.id ? (
                    <form
                      key={s.id}
                      className="px-1 py-0.5"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void renameSession(s, renaming.title).then(refresh, err)
                        setRenaming(null)
                      }}
                    >
                      <Input
                        autoFocus
                        aria-label="Session title"
                        value={renaming.title}
                        onChange={(e) => setRenaming({ s, title: e.target.value })}
                        onKeyDown={(e) =>
                          e.key === 'Escape' && (e.stopPropagation(), setRenaming(null))
                        }
                      />
                    </form>
                  ) : (
                    <div
                      key={s.id}
                      className={cn(
                        'group flex min-h-(--density-row) min-w-0 items-center gap-1 rounded-md pr-1 hover:bg-surface-hover',
                        s.id === active.session && 'bg-surface-active hover:bg-surface-active'
                      )}
                    >
                      <button
                        type="button"
                        aria-current={s.id === active.session ? 'true' : undefined}
                        onClick={() =>
                          void openSession({ provider: s.provider, id: s.id }).then(() =>
                            setOpen(false)
                          )
                        }
                        className="flex min-h-(--density-row) min-w-0 flex-1 items-center gap-2 rounded-md pl-2 text-left focus-visible:outline-2 focus-visible:outline-focus"
                      >
                        <span className="min-w-0 flex-1 truncate text-fg-secondary">
                          {s.title || s.id.slice(0, 8)}
                        </span>
                        <time
                          dateTime={new Date(s.modified).toISOString()}
                          className="shrink-0 font-mono text-xs text-fg-muted tabular-nums"
                        >
                          {new Date(s.modified).toLocaleDateString()}
                        </time>
                      </button>
                      <span className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
                        <IconAction
                          size="xs"
                          label={`Rename ${s.title || 'session'}`}
                          tip="Rename"
                          icon={Pencil}
                          onClick={() => setRenaming({ s, title: s.title })}
                        />
                        {capabilities.fork && (
                          <IconAction
                            size="xs"
                            label={`Fork ${s.title || 'session'}`}
                            tip="Fork: a copy to try another direction"
                            icon={GitFork}
                            onClick={() => {
                              void forkSession(s, build).then(refresh, err)
                              setOpen(false)
                            }}
                          />
                        )}
                        <IconAction
                          size="xs"
                          label={`${verb} ${s.title || 'session'}`}
                          tip={verb}
                          icon={Trash2}
                          onClick={() => setRemoving(s)}
                        />
                      </span>
                    </div>
                  )
                )}
              </>
            )}
            {q && !shownThreads.length && !shownSessions.length && (
              <p className="px-2 py-1 text-sm text-fg-secondary">Nothing matches.</p>
            )}
          </div>
          <div className="border-t border-border-subtle pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start"
              disabled={!build}
              onClick={() => (newThread(build), setOpen(false))}
            >
              <Plus aria-hidden /> New thread
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <ConfirmDestructive
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`${verb} ${removing?.title || 'this session'}?`}
        action={verb}
        onConfirm={() => void remove(removing!).catch(err)}
      >
        <p>
          {provider === 'claude'
            ? 'Its transcript is deleted for good.'
            : 'The thread is archived and leaves this list.'}{' '}
          The build&apos;s files stay as they are.
        </p>
      </ConfirmDestructive>
    </>
  )
}

function Heading({ children }: { children: React.ReactNode }): ReactElement {
  return <h4 className="px-2 pt-2 pb-1 text-xs font-medium text-fg-muted">{children}</h4>
}
