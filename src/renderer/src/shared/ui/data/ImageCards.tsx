// Image cards: a preview on viewer grey with text under it. BuildCard (Gallery; with a row variant for the
// list view), PrefabTile (Labs prefab sheets) and RefTile (References images). Each takes data and
// callbacks; copying, opening and saving are the screen's.
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode
} from 'react'
import { Check, ImageOff, MessageSquarePlus, Pencil, Trash2, TriangleAlert } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/primitives/badge'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { IconAction, Tip } from '@/shared/ui/common/Tip'
import { useCopy } from '@/shared/ui/common/copy'

// the stretched open button draws the card's focus ring on the card, not around the name
const cardFocus =
  'has-[[data-slot=card-open]:focus-visible]:outline-(length:--focus-width) has-[[data-slot=card-open]:focus-visible]:outline-offset-(--focus-offset) has-[[data-slot=card-open]:focus-visible]:outline-focus has-[[data-slot=card-open]:focus-visible]:outline-solid'
const stretched = 'outline-none after:absolute after:inset-0 after:content-[""]'

/** A preview image on viewer grey at a fixed aspect; a missing or broken image shows `fallback`. */
export function ImageMedia({
  src,
  alt = '',
  aspect,
  fit = 'cover',
  pixelated = false,
  fallback,
  children,
  className
}: {
  src?: string | null
  alt?: string
  /** CSS aspect-ratio, e.g. "16 / 10". */
  aspect: string
  /** `cover` fills and crops; `contain` shows the full image without cropping. */
  fit?: 'cover' | 'contain'
  /** Sprites and block art: no smoothing. */
  pixelated?: boolean
  /** Shown when there is no image or it fails to load. */
  fallback?: ReactNode
  /** Overlays: a corner badge, a progress bar. */
  children?: ReactNode
  className?: string
}): ReactElement {
  const [broken, setBroken] = useState(false)
  const [seen, setSeen] = useState(src)
  if (src !== seen) {
    setSeen(src)
    setBroken(false)
  }
  return (
    <div
      className={cn('relative shrink-0 overflow-hidden bg-surface-viewer', className)}
      style={{ aspectRatio: aspect }}
    >
      {src && !broken ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setBroken(true)}
          className={cn(
            'absolute inset-0 size-full',
            fit === 'contain' ? 'object-contain' : 'object-cover',
            pixelated && '[image-rendering:pixelated]'
          )}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center text-sm text-fg-muted">
          {fallback ?? <ImageOff aria-hidden className="size-5" />}
        </div>
      )}
      {children}
    </div>
  )
}

/** A thin bar along the image's bottom edge; null value is indeterminate. */
function ImageProgress({ value, label }: { value: number | null; label: string }): ReactElement {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
      className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-surface-active"
    >
      <div
        className={cn(
          'h-full bg-accent-solid transition-[width] duration-base ease-standard',
          value == null && 'w-1/3 animate-pulse motion-reduce:animate-none'
        )}
        style={value == null ? undefined : { width: `${value}%` }}
      />
    </div>
  )
}

export interface BuildCardProps {
  name: string
  /** The current line of the build's Status block. */
  status?: ReactNode
  /** "Review 6 · Exported v4 · 2 h ago". */
  meta?: ReactNode
  /** The project's full isometric preview render. */
  image?: string | null
  /** A status badge in the image's top corner (card) or beside the title (row). */
  badge?: ReactNode
  /** A running job, 0–100, or null while its progress is unknown. Omit when nothing runs. */
  progress?: number | null
  progressLabel?: string
  onOpen: () => void
  /** The ⋯ menu button; it sits above the open target. */
  menu?: ReactNode
  /** `row` is the list view's horizontal project card with a 16:10 isometric thumbnail. */
  layout?: 'card' | 'row'
  className?: string
}

const NO_PREVIEW = (
  <>
    <ImageOff aria-hidden className="size-5" />
    <span>No preview yet</span>
  </>
)

