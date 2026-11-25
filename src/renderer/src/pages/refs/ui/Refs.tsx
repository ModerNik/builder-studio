// References (G6-4-RF3, grouped board with a lightbox): all images at a glance as even 4:3 tiles, links and
// notes in their own sections, kept in builds/<name>/refs/. Paste a screenshot or a lone link anywhere that
// is not a text field, drop images or links on the board, or type a link or note in the add bar. A tile
// opens the Lightbox. Logic: lib/refs.ts.
import { useEffect, useState, type DragEvent, type ReactElement, type ReactNode } from 'react'
import { useParams } from '@tanstack/react-router'
import { ImagePlus, Images, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Ref, RefAdd } from '@shared/api'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import { PageHeader } from '@/shared/ui/layout/PageHeader'
import { CardGrid } from '@/shared/ui/layout/Grids'
import { RefTile } from '@/shared/ui/data/ImageCards'
import { Lightbox } from '@/shared/ui/data/Lightbox'
import { ConfirmDestructive } from '@/shared/ui/feedback/ConfirmDestructive'
import { DropOverlay } from '@/shared/ui/feedback/DropOverlay'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { ErrorState } from '@/shared/ui/feedback/ErrorState'
import { IconAction } from '@/shared/ui/common/Tip'
import { Kbd } from '@/shared/ui/common/parts'
import { useWorkbench } from '@/widgets/workbench-shell/model/context'
import { buildUrl } from '@/shared/lib/urls'
import { useBuild } from '@/entities/build/model/builds'
import { errorText } from '@/entities/build/model/workspace'
import { addRefs, asLink, dropped, refImages, refPath, useRefs } from '@/entities/ref/model/refs'
import { removeRef, saveNote as saveRefNote } from '../model/actions'

export function Refs(): ReactElement {
  const { name } = useParams({ from: '/build/$name/refs' })
  return <Board key={name} name={name} />
}

