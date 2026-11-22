// Design log (G6.5, reader with the round rail): DESIGN.md as a readable column with its Status block pinned
// on top, the review rounds in a rail beside it, and Edit in place. Main refuses a save that changes the
// Status block or follows a change on disk; the refusal stays above the editor with its fix.
// Logic: lib/designLog.ts.
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import type { Components } from 'react-markdown'
import { toast } from 'sonner'
import { ChevronDown, FileText, History, Lock, Pencil } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/primitives/sheet'
import { Prose } from '@/shared/ui/code/Prose'
import { Alert } from '@/shared/ui/feedback/Alert'
import { ConfirmDestructive } from '@/shared/ui/feedback/ConfirmDestructive'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { ErrorState } from '@/shared/ui/feedback/ErrorState'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
import { PageHeader } from '@/shared/ui/layout/PageHeader'
import { Timeline, type Round } from '@/shared/ui/data/progress'
import { KeyValueList } from '@/shared/ui/data/values'
import { jumpToHeading, useHeadingInView } from '@/shared/ui/layout/outline'
import { useWorkbench } from '@/widgets/workbench-shell/model/context'
import { IconButton } from '@/shared/ui/common/parts'
import { buildUrl } from '@/shared/lib/urls'
import { useBuild } from '@/entities/build/model/builds'
import { useShortcuts } from '@/shared/lib/shortcuts'
import { errorText } from '@/entities/build/model/workspace'
import {
  refusal,
  restoreStatus,
  roundId,
  roundLine,
  roundOf,
  sameEol,
  edited,
  statusItems,
  type Refusal
} from '@/pages/design-log/model/designLog'
import { designSaved, useDesignLog, writeDesign } from '../model/design'
import { text } from '@/shared/lib/format'

type Draft = { base: string; md: string; refused: Refusal | null }

export function DesignLog(): ReactElement {
  const { name } = useParams({ from: '/build/$name/log' })
  return <Log key={name} name={name} />
}