/** A build in the Gallery: preview, name, status and meta; the whole card opens it. */
export function BuildCard({
  name,
  status,
  meta,
  image,
  badge,
  progress,
  progressLabel = `${name}: working`,
  onOpen,
  menu,
  layout = 'card',
  className,
  ...rest
}: BuildCardProps & Omit<ComponentProps<'article'>, keyof BuildCardProps>): ReactElement {
  const running = progress !== undefined
  if (layout === 'row')
    return (
      <article
        className={cn(
          'relative flex min-h-28 min-w-0 items-center gap-4 rounded-lg border border-border-default bg-surface-raised p-3 transition-[border-color,background-color] duration-fast ease-standard can-hover:hover:border-border-strong can-hover:hover:bg-surface-overlay',
          cardFocus,
          className
        )}
        {...rest}
      >
        <ImageMedia
          src={image}
          aspect="16 / 10"
          fit="contain"
          className="w-32 rounded-md border border-border-subtle sm:w-44"
          fallback={
            <>
              <ImageOff aria-hidden className="size-4" />
              <span className="text-xs">No preview</span>
            </>
          }
        >
          {running && <ImageProgress value={progress} label={progressLabel} />}
        </ImageMedia>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <button
              type="button"
              data-slot="card-open"
              onClick={onOpen}
              className={cn(
                stretched,
                'min-w-0 max-w-full truncate text-start text-md font-semibold text-fg'
              )}
            >
              {name}
            </button>
            {badge && <span className="shrink-0">{badge}</span>}
          </div>
          {status && <p className="line-clamp-2 text-sm text-fg-secondary">{status}</p>}
          {meta && <p className="truncate text-xs text-fg-muted">{meta}</p>}
        </div>
        {menu && <div className="relative z-[1] shrink-0 self-start">{menu}</div>}
      </article>
    )
  return (
    <article
      className={cn(
        'relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-border-default bg-surface-raised transition-[border-color] duration-fast ease-standard can-hover:hover:border-border-strong',
        cardFocus,
        className
      )}
      {...rest}
    >
      <ImageMedia src={image} aspect="16 / 10" fit="contain" fallback={NO_PREVIEW}>
        {badge && <span className="absolute start-2 top-2 flex">{badge}</span>}
        {running && <ImageProgress value={progress} label={progressLabel} />}
      </ImageMedia>
      <div className="flex min-w-0 items-start gap-2 p-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <button
            type="button"
            data-slot="card-open"
            onClick={onOpen}
            className={cn(stretched, 'truncate text-start text-base font-medium text-fg')}
          >
            {name}
          </button>
          {status && <p className="line-clamp-1 text-sm text-fg-secondary">{status}</p>}
          {meta && <p className="truncate text-xs text-fg-muted">{meta}</p>}
        </div>
        {menu && <div className="relative z-[1] -me-1 -mt-1 shrink-0">{menu}</div>}
      </div>
    </article>
  )
}

/** Block ids break at underscores, never mid-word, and are never cut off. */
export function BreakableId({ id }: { id: string }): ReactElement {
  const parts = id.split('_')
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && (
            <>
              _<wbr />
            </>
          )}
        </span>
      ))}
    </>
  )
}

/** One prefab from a sprite sheet: the cell, name and meta; clicking copies `copyText` (its assets/ id). */
export function PrefabTile({
  name,
  image,
  blocks,
  warnings = 0,
  tooltip,
  copyText,
  className
}: {
  name: string
  image?: string | null
  blocks?: number
  warnings?: number
  /** Top blocks and warning text. */
  tooltip?: ReactNode
  copyText: string
  className?: string
}): ReactElement {
  const { copied, copy } = useCopy()
  const tile = (
    <button
      type="button"
      onClick={() => copy(copyText)}
      aria-label={`${name}${blocks != null ? `, ${blocks} blocks` : ''}${warnings ? `, ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}` : ''}, click to copy its id`}
      className={cn(
        'focus-ring flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-lg border border-border-default bg-surface-raised text-start transition-[border-color,background-color] duration-fast ease-standard can-hover:hover:border-border-strong can-hover:hover:bg-surface-overlay',
        className
      )}
    >
      <ImageMedia src={image} aspect="1 / 1" pixelated>
        <span
          aria-live="polite"
          className={cn(
            'absolute end-1.5 top-1.5 flex transition-opacity duration-fast',
            copied ? 'opacity-100' : 'opacity-0'
          )}
        >
          {copied && (
            <Badge variant="success">
              <Check aria-hidden />
              Copied
            </Badge>
          )}
        </span>
      </ImageMedia>
      <span className="flex min-w-0 flex-col gap-0.5 p-2">
        <span className="font-mono text-xs text-fg">
          <BreakableId id={name} />
        </span>
        <span className="flex items-center gap-1 text-xs text-fg-muted">
          {blocks != null && (
            <span className="tabular-nums">{blocks.toLocaleString('en-US')} blocks</span>
          )}
          {warnings > 0 && (
            <span className="inline-flex items-center gap-1 text-warning-text">
              <TriangleAlert aria-hidden className="size-3.5" />
              {warnings} {warnings === 1 ? 'warning' : 'warnings'}
            </span>
          )}
        </span>
      </span>
    </button>
  )
  return tooltip ? <Tip label={tooltip}>{tile}</Tip> : tile
}

/**
 * An image reference (References): a visual-first 4:3 card that opens the lightbox. Empty notes stay
 * hidden at rest; filled notes show as a clickable caption below the image. Hover, focus and touch
 * reveal a compact action pill (Attach to chat, Add note, Delete). While copying (`adding`) it is a
 * skeleton card; a missing file keeps its card, note and Delete with "Image missing".
 */