function Board({ name }: { name: string }): ReactElement {
  const { tier } = useWorkbench()
  const phone = tier === 'phone'
  const displayName = useBuild(name).data?.displayName || name
  const refs = useRefs(name)
  const [text, setText] = useState('')
  const [drag, setDrag] = useState<number | null>(null) // images being dragged in, 0 for a link
  const [adding, setAdding] = useState<string[]>([])
  const [doomed, setDoomed] = useState<Ref | null>(null)
  const [shown, setShown] = useState<number | null>(null)

  async function add(list: RefAdd[]): Promise<void> {
    if (!list.length) return
    const names = list.flatMap((r) => (r.kind === 'image' ? [r.name] : []))
    setAdding((a) => [...a, ...names])
    const failed = await addRefs(name, list)
    setAdding((a) => a.filter((n) => !names.includes(n)))
    for (const f of failed) toast.error(errorText(f))
    if (names.length)
      requestAnimationFrame(() =>
        document
          .querySelector('[data-ref-images] > :last-child')
          ?.scrollIntoView({ block: 'nearest' })
      )
  }

  // paste anywhere that is not a text field: images, or a lone link
  useEffect(() => {
    const onPaste = (e: ClipboardEvent): void => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable]') || !e.clipboardData) return
      const files = [...e.clipboardData.files]
      const plain = e.clipboardData.getData('text/plain')
      if (!files.length && !asLink(plain)) return
      e.preventDefault()
      void dropped(files, plain).then(add)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }) // re-binds each render so `add` is current

  const submit = (): void => {
    const t = text.trim()
    if (!t) return
    const link = asLink(t)
    setText('')
    void add([link ? { kind: 'link', url: link, note: '' } : { kind: 'note', note: t }])
  }
  const pickFiles = (): void => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/png,image/jpeg,image/webp,image/gif'
    input.onchange = async () => input.files && add(await refImages(input.files))
    input.click()
  }
  const onDragOver = (e: DragEvent): void => {
    e.preventDefault()
    const items = [...e.dataTransfer.items]
    setDrag(items.filter((i) => i.kind === 'file' && i.type.startsWith('image/')).length)
  }
  const onDrop = async (e: DragEvent): Promise<void> => {
    e.preventDefault()
    setDrag(null)
    const t = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    await add(await dropped(e.dataTransfer.files, t))
  }
  const saveNote = (r: Ref, note: string): void => saveRefNote(name, r, note)

  const all = refs.data ?? []
  const images = all.filter((r) => r.kind === 'image')
  const links = all.filter((r) => r.kind === 'link')
  const notes = all.filter((r) => r.kind === 'note')
  const isLink = !!asLink(text)

  const section = (title: string, count: number, children: ReactNode): ReactNode => (
    <section aria-labelledby={`refs-${title}`} className="flex flex-col gap-3">
      <h2
        id={`refs-${title}`}
        className="sticky top-0 z-sticky flex items-baseline gap-2 bg-surface py-2 font-medium"
      >
        {title}
        <span className="font-mono text-sm text-fg-muted tabular-nums">{count}</span>
      </h2>
      {children}
    </section>
  )

  let board: ReactNode
  if (refs.isPending)
    board = (
      <CardGrid min="12rem" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
        ))}
      </CardGrid>
    )
  else if (refs.error)
    board = (
      <ErrorState
        title="Can’t read the reference board"
        error={refs.error}
        onRetry={() => void refs.refetch()}
        retryLabel="Try again"
      >
        builds/{name}/refs/index.json
      </ErrorState>
    )
  else if (!all.length && !adding.length)
    board = (
      <EmptyState
        icon={Images}
        size="page"
        title={`Collect references for ${displayName}`}
        action={
          <Button variant="outline" onClick={pickFiles}>
            <ImagePlus /> Add images…
          </Button>
        }
      >
        Paste a screenshot anywhere here
        <span className="pointer-coarse:hidden">
          {' '}
          (<Kbd keys="Ctrl+V" />)
        </span>
        , drop images or links, or type a note above. They are kept in refs/ beside the build.
      </EmptyState>
    )
  else
    board = (
      <div className="flex flex-col gap-6">
        {(images.length > 0 || adding.length > 0) &&
          section(
            'Images',
            images.length,
            <CardGrid min={phone ? '100%' : '12rem'} data-ref-images>
              {images.map((r, i) => (
                <RefTile
                  key={r.id}
                  name={r.title ?? r.file ?? 'image'}
                  image={buildUrl(refPath(name, r))}
                  note={r.note}
                  onNoteSave={(n) => saveNote(r, n)}
                  onOpen={() => setShown(i)}
                  onDelete={() => setDoomed(r)}
                />
              ))}
              {adding.map((n) => (
                <RefTile key={n} name={n} note="" onNoteSave={() => {}} adding />
              ))}
            </CardGrid>
          )}
        {links.length > 0 &&
          section(
            'Links',
            links.length,
            <ul className="flex flex-col divide-y divide-border-subtle">
              {links.map((r) => (
                <li
                  key={r.id}
                  className="group/ref flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
                >
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 shrink grow-0 basis-80 truncate text-accent-text underline-offset-4 can-hover:hover:underline"
                  >
                    {r.url?.replace(/^https?:\/\//, '')}
                  </a>
                  <NoteInput
                    key={r.note}
                    label={`Note for ${r.url}`}
                    note={r.note}
                    onSave={(n) => saveNote(r, n)}
                  />
                  <DeleteAction label="Delete link" onClick={() => setDoomed(r)} />
                </li>
              ))}
            </ul>
          )}
        {notes.length > 0 &&
          section(
            'Notes',
            notes.length,
            <CardGrid min="16rem">
              {notes.map((r) => (
                <div
                  key={r.id}
                  className="group/ref flex items-start gap-1 rounded-lg border border-border-subtle bg-surface-raised p-2"
                >
                  <NoteArea key={r.note} note={r.note} onSave={(n) => saveNote(r, n)} />
                  <DeleteAction label="Delete note" onClick={() => setDoomed(r)} />
                </div>
              ))}
            </CardGrid>
          )}
      </div>
    )

  const doomedName = doomed?.title ?? doomed?.file ?? ''
  return (
    <div
      className="relative flex h-full min-w-0 flex-col"
      onDragOver={onDragOver}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDrag(null)}
      onDrop={(e) => void onDrop(e)}
    >
      <PageHeader
        title="References"
        description={
          phone ? (
            `${all.length} references in refs/`
          ) : (
            <>
              {all.length} {all.length === 1 ? 'reference' : 'references'} in builds/{name}/refs/.
              Paste a screenshot anywhere here
              <span className="pointer-coarse:hidden">
                {' '}
                (<Kbd keys="Ctrl+V" />)
              </span>{' '}
              or drop images and links.
            </>
          )
        }
        className="border-b border-border-subtle px-4 py-3 sm:px-6"
        actions={
          <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
            <Input
              aria-label="A link or a note"
              placeholder={
                phone ? 'Paste a link or type a note' : 'Paste a link or type a note, Enter adds it'
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="w-85 max-sm:min-w-0 max-sm:flex-1"
            />
            <Button variant="outline" disabled={!text.trim()} onClick={submit}>
              {isLink ? 'Add link' : 'Add note'}
            </Button>
            <Button variant="outline" onClick={pickFiles}>
              <ImagePlus /> Add images…
            </Button>
          </div>
        }
      />
      <div
        aria-label="Reference board"
        role="region"
        className="min-h-0 flex-1 overflow-auto px-4 pb-6 sm:px-6"
      >
        {board}
      </div>
      <DropOverlay
        active={drag !== null}
        label={
          drag ? `Drop to add ${drag} ${drag === 1 ? 'image' : 'images'}` : 'Drop to add a link'
        }
        detail="They are copied into refs/ and listed in index.json."
      />
      <Lightbox
        items={images.map((r) => ({
          src: buildUrl(refPath(name, r)),
          name: r.title ?? r.file ?? 'image',
          note: r.note,
          meta: `added ${r.added.slice(0, 10)}`
        }))}
        index={shown ?? 0}
        onIndexChange={setShown}
        open={shown !== null}
        onOpenChange={(o) => !o && setShown(null)}
        onNoteChange={(n, i) => images[i] && saveNote(images[i], n)}
        actions={() => (
          <Button variant="outline" onClick={() => shown !== null && setDoomed(images[shown])}>
            <Trash2 /> Delete…
          </Button>
        )}
      />
      <ConfirmDestructive
        open={!!doomed}
        onOpenChange={(o) => !o && setDoomed(null)}
        title="Delete this reference?"
        onConfirm={async () => {
          const r = doomed!
          setShown(null)
          await removeRef(name, r)
        }}
      >
        <p>
          {doomed?.kind === 'image'
            ? `${doomedName} goes to the Recycle Bin and is removed from refs/index.json.`
            : 'It is removed from refs/index.json.'}
        </p>
      </ConfirmDestructive>
    </div>
  )
}

function DeleteAction({ label, onClick }: { label: string; onClick: () => void }): ReactElement {
  return (
    <span className="opacity-0 transition-opacity duration-fast group-focus-within/ref:opacity-100 group-hover/ref:opacity-100 pointer-coarse:opacity-100">
      <IconAction label={label} icon={Trash2} onClick={onClick} />
    </span>
  )
}

function NoteInput({
  label,
  note,
  onSave
}: {
  label: string
  note: string
  onSave: (note: string) => void
}): ReactElement {
  const [text, setText] = useState(note)
  return (
    <Input
      aria-label={label}
      placeholder="Add a note…"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== note && onSave(text)}
      className="min-w-40 flex-1 border-transparent bg-transparent text-sm can-hover:hover:border-border-default"
    />
  )
}

function NoteArea({
  note,
  onSave
}: {
  note: string
  onSave: (note: string) => void
}): ReactElement {
  const [text, setText] = useState(note)
  return (
    <Textarea
      aria-label="Note"
      value={text}
      rows={Math.min(8, text.split('\n').length + 1)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== note && onSave(text)}
      className="min-w-0 flex-1 resize-none border-transparent bg-transparent can-hover:hover:border-border-default"
    />
  )
}