function Log({ name }: { name: string }): ReactElement {
  const { tier } = useWorkbench()
  const narrow = tier === 'phone' || tier === 'tablet'
  const navigate = useNavigate()
  const { data: build } = useBuild(name)
  const { md, rounds } = useDesignLog(name, build)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [ask, setAsk] = useState<null | 'cancel' | 'reload'>(null)
  const [railOpen, setRailOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const pane = useRef<HTMLDivElement>(null)
  const editor = useRef<HTMLTextAreaElement>(null)
  const editButton = useRef<HTMLButtonElement>(null)
  // entering edit mode puts focus in the editor, leaving it puts focus back on Edit
  const editing = !!draft
  const wasEditing = useRef(editing)
  useEffect(() => {
    if (editing === wasEditing.current) return
    wasEditing.current = editing
    ;(editing ? editor : editButton).current?.focus()
  }, [editing])

  const list = [...(build?.rounds ?? [])].reverse()
  const inView = useHeadingInView(pane, draft ? [] : list.map((r) => roundId(r.n)))
  const timeline: Round[] = list.map((r) => {
    const saved = rounds.data?.find((x) => x.round === r.n)
    const file =
      saved?.files.find((f) => f.name === saved.pick)?.sheet ??
      saved?.files.find((f) => f.sheet)?.sheet
    const pins = saved?.pins.length ?? 0
    const of = saved?.files.length ?? 0
    return {
      n: r.n,
      title: r.title,
      date: saved?.date.slice(5, 10),
      sheet: file ? buildUrl(file) : undefined,
      gist: saved
        ? `${saved.pick ? `Picked ${saved.pick} of ${of}` : `No pick of ${of}`} · ${pins} ${pins === 1 ? 'pin' : 'pins'}`
        : undefined
    }
  })
  const jump = (n: number): void => {
    setRailOpen(false)
    if (!draft) return jumpToHeading(roundId(n))
    // editing: move the editor to that round's heading line
    const el = editor.current
    const at = roundLine(draft.md, n)
    if (!el || at < 0) return
    el.focus()
    el.setSelectionRange(at, at)
    const line = draft.md.slice(0, at).split('\n').length - 1
    el.scrollTop = line * (parseFloat(getComputedStyle(el).lineHeight) || 20)
  }

  const dirty = !!draft && edited(draft.md, draft.base)
  async function save(): Promise<void> {
    if (!draft || !dirty || saving) return
    setSaving(true)
    try {
      await writeDesign(name, draft.base, sameEol(draft.md, draft.base))
      setDraft(null)
      designSaved(name)
      toast.success('DESIGN.md saved')
    } catch (e) {
      const why = refusal(e)
      if (why) setDraft({ ...draft, refused: why })
      else toast.error(errorText(e))
    } finally {
      setSaving(false)
    }
  }
  async function reload(): Promise<void> {
    const fresh = await md.refetch()
    setDraft(fresh.data == null ? null : { base: fresh.data, md: fresh.data, refused: null })
  }
  const cancel = (): void => (dirty ? setAsk('cancel') : setDraft(null))

  useShortcuts([
    draft && {
      keys: 'Ctrl+S',
      label: 'Save DESIGN.md',
      group: 'Design log',
      run: () => void save()
    },
    draft && {
      keys: 'Escape',
      label: 'Cancel editing',
      group: 'Design log',
      inFields: true,
      run: cancel
    }
  ])

  const components: Components = {
    h3: ({ children }) => {
      const n = roundOf(text(children))
      return (
        <h3 id={n ? roundId(n) : undefined} className="scroll-mt-28">
          {children}
        </h3>
      )
    }
  }

  const count = build?.rounds.length ?? 0
  const current = inView ? Number(inView.replace('round-', '')) : undefined
  const rail = (
    <section aria-labelledby="rounds-heading" className="flex flex-col gap-3">
      <h2 id="rounds-heading" className="flex items-baseline gap-2">
        <span className="font-medium">Reviews</span>
        <span className="font-mono text-sm text-fg-muted tabular-nums">{count}</span>
        <span className="ml-auto text-sm text-fg-muted">Newest first</span>
      </h2>
      {timeline.length ? (
        <Timeline rounds={timeline} current={current} onSelect={jump} />
      ) : (
        <EmptyState
          icon={History}
          size="panel"
          title="No reviews yet"
          action={
            <Button
              variant="outline"
              onClick={() => void navigate({ to: '/build/$name/review', params: { name } })}
            >
              Open Review
            </Button>
          }
        >
          Save a review and it appears here with its sheet. Click a review to jump to it in the log.
        </EmptyState>
      )}
    </section>
  )

  const items = statusItems(build?.status ?? [])
  const folded = tier === 'phone' && !statusOpen
  const status = (
    <section
      aria-label="Status, kept by the agent"
      className="sticky top-0 z-sticky mt-4 rounded-lg border border-accent-subtle-border bg-surface-raised px-4 py-3 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <h2 className="font-medium">Status</h2>
        <span className="flex items-center gap-1 text-sm text-fg-muted">
          <Lock aria-hidden className="size-3.5" /> Kept by the agent
        </span>
        {tier === 'phone' && items.length > 0 && (
          <IconButton
            icon={ChevronDown}
            label={statusOpen ? 'Hide the Status block' : 'Show the Status block'}
            aria-expanded={statusOpen}
            onClick={() => setStatusOpen(!statusOpen)}
            className="ml-auto"
          />
        )}
      </div>
      {md.isPending ? (
        <div className="mt-2 flex flex-col gap-2">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : !items.length ? (
        <p className="mt-1 text-sm text-fg-secondary">
          No Status block in DESIGN.md. The agent adds one; Edit can’t.
        </p>
      ) : folded ? (
        <p className="mt-1 truncate text-sm text-fg-secondary">
          {items
            .map((i) => i.value)
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : (
        <KeyValueList items={items} className="mt-1" />
      )}
    </section>
  )

  let body: ReactNode
  if (md.isPending) body = <LoadingState label="Reading DESIGN.md" layout="detail" />
  else if (md.error)
    body = (
      <ErrorState
        title="Can’t read DESIGN.md"
        error={md.error}
        onRetry={() => void md.refetch()}
        retryLabel="Try again"
      />
    )
  else if (!md.data)
    body = (
      <EmptyState icon={FileText} size="page" title={`No DESIGN.md for ${name} yet`}>
        The agent starts the log with the brief, and each review you save adds to it. It lives at
        builds/{name}/DESIGN.md.
      </EmptyState>
    )
  else if (draft)
    body = (
      <div className="flex min-h-[60vh] flex-1 flex-col gap-3">
        {draft.refused === 'status' && (
          <Alert
            tone="danger"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft({ ...draft, md: restoreStatus(draft.md, draft.base), refused: null })
                }
              >
                Restore the Status block
              </Button>
            }
          >
            Not saved. The Status block is the agent’s: put it back as it was. Your other changes
            are kept.
          </Alert>
        )}
        {draft.refused === 'disk' && (
          <Alert
            tone="danger"
            action={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(draft.md)
                      .then(() => toast.success('Your edit is on the clipboard'))
                  }
                >
                  Copy my edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAsk('reload')}>
                  Reload the file…
                </Button>
              </>
            }
          >
            Not saved. DESIGN.md changed on disk since you started editing. Your edit is kept here.
          </Alert>
        )}
        <Textarea
          ref={editor}
          variant="code"
          aria-label="DESIGN.md, raw"
          value={draft.md}
          onChange={(e) => setDraft({ ...draft, md: e.target.value })}
          className="min-h-0 flex-1"
        />
      </div>
    )
  else
    body = (
      <Prose variant="docs" components={components}>
        {md.data}
      </Prose>
    )

  const path = `builds/${name}/DESIGN.md`
  const meta = md.isPending
    ? 'Reading DESIGN.md…'
    : !md.data && !md.error
      ? `${path} · not created yet`
      : draft
        ? `${path} · editing${dirty ? ', unsaved changes' : ''}`
        : `${path} · ${count} ${count === 1 ? 'review' : 'reviews'}`

  return (
    <div className="flex h-full min-w-0 flex-col">
      <PageHeader
        title="Design log"
        meta={<span className="font-mono text-sm">{meta}</span>}
        className="border-b border-border-subtle px-4 py-2"
        actions={
          <>
            {narrow && (
              <Button variant="outline" onClick={() => setRailOpen(true)}>
                <History /> Reviews
              </Button>
            )}
            {draft ? (
              <>
                <span className="flex items-center gap-1 text-sm text-fg-secondary max-sm:hidden">
                  <Lock aria-hidden className="size-3.5" /> Save refuses a change to the Status
                  block.
                </span>
                <Button variant="ghost" onClick={cancel}>
                  Cancel
                </Button>
                <Button onClick={() => void save()} disabled={saving || !dirty}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : (
              <Button
                ref={editButton}
                variant="outline"
                disabled={!md.data}
                onClick={() => md.data && setDraft({ base: md.data, md: md.data, refused: null })}
              >
                <Pencil /> {tier === 'phone' ? 'Edit DESIGN.md' : 'Edit'}
              </Button>
            )}
          </>
        }
      />
      <div className="flex min-h-0 flex-1">
        <div
          ref={pane}
          tabIndex={0}
          role="region"
          aria-label="DESIGN.md"
          className="flex min-w-0 flex-1 flex-col overflow-auto px-4 pb-8 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus sm:px-6"
        >
          <div className="mx-auto flex min-h-full w-full max-w-prose flex-col gap-4">
            {status}
            {body}
          </div>
        </div>
        {!narrow && (
          <aside
            aria-label="Reviews"
            className="w-90 shrink-0 overflow-auto border-l border-border-subtle p-4"
          >
            {rail}
          </aside>
        )}
      </div>
      <Sheet open={railOpen} onOpenChange={setRailOpen}>
        <SheetContent side="bottom" className="overflow-auto">
          <SheetHeader>
            <SheetTitle>Reviews</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">{rail}</div>
        </SheetContent>
      </Sheet>
      <ConfirmDestructive
        open={ask === 'cancel'}
        onOpenChange={(o) => !o && setAsk(null)}
        title="Discard your edit?"
        action="Discard edit"
        onConfirm={() => setDraft(null)}
        onCloseAutoFocus={(e) => {
          if (draft) return
          e.preventDefault()
          editButton.current?.focus()
        }}
      >
        <p>Your changes to DESIGN.md aren’t saved and will be lost.</p>
      </ConfirmDestructive>
      <ConfirmDestructive
        open={ask === 'reload'}
        onOpenChange={(o) => !o && setAsk(null)}
        title="Reload DESIGN.md?"
        action="Reload and drop my edit"
        onConfirm={() => void reload()}
        onCloseAutoFocus={(e) => {
          if (draft?.refused) return
          e.preventDefault()
          editor.current?.focus()
        }}
      >
        <p>
          The file is read again from disk and your edit is dropped. Copy it first if you need it.
        </p>
      </ConfirmDestructive>
    </div>
  )
}
