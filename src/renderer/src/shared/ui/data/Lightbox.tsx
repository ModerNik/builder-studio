// The lightbox: one image large on the scrim, with its name, meta and note, previous and next, and the
// screen's actions (Delete…). A modal Dialog: Esc closes and focus returns to the tile that opened it.
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/shared/ui/primitives/dialog'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { ImageMedia } from './ImageCards'

export interface LightboxItem {
  src: string
  /** The file name, the dialog's title. */
  name: string
  /** "1280 × 720 · dropped 2026-11-05". */
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
  /** Buttons for the shown item, e.g. Delete… */
  actions?: (item: LightboxItem) => ReactNode
  /** Makes the note editable, saved on blur or when the image changes or the dialog closes. Without it
   *  the note is read-only. */
  onNoteChange?: (note: string, index: number) => void
}): ReactElement | null {
  const item = items[index]
  if (!item) return null
  const n = items.length
  const go = (step: number): void => onIndexChange((index + step + n) % n)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="full"
        className="h-[calc(100dvh-2rem)] gap-3 p-3 sm:p-4"
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
              {index + 1} of {n}
            </span>
          )}
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-surface-viewer">
          <ImageMedia
            key={item.src}
            src={item.src}
            alt={item.note || item.name}
            aspect="auto"
            className="size-full [&_img]:object-contain"
          />
          {n > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Previous image"
                aria-keyshortcuts="ArrowLeft"
                onClick={() => go(-1)}
                className="absolute start-2 top-1/2 -translate-y-1/2 shadow-sm"
              >
                <ChevronLeft className="rtl:rotate-180" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Next image"
                aria-keyshortcuts="ArrowRight"
                onClick={() => go(1)}
                className="absolute end-2 top-1/2 -translate-y-1/2 shadow-sm"
              >
                <ChevronRight className="rtl:rotate-180" />
              </Button>
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {onNoteChange && (
              <LightboxNote
                key={item.src}
                note={item.note ?? ''}
                name={item.name}
                onSave={(note) => onNoteChange(note, index)}
              />
            )}
            <DialogDescription asChild>
              <div className="flex flex-col gap-0.5">
                {!onNoteChange && item.note && <p className="text-base text-fg">{item.note}</p>}
                {item.meta && <p className="text-sm text-fg-muted">{item.meta}</p>}
              </div>
            </DialogDescription>
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions(item)}</div>}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LightboxNote({
  note,
  name,
  onSave
}: {
  note: string
  name: string
  onSave: (note: string) => void
}): ReactElement {
  const [text, setText] = useState(note)
  const pending = useRef<string | null>(null)
  const save = useRef(onSave)
  useEffect(() => {
    save.current = onSave
  })
  // Esc or the arrow buttons can unmount the field before it blurs: keep the edit
  useEffect(
    () => () => {
      if (pending.current !== null) save.current(pending.current)
    },
    []
  )
  const flush = (): void => {
    if (pending.current === null) return
    onSave(pending.current)
    pending.current = null
  }
  return (
    <Textarea
      aria-label={`Note for ${name}`}
      placeholder="Add a note"
      value={text}
      rows={1}
      onChange={(e) => {
        setText(e.target.value)
        pending.current = e.target.value === note ? null : e.target.value
      }}
      onBlur={flush}
      className="min-h-(--density-control) border-transparent bg-transparent text-base can-hover:hover:border-border-default focus-visible:border-border-strong focus-visible:bg-surface-sunken"
    />
  )
}
