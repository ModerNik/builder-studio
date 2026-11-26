import { useState, type ReactElement } from 'react'
import { DropOverlay } from '@/shared/ui/feedback/DropOverlay'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Feedback', title: 'Drop overlay' }

export default function DropOverlaySection(): ReactElement {
  const [over, setOver] = useState<number | null>(null)
  const [dropped, setDropped] = useState<string[]>([])
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="live: drag files over the box" className="w-full max-w-lg">
          <div
            className="relative flex h-48 w-full items-center justify-center rounded-lg border border-border-default bg-surface-raised p-4 text-center text-sm text-fg-secondary"
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('Files')) return
              e.preventDefault()
              setOver(e.dataTransfer.items.length)
            }}
            onDragLeave={(e) => e.currentTarget === e.target && setOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(null)
              setDropped([...e.dataTransfer.files].map((f) => f.name))
            }}
          >
            {dropped.length ? `Dropped: ${dropped.join(', ')}` : 'Drop images here'}
            <DropOverlay
              active={over !== null}
              label={`Drop to add ${over ?? 0} ${over === 1 ? 'image' : 'images'}`}
              detail="Saved with this build."
            />
          </div>
        </Specimen>
        <Specimen label="static: three images over the board" className="w-full max-w-lg">
          <div className="relative h-48 w-full rounded-lg border border-border-default bg-surface-raised">
            <DropOverlay active label="Drop to add 3 images" detail="Saved with this build." />
          </div>
        </Specimen>
        <Specimen label="no detail line (the composer)" className="w-full max-w-lg">
          <div className="relative h-24 w-full rounded-lg border border-border-default bg-surface-panel">
            <DropOverlay active label="Drop files to attach (up to 10)" />
          </div>
        </Specimen>
      </Specimens>
      <Guidance>
        Shown only while something is dragged over the target, inset 4px inside it. It never takes
        the pointer, so the drop lands on the target. Reused by the References board, the composer
        and any screen that takes dropped files.
      </Guidance>
    </div>
  )
}
