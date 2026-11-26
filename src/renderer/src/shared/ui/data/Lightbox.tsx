// The lightbox: one image large on the scrim with scroll-wheel zoom and pan, natural dimensions,
// previous and next, an optional inline note, and screen actions. A modal Dialog: Esc closes and
// focus returns to the tile that opened it.
import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject
} from 'react'
import { ChevronLeft, ChevronRight, ImageOff, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { Button } from '@/shared/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/shared/ui/primitives/dialog'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { IconAction } from '@/shared/ui/common/Tip'

export interface LightboxItem {
  /** Stable id (used to skip stale unmount note flushes if the item was deleted). */
  id?: string
  src: string
  /** The file name, the dialog's title. */
  name: string
  /** Optional metadata, e.g. "Nov 5". Loaded image dimensions are prepended automatically. */
  meta?: string
  note?: string
}

export function Lightbox({
  items,
  index,
  onIndexChange,
  open,
  onOpenChange,
  actions,
  onNoteChange
}: {
  items: LightboxItem[]
  index: number
  onIndexChange: (index: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Buttons for the shown item, e.g. Copy, Attach to chat, Delete… */
  actions?: (item: LightboxItem, index: number) => ReactNode
  /** Makes the note editable, saved on blur or when the image changes or the dialog closes. Without it
   *  the note is read-only. */
  onNoteChange?: (note: string, index: number) => void
}): ReactElement | null {
  const n = items.length
  const safeIndex = n > 0 ? Math.max(0, Math.min(index, n - 1)) : 0
  const item = items[safeIndex]
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  })
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [dims, setDims] = useState<{ src: string; w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState<{ src: string; scale: number } | null>(null)

  if (!item) return null
  const scale = zoom && zoom.src === item.src ? zoom.scale : 1
  const go = (step: number): void => onIndexChange((safeIndex + step + n) % n)
  const broken = failedSrc === item.src
  const loadedDims = dims && dims.src === item.src ? `${dims.w} × ${dims.h}` : null
  const metaLine = [loadedDims, item.meta].filter(Boolean).join(' · ')
  const itemKey = item.id ?? item.src

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="full"
        className="h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] gap-3 p-3 sm:max-w-[calc(100vw-2rem)] sm:p-4"
        onKeyDown={(e) => {
          if (n < 2 || (e.target as HTMLElement).closest('input, textarea')) return
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault()
            // reading order: in right-to-left the right arrow goes back
            const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
            go((e.key === 'ArrowRight') !== rtl ? 1 : -1)
          }
        }}
      >
        <div className="flex min-w-0 items-baseline gap-3 pe-10">
          <DialogTitle className="min-w-0 truncate font-mono text-base">{item.name}</DialogTitle>
          {n > 1 && (
            <span className="shrink-0 text-sm text-fg-muted tabular-nums">
              {safeIndex + 1} of {n}
            </span>
          )}
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-surface-viewer">
          {broken ? (
            <div className="flex flex-col items-center justify-center gap-1.5 p-4 text-center text-sm text-fg-muted">
              <ImageOff aria-hidden className="size-6" />
              <span>Image could not be loaded</span>
            </div>
          ) : (
            <TransformWrapper
              key={item.src}
              minScale={0.5}
              maxScale={8}
              limitToBounds={false}
              centerOnInit
              doubleClick={{ mode: 'toggle', step: 2 }}
              wheel={{ step: 0.12 }}
              onTransform={(_ref, state) => setZoom({ src: item.src, scale: state.scale })}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <TransformComponent
                    wrapperClass="!h-full !w-full"
                    contentClass="!flex !h-full !w-full items-center justify-center"
                  >
                    <img
                      src={item.src}
                      alt={item.note || item.name}
                      draggable={false}
                      onError={() => setFailedSrc(item.src)}
                      onLoad={(e) =>
                        setDims({
                          src: item.src,
                          w: e.currentTarget.naturalWidth,
                          h: e.currentTarget.naturalHeight
                        })
                      }
                      className="max-h-full max-w-full object-contain select-none"
                    />
                  </TransformComponent>
                  <div className="absolute end-2 bottom-2 z-1 flex items-center gap-0.5 rounded-md border border-border-subtle bg-surface-overlay/90 px-1 py-0.5 shadow-sm backdrop-blur-xs">
                    <IconAction
                      icon={ZoomOut}
                      label="Zoom out"
                      size="xs"
                      onClick={() => zoomOut(0.35)}
                    />
                    <span className="min-w-11 text-center font-mono text-xs text-fg-secondary tabular-nums">
                      {Math.round(scale * 100)}%
                    </span>
                    <IconAction
                      icon={ZoomIn}
                      label="Zoom in"
                      size="xs"
                      onClick={() => zoomIn(0.35)}
                    />
                    <IconAction
                      icon={RotateCcw}
                      label="Reset zoom"
                      size="xs"
                      disabled={Math.abs(scale - 1) < 0.02}
                      onClick={() => resetTransform()}
                    />
                  </div>
                </>
              )}
            </TransformWrapper>
          )}
          {n > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Previous image"
                aria-keyshortcuts="ArrowLeft"
                onClick={() => go(-1)}
                className="absolute start-2 top-1/2 z-1 -translate-y-1/2 shadow-sm"
              >
                <ChevronLeft className="rtl:rotate-180" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Next image"
                aria-keyshortcuts="ArrowRight"
                onClick={() => go(1)}
                className="absolute end-2 top-1/2 z-1 -translate-y-1/2 shadow-sm"
              >
                <ChevronRight className="rtl:rotate-180" />
              </Button>
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {onNoteChange && (
              <LightboxNote
                key={itemKey}
                itemKey={itemKey}
                note={item.note ?? ''}
                name={item.name}
                itemsRef={itemsRef}
                onSave={(note) => onNoteChange(note, safeIndex)}
              />
            )}
            <DialogDescription asChild>
              <div className="flex flex-col gap-0.5">
                {!onNoteChange && item.note && <p className="text-base text-fg">{item.note}</p>}
                {metaLine && <p className="text-sm text-fg-muted tabular-nums">{metaLine}</p>}
              </div>
            </DialogDescription>
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap gap-2">{actions(item, safeIndex)}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LightboxNote({
  itemKey,
  note,
  name,
  itemsRef,
  onSave
}: {
  itemKey: string
  note: string
  name: string
  itemsRef: RefObject<LightboxItem[]>
  onSave: (note: string) => void
}): ReactElement {
  const [text, setText] = useState(note)
  const pending = useRef<string | null>(null)
  const save = useRef(onSave)
  useEffect(() => {
    save.current = onSave
  })
  // Keep local text synced if the note updates from elsewhere while the same image stays open
  useEffect(() => {
    if (pending.current === null) setText(note)
  }, [note])
  // Esc or the arrow buttons can unmount the field before it blurs: keep the edit unless the item was deleted
  useEffect(
    () => () => {
      if (pending.current === null) return
      const stillExists = itemsRef.current.some((it) => (it.id ?? it.src) === itemKey)
      if (stillExists) save.current(pending.current)
    },
    [itemKey, itemsRef]
  )
  const flush = (): void => {
    if (pending.current === null) return
    const next = pending.current
    pending.current = null
    if (next.trim() !== note.trim()) onSave(next)
    else setText(note)
  }
  return (
    <Textarea
      aria-label={`Note for ${name}`}
      placeholder="Add a note…"
      value={text}
      rows={1}
      onChange={(e) => {
        setText(e.target.value)
        pending.current = e.target.value.trim() === note.trim() ? null : e.target.value
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          pending.current = null
          setText(note)
          e.currentTarget.blur()
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      onBlur={flush}
      className="min-h-(--density-control) border-transparent bg-transparent text-base can-hover:border-border-default focus-visible:border-border-strong focus-visible:bg-surface-sunken"
    />
  )
}
