// The drop overlay: a dashed verdigris ring over a drop target while files or links are dragged over it,
// naming what will be added and where it goes. Place it inside a `relative` target; it never takes the
// pointer, so the drop lands on the target underneath.
import type { ReactElement } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export function DropOverlay({
  active,
  label,
  detail,
  className
}: {
  active: boolean
  /** "Drop to add 3 images". */
  label: string
  /** Where they go: "They are copied into refs/ and listed in index.json." */
  detail?: string
  className?: string
}): ReactElement | null {
  if (!active) return null
  return (
    <div
      aria-hidden="true"
      data-state="open"
      className={cn(
        'motion-fade pointer-events-none absolute inset-1 z-[2] flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-accent-solid bg-surface-panel/90 p-4 text-center',
        className
      )}
    >
      <span className="flex items-center gap-2 text-base font-medium text-accent-text">
        <Upload aria-hidden className="size-4" />
        {label}
      </span>
      {detail && <span className="text-sm text-fg-secondary">{detail}</span>}
    </div>
  )
}
