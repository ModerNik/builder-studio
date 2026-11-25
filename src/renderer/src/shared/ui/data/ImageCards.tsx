// Image cards: a preview on viewer grey with text under it. BuildCard (Gallery; with a row variant for the
// list view), PrefabTile (Labs prefab sheets) and RefTile (References images). Each takes data and
// callbacks; copying, opening and saving are the screen's.
import { useState, type ComponentProps, type ReactElement, type ReactNode } from 'react'
import { Check, ImageOff, Trash2, TriangleAlert } from 'lucide-react'
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
 * An image reference (References): an even 4:3 tile that opens the lightbox, with its editable note
 * under it (saved on blur) and Delete on hover and focus, always shown on touch. While it is copied in
 * (`adding`) it is a skeleton; a file gone from refs/ keeps its tile, note and Delete.
 */
export function RefTile({
  name,
  image,
  note,
  onNoteSave,
  onOpen,
  onDelete,
  adding = false,
  missing = false,
  className
}: {
  /** The file name; the image's alt text and the open button's name. */
  name: string
  image?: string | null
  note: string
  onNoteSave: (note: string) => void
  onOpen?: () => void
  onDelete?: () => void
  adding?: boolean
  missing?: boolean
  className?: string
}): ReactElement {
  if (adding)
    return (
      <div aria-busy="true" className={cn('flex min-w-0 flex-col gap-2', className)}>
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
        <span className="text-sm text-fg-muted">Adding {name}…</span>
      </div>
    )
  return (
    <div className={cn('group/ref flex min-w-0 flex-col gap-2', className)}>
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          disabled={!onOpen || missing}
          aria-label={`Open ${name}`}
          className="focus-ring block w-full cursor-zoom-in overflow-hidden rounded-lg border border-border-default transition-[border-color] duration-fast ease-standard can-hover:hover:border-border-strong disabled:cursor-default"
        >
          <ImageMedia
            src={missing ? null : image}
            alt=""
            aspect="4 / 3"
            fallback={
              <>
                <ImageOff aria-hidden className="size-5" />
                <span className="font-mono text-xs">{name}</span>
                <span>{missing ? 'Missing from refs/' : 'No image'}</span>
              </>
            }
          />
        </button>
        {onDelete && (
          <span className="absolute end-1.5 top-1.5 rounded-md bg-surface-overlay opacity-0 shadow-sm transition-opacity duration-fast group-focus-within/ref:opacity-100 group-hover/ref:opacity-100 pointer-coarse:opacity-100">
            <IconAction label={`Delete ${name}`} icon={Trash2} onClick={onDelete} />
          </span>
        )}
      </div>
      <NoteField key={note} note={note} name={name} onSave={onNoteSave} />
    </div>
  )
}

function NoteField({
  note,
  name,
  onSave
}: {
  note: string
  name: string
  onSave: (note: string) => void
}): ReactElement {
  const [text, setText] = useState(note)
  return (
    <Textarea
      aria-label={`Note for ${name}`}
      placeholder="No note yet"
      value={text}
      rows={1}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== note && onSave(text)}
      className="min-h-(--density-control) border-transparent bg-transparent text-sm can-hover:hover:border-border-default focus-visible:border-border-strong focus-visible:bg-surface-sunken"
    />
  )
}
