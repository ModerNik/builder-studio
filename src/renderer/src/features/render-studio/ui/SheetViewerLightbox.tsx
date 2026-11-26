// Zoomable lightbox for agent-pushed render sheets (MCP `sheet` / embedded `show_sheet`).
import { useState, type ReactElement } from 'react'
import { Copy, Image } from 'lucide-react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/shared/ui/primitives/dialog'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { copyUrlImageToClipboard, useSheetViewerState } from '../model/useRenderExport'

export function SheetViewerLightbox({
  open,
  onOpenChange,
  title,
  src,
  onCopy
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  src: string | null
  onCopy?: () => void
}): ReactElement {
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="full"
        className="h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] gap-3 p-3 sm:max-w-[calc(100vw-2rem)] sm:p-4"
      >
        <div className="flex min-w-0 items-center justify-between gap-3 pe-10">
          <div className="min-w-0">
            <DialogTitle className="truncate font-mono text-base">{title}</DialogTitle>
            <DialogDescription className="sr-only">
              Zoomable render sheet image shown by the assistant.
            </DialogDescription>
          </div>
          {onCopy && src && failed !== src && (
            <Button size="sm" variant="outline" onClick={onCopy}>
              <Copy aria-hidden="true" />
              Copy image
            </Button>
          )}
        </div>
        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-md bg-surface-viewer">
          {!src || failed === src ? (
            <div className="m-auto">
              <EmptyState icon={Image} title="Render sheet could not be loaded">
                The image file may have been removed or moved from out/.
              </EmptyState>
            </div>
          ) : (
            <TransformWrapper
              key={src}
              minScale={0.1}
              maxScale={16}
              limitToBounds={false}
              centerOnInit
              wheel={{ step: 0.0015 }}
            >
              <TransformComponent wrapperClass="!h-full !w-full bg-surface-viewer" contentClass="">
                <img
                  src={src}
                  alt={title}
                  onError={() => setFailed(src)}
                  style={{ imageRendering: 'pixelated' }}
                  draggable={false}
                />
              </TransformComponent>
            </TransformWrapper>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Mounted once in Shell so agent `show_sheet` / MCP `sheet` calls open cleanly without a Workspace tab. */
export function SheetViewerHost(): ReactElement | null {
  const { open, item, src, close } = useSheetViewerState()
  if (!item) return null
  const fileName = item.path.split('/').pop() ?? item.path
  return (
    <SheetViewerLightbox
      open={open}
      onOpenChange={(next) => !next && close()}
      title={`${item.build} · ${fileName}`}
      src={src}
      onCopy={
        src
          ? () => void copyUrlImageToClipboard(src).catch((e) => toast.error(String(e)))
          : undefined
      }
    />
  )
}
