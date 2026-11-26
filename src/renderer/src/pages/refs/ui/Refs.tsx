// References (visual-first board): clean 4:3 image cards with hidden empty notes, structured link
// and note cards, type filtering & search, live Chat attachment sync, and a zoomable Lightbox.
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactElement,
  type ReactNode
} from 'react'
import { useParams } from '@tanstack/react-router'
import { Check, Copy, ImagePlus, Images, MessageSquarePlus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Ref, RefAdd } from '@shared/api'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { RemovableChip } from '@/shared/ui/primitives/chip'
import { Input } from '@/shared/ui/primitives/input'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/primitives/toggle-group'
import { PageHeader } from '@/shared/ui/layout/PageHeader'
import { CardGrid } from '@/shared/ui/layout/Grids'
import { RefTile } from '@/shared/ui/data/ImageCards'
import { Lightbox } from '@/shared/ui/data/Lightbox'
import { ConfirmDestructive } from '@/shared/ui/feedback/ConfirmDestructive'
import { DropOverlay } from '@/shared/ui/feedback/DropOverlay'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { ErrorState } from '@/shared/ui/feedback/ErrorState'
import { Kbd } from '@/shared/ui/common/parts'
import { useWorkbench } from '@/widgets/workbench-shell/model/context'
import { buildUrl } from '@/shared/lib/urls'
import { useBuild } from '@/entities/build/model/builds'
import { errorText } from '@/entities/build/model/workspace'
import {
  addRefs,
  asLink,
  classifyDrag,
  dropped,
  EMPTY_REF_IDS,
  formatShortDate,
  matchesRefQuery,
  parseUriList,
  refImages,
  refPath,
  useChatRefs,
  useRefs,
  type DragKind
} from '@/entities/ref/model/refs'
import { copyRefImage, removeRef, saveNote as saveRefNote, updateRefItem } from '../model/actions'
import { AddLinkPopover, AddNotePopover } from './AddRefPopover'
import { LinkCard, NoteCard } from './RefCards'

type FilterKind = 'all' | 'image' | 'link' | 'note'
type PendingAdd = { key: string; name: string }

export function Refs(): ReactElement {
  const { name } = useParams({ from: '/build/$name/refs' })
  return <Board key={name} name={name} />
}

