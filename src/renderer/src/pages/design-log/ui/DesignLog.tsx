// Design log (Structured Build Journal + Status-safe Markdown editor): parses DESIGN.md and saved
// review/round_N.json files into a readable journal (Status summary, Brief & Decisions, newest-first
// collapsible Review & Export cards with zoomable sheets, slim PageOutline) while keeping Status
// untouched automatically during raw Markdown editing.
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { DropdownMenu } from 'radix-ui'
import { toast } from 'sonner'
import {
  ArrowDownUp,
  Copy,
  FileText,
  FolderOpen,
  ListTree,
  MoreHorizontal,
  Pencil,
  ScanEye,
  Search
} from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/primitives/sheet'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { Prose } from '@/shared/ui/code/Prose'
import { Lightbox } from '@/shared/ui/data/Lightbox'
import { Alert } from '@/shared/ui/feedback/Alert'
import { ConfirmDestructive } from '@/shared/ui/feedback/ConfirmDestructive'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { ErrorState } from '@/shared/ui/feedback/ErrorState'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
import { PageHeader } from '@/shared/ui/layout/PageHeader'
import { PageOutline } from '@/shared/ui/layout/PageOutline'
import { jumpToHeading, useHeadingInView, type OutlineItem } from '@/shared/ui/layout/outline'
import { IconAction } from '@/shared/ui/common/Tip'
import { menuItem } from '@/shared/ui/common/styles'
import { buildUrl } from '@/shared/lib/urls'
import { useShortcuts } from '@/shared/lib/shortcuts'
import { useBuild } from '@/entities/build/model/builds'
import { errorText } from '@/entities/build/model/workspace'
import {
  edited,
  filterDesignDocument,
  mergeFromEdit,
  parseDesignDocument,
  refusal,
  restoreStatus,
  splitForEdit,
  starterDesign,
  type Refusal
} from '../model/designLog'
import {
  copySheetImage,
  designSaved,
  revealDesign,
  useDesignLog,
  writeDesign
} from '../model/design'
import {
  BriefPromptCard,
  ExportCard,
  JournalNoteCard,
  RoundCard,
  SectionCard,
  StatusSummaryCard
} from './JournalCards'

type Draft = {
  base: string
  initialBody: string
  body: string
  hasStatus: boolean
  refused: Refusal | null
}

const todayIso = (): string => new Date().toISOString().slice(0, 10)

export function DesignLog(): ReactElement {
  const { name } = useParams({ from: '/build/$name/log' })
  return <Log key={name} name={name} />
}