export function RefTile({
  name,
  image,
  note,
  onNoteSave,
  onOpen,
  onDelete,
  attached = false,
  onToggleAttach,
  adding = false,
  missing = false,
  className
}: {
  /** The file name; the image's alt text and the open button's name. */
  name: string
  image?: string | null
  note: string
  onNoteSave: (note: string) => void | boolean | Promise<boolean | void>
  onOpen?: () => void
  onDelete?: () => void
  /** Highlighted and badged when queued for the next assistant message. */
  attached?: boolean
  onToggleAttach?: () => void
  adding?: boolean
  missing?: boolean
  className?: string
}): ReactElement {
  const [editing, setEditing] = useState(false)
  const trimmedNote = note.trim()

  if (adding)
    return (
      <div
        aria-busy="true"
        className={cn(
          'flex min-w-0 flex-col overflow-hidden rounded-lg border border-border-default bg-surface-raised',
          className
        )}
      >
        <Skeleton className="aspect-[4/3] w-full rounded-none" />
        <span className="truncate px-2.5 py-2 text-xs text-fg-muted">Adding {name}…</span>
      </div>
    )

  const hasActions = Boolean(onToggleAttach || onDelete || (!trimmedNote && !editing))
  return (
    <article
      className={cn(
        'group/ref relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-surface-raised transition-[border-color] duration-fast ease-standard',
        attached
          ? 'border-accent-solid ring-1 ring-accent-solid/30'
          : 'border-border-default can-hover:hover:border-border-strong',
        className
      )}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          disabled={!onOpen || missing}
          aria-label={`Open ${name}`}
          className="focus-ring block w-full cursor-zoom-in overflow-hidden disabled:cursor-default"
        >
          <ImageMedia
            src={missing ? null : image}
            alt=""
            aspect="4 / 3"
            fallback={
              <>
                <ImageOff aria-hidden className="size-5" />
                <span className="max-w-full truncate font-mono text-xs">{name}</span>
                <span className="text-xs">{missing ? 'Image missing' : 'No image'}</span>
              </>
            }
          />
        </button>
        {attached && (
          <Badge variant="default" className="pointer-events-none absolute start-2 top-2 shadow-sm">
            <Check aria-hidden />
            In chat
          </Badge>
        )}
        {hasActions && (
          <div className="absolute end-1.5 top-1.5 flex items-center gap-0.5 rounded-md border border-border-subtle bg-surface-overlay/95 p-0.5 opacity-0 shadow-sm backdrop-blur-xs transition-opacity duration-fast group-focus-within/ref:opacity-100 group-hover/ref:opacity-100 pointer-coarse:opacity-100">
            {onToggleAttach && (
              <IconAction
                label={attached ? `Remove ${name} from chat` : `Attach ${name} to chat`}
                tip={attached ? 'Remove from chat' : 'Attach to chat'}
                icon={attached ? Check : MessageSquarePlus}
                size="xs"
                className={attached ? 'text-accent-text' : undefined}
                onClick={onToggleAttach}
              />
            )}
            {!trimmedNote && !editing && (
              <IconAction
                label={`Add note for ${name}`}
                tip="Add note"
                icon={Pencil}
                size="xs"
                onClick={() => setEditing(true)}
              />
            )}
            {onDelete && (
              <IconAction
                label={`Delete ${name}`}
                tip="Delete"
                icon={Trash2}
                size="xs"
                onClick={onDelete}
              />
            )}
          </div>
        )}
      </div>
      {editing ? (
        <RefNoteEditor
          name={name}
          note={note}
          onDone={() => setEditing(false)}
          onSave={onNoteSave}
        />
      ) : trimmedNote ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit note for ${name}`}
          className="focus-ring w-full cursor-text border-t border-border-subtle px-2.5 py-2 text-start text-sm text-fg-secondary transition-colors duration-fast can-hover:hover:bg-surface-hover can-hover:hover:text-fg"
        >
          <span className="line-clamp-2">{trimmedNote}</span>
        </button>
      ) : null}
    </article>
  )
}

function RefNoteEditor({
  note,
  name,
  onSave,
  onDone
}: {
  note: string
  name: string
  onSave: (note: string) => void | boolean | Promise<boolean | void>
  onDone: () => void
}): ReactElement {
  const [text, setText] = useState(note)
  const cancelled = useRef(false)
  const saved = useRef(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const commit = async (): Promise<void> => {
    if (cancelled.current || saved.current) return
    saved.current = true
    const trimmed = text.trim()
    if (trimmed !== note.trim()) {
      const ok = await onSave(trimmed)
      if (ok === false) setText(note)
    }
    onDone()
  }

  return (
    <div className="border-t border-border-subtle p-1.5">
      <Textarea
        ref={ref}
        aria-label={`Note for ${name}`}
        placeholder="Add a note…"
        value={text}
        rows={2}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            cancelled.current = true
            onDone()
          } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void commit()
          }
        }}
        onBlur={() => void commit()}
        className="min-h-0 resize-none text-sm"
      />
    </div>
  )
}
