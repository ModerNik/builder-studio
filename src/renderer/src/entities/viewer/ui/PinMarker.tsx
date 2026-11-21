// A numbered review pin over the 3D view or a preview sheet, with its note in a popover.
// Open pins are verdigris, the selected pin is inverse, resolved pins are neutral (pin-* tokens).
import type { ReactElement, ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover'
import { cn } from '@/shared/lib/utils'
import { focusRing } from '@/shared/ui/common/styles'

export type PinState = 'open' | 'selected' | 'resolved'

const FILL: Record<PinState, string> = {
  open: 'bg-pin-open text-pin-open-text ring-pin-open-ring',
  selected: 'bg-pin-selected text-pin-selected-text ring-pin-selected-ring',
  resolved: 'bg-pin-resolved text-pin-resolved-text ring-pin-resolved-ring'
}

export function PinMarker({
  n,
  x,
  y,
  state,
  open,
  onOpenChange,
  where,
  note,
  actions
}: {
  n: number
  /** Position on the stage, as CSS lengths (e.g. `42%`). */
  x: string
  y: string
  state: PinState
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** What it is pinned to: version, coordinates, block. */
  where: string
  note: ReactNode
  /** Resolve, Delete and the like. */
  actions?: ReactNode
}): ReactElement {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Pin ${n}${state === 'resolved' ? ', resolved' : ''}: ${where}`}
          style={{ left: x, top: y }}
          className={cn(
            'absolute z-floating grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-mono text-xs font-semibold tabular-nums ring-2 shadow-md',
            // 44px hit area on touch without a bigger mark
            'after:absolute after:-inset-2.5 pointer-fine:after:-inset-1',
            'transition-colors duration-fast ease-standard',
            FILL[state],
            focusRing
          )}
        >
          {n}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-64 space-y-2 p-3">
        <p className="font-mono text-xs text-fg-muted">
          {n} · {where}
        </p>
        <div>{note}</div>
        {actions && <div className="flex justify-end gap-2">{actions}</div>}
      </PopoverContent>
    </Popover>
  )
}