function Log({ name }: { name: string }): ReactElement {
  const navigate = useNavigate()
  const { data: build } = useBuild(name)
  const displayName = build?.displayName || name
  const { md, rounds } = useDesignLog(name)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [ask, setAsk] = useState<null | 'cancel' | 'reload'>(null)
  const [query, setQuery] = useState('')
  const [newestFirst, setNewestFirst] = useState(true)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [activeSheet, setActiveSheet] = useState<string | null>(null)
  const [toggledRounds, setToggledRounds] = useState<Record<string, boolean>>({})

  const pane = useRef<HTMLDivElement>(null)
  const editor = useRef<HTMLTextAreaElement>(null)
  const editButton = useRef<HTMLButtonElement>(null)
  const postCloseFocus = useRef<'edit' | 'editor' | null>(null)

  const editing = !!draft
  const wasEditing = useRef(editing)
  useEffect(() => {
    if (editing === wasEditing.current) return
    wasEditing.current = editing
    ;(editing ? editor : editButton).current?.focus()
  }, [editing])

  const parsed = useMemo(
    () => parseDesignDocument(md.data ?? '', rounds.data ?? []),
    [md.data, rounds.data]
  )
  const filtered = useMemo(() => filterDesignDocument(parsed, query), [parsed, query])
  const orderedEntries = useMemo(
    () => (newestFirst ? [...filtered.entries].reverse() : filtered.entries),
    [filtered.entries, newestFirst]
  )

  const sheetItems = useMemo(
    () =>
      orderedEntries
        .filter((e): e is Extract<typeof e, { kind: 'round' }> => e.kind === 'round' && !!e.sheet)
        .map((e) => ({
          id: e.sheet!,
          src: buildUrl(e.sheet!),
          name: `Round ${e.round} · ${e.title}`,
          meta: e.date
        })),
    [orderedEntries]
  )
  const activeSheetIndex = activeSheet ? sheetItems.findIndex((s) => s.id === activeSheet) : -1

  const outlineItems: OutlineItem[] = useMemo(() => {
    if (editing) return []
    const items: OutlineItem[] = []
    if (filtered.status.length > 0) {
      items.push({ id: 'section-status', title: 'Status', level: 2 })
    }
    if (filtered.brief && !filtered.brief.empty) {
      items.push({ id: filtered.brief.id, title: filtered.brief.title, level: 2 })
    }
    for (const s of filtered.sections) {
      items.push({ id: s.id, title: s.title, level: 2 })
    }
    for (const e of orderedEntries) {
      items.push({
        id: e.id,
        title: e.kind === 'round' ? `R${e.round}: ${e.title}` : e.title,
        level: 3
      })
    }
    return items
  }, [editing, filtered, orderedEntries])

  const outlineIds = useMemo(() => outlineItems.map((i) => i.id), [outlineItems])
  const inView = useHeadingInView(pane, outlineIds)

  const jump = (id: string): void => {
    setOutlineOpen(false)
    if (id.startsWith('round-')) {
      setToggledRounds((prev) => ({ ...prev, [id]: true }))
      requestAnimationFrame(() => jumpToHeading(id))
      return
    }
    jumpToHeading(id)
  }

  const startEdit = (): void => {
    const raw = md.data ?? ''
    if (!raw) {
      const starter = starterDesign(displayName, todayIso())
      setDraft({ base: '', initialBody: '', body: starter, hasStatus: false, refused: null })
      return
    }
    const { body, hasStatus } = splitForEdit(raw)
    setDraft({ base: raw, initialBody: body, body, hasStatus, refused: null })
  }

  const dirty = !!draft && edited(draft.body, draft.initialBody)

  async function save(): Promise<void> {
    if (!draft || !dirty || saving) return
    setSaving(true)
    // a promise chain, not try/finally: React Compiler skips components with a finally block
    await Promise.resolve()
      .then(() => writeDesign(name, draft.base, mergeFromEdit(draft.body, draft.base)))
      .then(
        () => {
          setDraft(null)
          designSaved(name)
          toast.success('Design log saved')
        },
        (e) => {
          const why = refusal(e)
          if (why) setDraft({ ...draft, refused: why })
          else toast.error(errorText(e))
        }
      )
      .finally(() => setSaving(false))
  }

  async function reload(): Promise<void> {
    const fresh = await md.refetch()
    if (fresh.data == null) {
      setDraft(null)
      return
    }
    const { body, hasStatus } = splitForEdit(fresh.data)
    setDraft({ base: fresh.data, initialBody: body, body, hasStatus, refused: null })
  }

  const cancel = (): void => {
    if (dirty) setAsk('cancel')
    else setDraft(null)
  }

  useShortcuts([
    draft && {
      keys: 'Ctrl+S',
      label: 'Save design log',
      group: 'Design log',
      inFields: true,
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

  const reviewCount = parsed.entries.filter((e) => e.kind === 'round').length
  const exportCount = parsed.entries.filter((e) => e.kind === 'export').length
  const hasContent = Boolean(md.data?.trim() || (rounds.data && rounds.data.length > 0))
  const hasVisibleJournal = Boolean(
    filtered.status.length ||
    filtered.intro ||
    (filtered.brief && !filtered.brief.empty) ||
    filtered.sections.length ||
    orderedEntries.length
  )

  const summaryParts = [
    reviewCount > 0 ? `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}` : null,
    exportCount > 0 ? `${exportCount} ${exportCount === 1 ? 'export' : 'exports'}` : null
  ].filter(Boolean)
  const metaText = draft
    ? dirty
      ? 'Editing · unsaved changes'
      : 'Editing'
    : summaryParts.length
      ? summaryParts.join(' · ')
      : null

  const relPath = `builds/${name}/DESIGN.md`

  let body: ReactNode
  if (md.isPending) {
    body = <LoadingState label="Reading design log" layout="detail" />
  } else if (md.error) {
    body = (
      <ErrorState
        title="Can’t read design log"
        error={md.error}
        onRetry={() => void md.refetch()}
        retryLabel="Try again"
      />
    )
  } else if (draft) {
    body = (
      <div className="flex min-h-[65vh] flex-1 flex-col gap-3">
        {draft.hasStatus && (
          <p className="text-xs text-fg-muted">
            The assistant’s Status summary is preserved automatically when you save.
          </p>
        )}
        {draft.refused === 'status' && (
          <Alert
            tone="danger"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const fixed = restoreStatus(mergeFromEdit(draft.body, draft.base), draft.base)
                  const { body: nextBody, hasStatus } = splitForEdit(fixed)
                  setDraft({ ...draft, body: nextBody, hasStatus, refused: null })
                }}
              >
                Restore Status block
              </Button>
            }
          >
            Not saved. The Status block changed unexpectedly. Restore it to keep your edits.
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
                      .writeText(mergeFromEdit(draft.body, draft.base))
                      .then(() => toast.success('Your edit is on the clipboard'))
                  }
                >
                  Copy my edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAsk('reload')}>
                  Reload file…
                </Button>
              </>
            }
          >
            Not saved. DESIGN.md changed on disk while you were editing. Your changes are kept here.
          </Alert>
        )}
        <Textarea
          ref={editor}
          variant="code"
          aria-label="Design log Markdown"
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          className="min-h-0 flex-1"
        />
      </div>
    )
  } else if (!hasContent) {
    body = (
      <EmptyState
        icon={FileText}
        size="page"
        title={`No design log for ${displayName} yet`}
        action={<Button onClick={startEdit}>Start design log</Button>}
      >
        Your build’s brief, decisions, saved reviews, and export history will appear here as you
        work.
      </EmptyState>
    )
  } else if (query.trim() && !hasVisibleJournal) {
    body = (
      <EmptyState
        icon={Search}
        size="panel"
        title="No matching entries"
        action={
          <Button variant="outline" onClick={() => setQuery('')}>
            Clear search
          </Button>
        }
      >
        Nothing in the design log matched “{query.trim()}”.
      </EmptyState>
    )
  } else {
    const showBriefPrompt = !query.trim() && (!parsed.brief || parsed.brief.empty)
    body = (
      <div className="flex flex-col gap-5">
        <StatusSummaryCard rows={filtered.status} />

        {filtered.intro && !query.trim() && (
          <Prose variant="docs" className="max-w-none text-fg-secondary">
            {filtered.intro}
          </Prose>
        )}

        {filtered.brief && !filtered.brief.empty ? (
          <SectionCard section={filtered.brief} />
        ) : showBriefPrompt ? (
          <BriefPromptCard onWrite={startEdit} />
        ) : null}

        {filtered.sections.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}

        {orderedEntries.length > 0 && (
          <section aria-labelledby="history-heading" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2
                id="history-heading"
                className="flex items-baseline gap-2 text-xs font-medium tracking-wide text-fg-muted uppercase"
              >
                History
                <span className="font-mono tabular-nums">{orderedEntries.length}</span>
              </h2>
              {orderedEntries.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewestFirst((v) => !v)}
                  className="h-(--density-control-sm) text-xs text-fg-secondary"
                >
                  <ArrowDownUp aria-hidden className="size-3.5" />
                  {newestFirst ? 'Newest first' : 'Oldest first'}
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {orderedEntries.map((entry, idx) => {
                if (entry.kind === 'round') {
                  const isOpen = toggledRounds[entry.id] ?? (Boolean(query.trim()) || idx < 3)
                  return (
                    <RoundCard
                      key={entry.id}
                      entry={entry}
                      open={isOpen}
                      onOpenChange={(next) =>
                        setToggledRounds((prev) => ({ ...prev, [entry.id]: next }))
                      }
                      onOpenSheet={(sheet) => setActiveSheet(sheet)}
                    />
                  )
                }
                if (entry.kind === 'export') {
                  return <ExportCard key={entry.id} entry={entry} />
                }
                return <JournalNoteCard key={entry.id} entry={entry} />
              })}
            </div>
          </section>
        )}

        {!hasVisibleJournal && !showBriefPrompt && (
          <EmptyState
            icon={FileText}
            size="panel"
            title="Design log is empty"
            action={
              <Button variant="outline" onClick={startEdit}>
                <Pencil aria-hidden />
                Edit Markdown
              </Button>
            }
          >
            Add a brief, design notes, or save a review to populate this log.
          </EmptyState>
        )}
      </div>
    )
  }

  const showOutlineRail = !editing && outlineItems.length >= 2

  return (
    <div className="flex h-full min-w-0 flex-col">
      <PageHeader
        title="Design log"
        meta={metaText ? <span>{metaText}</span> : undefined}
        className="border-b border-border-subtle px-4 py-2.5 sm:px-6"
        actions={
          draft ? (
            <>
              <Button variant="ghost" onClick={cancel}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={saving || !dirty}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              {hasContent && (
                <Input
                  aria-label="Search design log"
                  placeholder="Search log…"
                  leading={<Search aria-hidden />}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onClear={() => setQuery('')}
                  className="w-52 max-sm:w-40"
                />
              )}
              {showOutlineRail && (
                <Button
                  variant="outline"
                  className="xl:hidden"
                  onClick={() => setOutlineOpen(true)}
                >
                  <ListTree aria-hidden />
                  <span className="max-sm:hidden">Outline</span>
                </Button>
              )}
              <Button ref={editButton} variant="outline" onClick={startEdit}>
                <Pencil aria-hidden />
                {md.data ? 'Edit' : 'Start log'}
              </Button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <IconAction icon={MoreHorizontal} label="More log actions" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="z-dropdown min-w-48 rounded-lg border border-border-default bg-surface-overlay p-1 shadow-md"
                  >
                    <DropdownMenu.Item
                      className={menuItem}
                      onSelect={() =>
                        void navigate({ to: '/build/$name/review', params: { name } })
                      }
                    >
                      <ScanEye aria-hidden className="size-4 text-fg-muted" />
                      Open Review
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className={menuItem}
                      onSelect={() =>
                        void navigator.clipboard
                          .writeText(relPath)
                          .then(() => toast.success('Path copied'))
                      }
                    >
                      <Copy aria-hidden className="size-4 text-fg-muted" />
                      Copy file path
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className={menuItem}
                      onSelect={() => void revealDesign(name)}
                    >
                      <FolderOpen aria-hidden className="size-4 text-fg-muted" />
                      Show in folder
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </>
          )
        }
      />

      <div className="flex min-h-0 flex-1">
        <div
          ref={pane}
          tabIndex={0}
          role="region"
          aria-label="Design log"
          className="flex min-w-0 flex-1 flex-col overflow-auto px-4 py-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus sm:px-6"
        >
          <div className="mx-auto flex min-h-full w-full max-w-prose flex-col gap-5">{body}</div>
        </div>

        {showOutlineRail && (
          <aside
            aria-label="Log outline"
            className="hidden w-56 shrink-0 overflow-auto border-l border-border-subtle px-3 py-5 xl:block"
          >
            <PageOutline items={outlineItems} current={inView} onJump={jump} label="Contents" />
          </aside>
        )}
      </div>

      <Sheet open={outlineOpen} onOpenChange={setOutlineOpen}>
        <SheetContent side="bottom" className="max-h-[70dvh] overflow-auto">
          <SheetHeader>
            <SheetTitle>Contents</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <PageOutline items={outlineItems} current={inView} onJump={jump} label="" />
          </div>
        </SheetContent>
      </Sheet>

      <Lightbox
        items={sheetItems}
        index={activeSheetIndex >= 0 ? activeSheetIndex : 0}
        onIndexChange={(next) => setActiveSheet(sheetItems[next]?.id ?? null)}
        open={activeSheetIndex >= 0}
        onOpenChange={(o) => !o && setActiveSheet(null)}
        actions={(it) => (
          <Button size="sm" variant="outline" onClick={() => void copySheetImage(it.src)}>
            <Copy aria-hidden />
            Copy image
          </Button>
        )}
      />

      <ConfirmDestructive
        open={ask === 'cancel'}
        onOpenChange={(o) => !o && setAsk(null)}
        title="Discard your edit?"
        action="Discard edit"
        onConfirm={() => {
          postCloseFocus.current = 'edit'
          setDraft(null)
        }}
        onCloseAutoFocus={(e) => {
          if (postCloseFocus.current !== 'edit') return
          postCloseFocus.current = null
          e.preventDefault()
          editButton.current?.focus()
        }}
      >
        <p>Your changes to the design log aren’t saved and will be lost.</p>
      </ConfirmDestructive>

      <ConfirmDestructive
        open={ask === 'reload'}
        onOpenChange={(o) => !o && setAsk(null)}
        title="Reload design log?"
        action="Reload and drop my edit"
        onConfirm={() => {
          postCloseFocus.current = 'editor'
          void reload()
        }}
        onCloseAutoFocus={(e) => {
          if (postCloseFocus.current !== 'editor') return
          postCloseFocus.current = null
          e.preventDefault()
          editor.current?.focus()
        }}
      >
        <p>
          The file will be reloaded from disk and your unsaved edit will be dropped. Copy it first
          if you want to keep it.
        </p>
      </ConfirmDestructive>
    </div>
  )
}