function Board({ name }: { name: string }): ReactElement {
  const { tier } = useWorkbench()
  const phone = tier === 'phone'
  const displayName = useBuild(name).data?.displayName || name
  const refs = useRefs(name)
  const attachedIds = useChatRefs((s) => s.byBuild[name] ?? EMPTY_REF_IDS)
  const [filter, setFilter] = useState<FilterKind>('all')
  const [query, setQuery] = useState('')
  const [drag, setDrag] = useState<DragKind>(null)
  const [adding, setAdding] = useState<PendingAdd[]>([])
  const [doomed, setDoomed] = useState<Ref | null>(null)
  const [shownId, setShownId] = useState<string | null>(null)
  const nextPendingKey = useRef(0)

  const add = async (list: RefAdd[]): Promise<void> => {
    if (!list.length) return
    const pending: PendingAdd[] = list.flatMap((r) =>
      r.kind === 'image' ? [{ key: `add-${++nextPendingKey.current}`, name: r.name }] : []
    )
    const keys = new Set(pending.map((p) => p.key))
    if (pending.length) setAdding((a) => [...a, ...pending])
    const failed = await addRefs(name, list)
    if (pending.length) setAdding((a) => a.filter((p) => !keys.has(p.key)))
    for (const f of failed) toast.error(errorText(f))
    if (pending.length)
      requestAnimationFrame(() =>
        document
          .querySelector('[data-ref-images] > :last-child')
          ?.scrollIntoView({ block: 'nearest' })
      )
  }

  const addRefLatest = useRef(add)
  useEffect(() => {
    addRefLatest.current = add
  })

  // Paste images or a lone link anywhere outside text inputs and modals; listener bound once.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (
        !target ||
        target.closest(
          'input, textarea, [contenteditable], [role="dialog"], [role="alertdialog"]'
        ) ||
        !e.clipboardData
      )
        return
      const files = [...e.clipboardData.files]
      const plain = e.clipboardData.getData('text/plain')
      const uriList = e.clipboardData.getData('text/uri-list')
      if (!files.length && !parseUriList(uriList) && !asLink(plain)) return
      e.preventDefault()
      void dropped(files, plain, uriList).then((items) => addRefLatest.current(items))
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const pickFiles = (): void => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/png,image/jpeg,image/webp,image/gif'
    input.onchange = async () => input.files && add(await refImages(input.files))
    input.click()
  }

  const onDragOver = (e: DragEvent): void => {
    const kind = classifyDrag(e.dataTransfer)
    if (!kind) return
    e.preventDefault()
    e.dataTransfer.dropEffect = kind.kind === 'unsupported' ? 'none' : 'copy'
    setDrag(kind)
  }

  const onDrop = async (e: DragEvent): Promise<void> => {
    e.preventDefault()
    const currentDrag = drag
    setDrag(null)
    const uriList = e.dataTransfer.getData('text/uri-list')
    const plain = e.dataTransfer.getData('text/plain')
    const items = await dropped(e.dataTransfer.files, plain, uriList)
    if (!items.length) {
      if (currentDrag?.kind === 'unsupported' || e.dataTransfer.files.length > 0) {
        toast.error('Only PNG, JPEG, WebP, and GIF images or web links can be added here.')
      }
      return
    }
    await add(items)
  }

  const all = refs.data ?? []
  const allImages = all.filter((r) => r.kind === 'image')
  const allLinks = all.filter((r) => r.kind === 'link')
  const allNotes = all.filter((r) => r.kind === 'note')

  // Automatically fall back to All if the active filtered kind becomes empty (e.g. after deleting its last item)
  const effectiveFilter: FilterKind =
    (filter === 'image' && allImages.length === 0 && adding.length === 0) ||
    (filter === 'link' && allLinks.length === 0) ||
    (filter === 'note' && allNotes.length === 0)
      ? 'all'
      : filter

  const filtered = all.filter((r) => matchesRefQuery(r, query))
  const images =
    effectiveFilter === 'all' || effectiveFilter === 'image'
      ? filtered.filter((r) => r.kind === 'image')
      : []
  const links =
    effectiveFilter === 'all' || effectiveFilter === 'link'
      ? filtered.filter((r) => r.kind === 'link')
      : []
  const notes =
    effectiveFilter === 'all' || effectiveFilter === 'note'
      ? filtered.filter((r) => r.kind === 'note')
      : []
  const showPending =
    (effectiveFilter === 'all' || effectiveFilter === 'image') && adding.length > 0

  const activeAttachedCount = all.filter((r) => attachedIds.includes(r.id)).length
  const visibleGroups =
    (images.length > 0 || showPending ? 1 : 0) +
    (links.length > 0 ? 1 : 0) +
    (notes.length > 0 ? 1 : 0)
  const showSectionHeadings = effectiveFilter === 'all' && visibleGroups > 1

  const viewableImages = allImages.filter((r) => !r.missing)
  const shownIndex = shownId ? viewableImages.findIndex((r) => r.id === shownId) : -1
  const lightboxOpen = shownIndex >= 0

  const toggleAttach = (id: string): void => useChatRefs.getState().toggle(name, id)

  const section = (title: string, count: number, children: ReactNode): ReactNode => (
    <section
      aria-labelledby={showSectionHeadings ? `refs-${title}` : undefined}
      className="flex flex-col gap-3"
    >
      {showSectionHeadings && (
        <h2
          id={`refs-${title}`}
          className="flex items-baseline gap-2 text-xs font-medium tracking-wide text-fg-muted uppercase"
        >
          {title}
          <span className="font-mono tabular-nums">{count}</span>
        </h2>
      )}
      {children}
    </section>
  )

  let board: ReactNode
  if (refs.isPending) {
    board = (
      <CardGrid min="13rem" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
        ))}
      </CardGrid>
    )
  } else if (refs.error) {
    board = (
      <ErrorState
        title="Can’t read references"
        error={refs.error}
        onRetry={() => void refs.refetch()}
        retryLabel="Try again"
      />
    )
  } else if (!all.length && !adding.length) {
    board = (
      <EmptyState
        icon={Images}
        size="page"
        title={`Collect references for ${displayName}`}
        action={
          <Button onClick={pickFiles}>
            <ImagePlus aria-hidden />
            Add images
          </Button>
        }
      >
        Drop screenshots or links anywhere here, press{' '}
        <span className="pointer-coarse:hidden">
          <Kbd keys="Ctrl+V" /> to paste
        </span>
        <span className="pointer-fine:hidden">paste</span>, or add a link or note above.
      </EmptyState>
    )
  } else if (visibleGroups === 0) {
    board = (
      <EmptyState
        icon={Search}
        size="panel"
        title="No matching references"
        action={
          <Button
            variant="outline"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
          >
            Clear filters
          </Button>
        }
      >
        Try a different search term or switch back to All.
      </EmptyState>
    )
  } else {
    board = (
      <div className="flex flex-col gap-6">
        {(images.length > 0 || showPending) &&
          section(
            'Images',
            images.length,
            <CardGrid min={phone ? '100%' : '13rem'} className="items-start" data-ref-images>
              {images.map((r) => (
                <RefTile
                  key={r.id}
                  name={r.title ?? r.file ?? 'image'}
                  image={buildUrl(refPath(name, r))}
                  note={r.note}
                  missing={!!r.missing}
                  attached={attachedIds.includes(r.id)}
                  onToggleAttach={() => toggleAttach(r.id)}
                  onNoteSave={(n) => saveRefNote(name, r, n)}
                  onOpen={r.missing ? undefined : () => setShownId(r.id)}
                  onDelete={() => setDoomed(r)}
                />
              ))}
              {showPending &&
                adding.map((p) => (
                  <RefTile key={p.key} name={p.name} note="" onNoteSave={() => {}} adding />
                ))}
            </CardGrid>
          )}
        {links.length > 0 &&
          section(
            'Links',
            links.length,
            <div className="flex flex-col gap-2">
              {links.map((r) => (
                <LinkCard
                  key={r.id}
                  refItem={r}
                  attached={attachedIds.includes(r.id)}
                  onToggleAttach={() => toggleAttach(r.id)}
                  onUpdate={(patch) => updateRefItem(name, r, patch)}
                  onDelete={() => setDoomed(r)}
                />
              ))}
            </div>
          )}
        {notes.length > 0 &&
          section(
            'Notes',
            notes.length,
            <CardGrid min="16rem">
              {notes.map((r) => (
                <NoteCard
                  key={r.id}
                  refItem={r}
                  attached={attachedIds.includes(r.id)}
                  onToggleAttach={() => toggleAttach(r.id)}
                  onSave={(n) => saveRefNote(name, r, n)}
                  onDelete={() => setDoomed(r)}
                />
              ))}
            </CardGrid>
          )}
      </div>
    )
  }

  const doomedName = doomed?.title ?? doomed?.file ?? 'this reference'
  const overlayLabel =
    drag?.kind === 'images'
      ? `Drop to add ${drag.count} ${drag.count === 1 ? 'image' : 'images'}`
      : drag?.kind === 'unsupported'
        ? 'Unsupported file type'
        : 'Drop to add link'
  const overlayDetail =
    drag?.kind === 'unsupported'
      ? 'Drop PNG, JPEG, WebP, or GIF images, or web links.'
      : 'Saved with this build.'

  return (
    <div
      className="relative flex h-full min-w-0 flex-col"
      onDragOver={onDragOver}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDrag(null)}
      onDrop={(e) => void onDrop(e)}
    >
      <PageHeader
        title="References"
        meta={all.length > 0 ? <Badge variant="secondary">{all.length}</Badge> : undefined}
        className="border-b border-border-subtle px-4 py-2.5 sm:px-6"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AddLinkPopover onAdd={(r) => add([r])} />
            <AddNotePopover onAdd={(r) => add([r])} />
            <Button variant={all.length === 0 ? 'primary' : 'outline'} onClick={pickFiles}>
              <ImagePlus aria-hidden />
              Add images
            </Button>
          </div>
        }
      />
      {all.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-surface-bg px-4 py-2 sm:px-6">
          <SegmentedControl
            size="sm"
            aria-label="Filter references by type"
            value={effectiveFilter}
            onValueChange={(v) => setFilter(v as FilterKind)}
          >
            <SegmentedControlItem value="all">All</SegmentedControlItem>
            <SegmentedControlItem value="image" disabled={allImages.length === 0}>
              Images
              <span className="font-mono text-xs text-fg-muted tabular-nums">
                {allImages.length}
              </span>
            </SegmentedControlItem>
            <SegmentedControlItem value="link" disabled={allLinks.length === 0}>
              Links
              <span className="font-mono text-xs text-fg-muted tabular-nums">
                {allLinks.length}
              </span>
            </SegmentedControlItem>
            <SegmentedControlItem value="note" disabled={allNotes.length === 0}>
              Notes
              <span className="font-mono text-xs text-fg-muted tabular-nums">
                {allNotes.length}
              </span>
            </SegmentedControlItem>
          </SegmentedControl>
          {activeAttachedCount > 0 && (
            <RemovableChip
              removeLabel="Clear attached references from chat"
              onRemove={() => useChatRefs.getState().clear(name)}
            >
              {activeAttachedCount} in chat
            </RemovableChip>
          )}
          <Input
            aria-label="Search references"
            placeholder="Search references…"
            leading={<Search aria-hidden />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery('')}
            className="ms-auto w-60 max-sm:ms-0 max-sm:w-full"
          />
        </div>
      )}
      <div
        aria-label="Reference board"
        role="region"
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto px-4 py-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus sm:px-6"
      >
        <div className="mx-auto w-full max-w-wide">{board}</div>
      </div>
      <DropOverlay active={drag !== null} label={overlayLabel} detail={overlayDetail} />
      <Lightbox
        items={viewableImages.map((r) => ({
          id: r.id,
          src: buildUrl(refPath(name, r)),
          name: r.title ?? r.file ?? 'image',
          note: r.note,
          meta: formatShortDate(r.added)
        }))}
        index={lightboxOpen ? shownIndex : 0}
        onIndexChange={(next) => setShownId(viewableImages[next]?.id ?? null)}
        open={lightboxOpen}
        onOpenChange={(o) => !o && setShownId(null)}
        onNoteChange={(n, i) => {
          const target = viewableImages[i]
          if (target) void saveRefNote(name, target, n)
        }}
        actions={(it, i) => {
          const current = viewableImages[i]
          if (!current) return null
          const isAttached = attachedIds.includes(current.id)
          return (
            <>
              <Button
                size="sm"
                variant={isAttached ? 'secondary' : 'outline'}
                onClick={() => toggleAttach(current.id)}
              >
                {isAttached ? <Check aria-hidden /> : <MessageSquarePlus aria-hidden />}
                {isAttached ? 'In chat' : 'Attach to chat'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void copyRefImage(it.src)}>
                <Copy aria-hidden />
                Copy image
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDoomed(current)}>
                <Trash2 aria-hidden />
                Delete…
              </Button>
            </>
          )
        }}
      />
      <ConfirmDestructive
        open={!!doomed}
        onOpenChange={(o) => !o && setDoomed(null)}
        title={doomed?.kind === 'image' ? 'Delete this image?' : 'Delete this reference?'}
        onConfirm={async () => {
          const target = doomed
          if (!target) return
          if (shownId === target.id) {
            const idx = viewableImages.findIndex((r) => r.id === target.id)
            const neighbor = viewableImages[idx + 1] ?? viewableImages[idx - 1] ?? null
            setShownId(neighbor?.id ?? null)
          }
          await removeRef(name, target)
        }}
      >
        <p>
          {doomed?.kind === 'image'
            ? `${doomedName} will be moved to the Recycle Bin.`
            : 'This reference will be removed from the board.'}
        </p>
      </ConfirmDestructive>
    </div>
  )
}
