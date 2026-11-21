// Build location map: a pixelated top-down map; drag to draw a box in world columns, hover for the
// coordinates under the pointer. Keyboard: Enter starts a box in the middle, arrows move it (Shift: 16
// columns), Alt + arrows resize it, Delete clears it.
import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode
} from 'react'
import { cn } from '@/shared/lib/utils'
import { norm, type Box } from '@/entities/site/model/site'
import { focusRing } from '@/shared/ui/common/styles'
import {
  boxSize,
  cellAt,
  centreBox,
  nudgeBox,
  resizeBox,
  withMargin,
  type MapFrame
} from '../model/map-selection'
import { ViewerOverlay } from '@/entities/viewer/ui/ViewerOverlay'

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

export function MapSelectionCanvas({
  map,
  src,
  children,
  box,
  onBoxChange,
  heightAt,
  margin = 0,
  label = 'World map',
  className
}: {
  map: MapFrame
  /** The rendered map image (one pixel per column); or draw it yourself as `children`. */
  src?: string
  children?: ReactNode
  box: Box | null
  onBoxChange: (box: Box | null) => void
  /** Top block y of a column, for the hover readout. */
  heightAt?: (x: number, z: number) => number | null
  /** Clear columns kept around the box, drawn as a dashed outline (clipped to the map). */
  margin?: number
  label?: string
  className?: string
}): ReactElement {
  const surface = useRef<HTMLDivElement>(null)
  const drag = useRef<[number, number] | null>(null)
  const [hover, setHover] = useState<[number, number] | null>(null)
  const help = useId()

  const at = (e: PointerEvent): [number, number] | null => {
    const r = surface.current!.getBoundingClientRect() // ratios hold under CSS transforms (scaled previews)
    return cellAt(map, e.clientX - r.left, e.clientY - r.top, r.width, r.height)
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return
    const c = at(e)
    if (!c) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = c
    onBoxChange([c[0], c[1], c[0], c[1]])
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    const c = at(e)
    setHover(c)
    if (drag.current && c) onBoxChange([drag.current[0], drag.current[1], c[0], c[1]])
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const arrow = ARROWS[e.key]
    if (e.key === 'Enter' && !box) onBoxChange(centreBox(map, 16))
    else if ((e.key === 'Delete' || e.key === 'Backspace') && box) onBoxChange(null)
    else if (arrow && box) {
      const step = e.shiftKey ? 16 : 1
      onBoxChange((e.altKey ? resizeBox : nudgeBox)(map, box, arrow[0] * step, arrow[1] * step))
    } else return
    e.preventDefault()
  }

  const b = box && norm(box)
  const pct = (v: number, axis: 0 | 1): string =>
    `${((v - map.origin[axis]) / map.size[axis]) * 100}%`
  const y = hover && heightAt?.(hover[0], hover[1])
  const size = b && boxSize(b)
  const described = b
    ? `Box from ${b[0]}, ${b[1]} to ${b[2]}, ${b[3]}: ${size![0]} by ${size![1]} columns${margin ? `, with a ${margin}-column margin` : ''}`
    : 'No box'
  const m: Box | null = b && margin > 0 ? withMargin(map, b, margin) : null
  const rect = (r: Box): CSSProperties => {
    const [w, h] = boxSize(r)
    return {
      left: pct(r[0], 0),
      top: pct(r[1], 1),
      width: `${(w / map.size[0]) * 100}%`,
      height: `${(h / map.size[1]) * 100}%`
    }
  }

  return (
    <div
      className={cn(
        'viewer-stage viewer-map relative flex h-full w-full items-center justify-center overflow-hidden bg-surface-viewer p-3',
        className
      )}
    >
      <div
        ref={surface}
        role="application"
        aria-label={label}
        aria-describedby={help}
        aria-roledescription="map"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={() => setHover(null)}
        // the largest box of the map's aspect that fits the stage
        style={{
          aspectRatio: `${map.size[0]} / ${map.size[1]}`,
          width: `min(100cqw, 100cqh * ${map.size[0] / map.size[1]})`
        }}
        className={cn('relative cursor-crosshair touch-none bg-surface-sunken', focusRing)}
      >
        {src ? (
          <img src={src} alt="" draggable={false} className="absolute inset-0 size-full" />
        ) : (
          children
        )}
        {m && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute border-(length:--border-strong-width) border-dashed border-accent-solid"
            style={rect(m)}
          />
        )}
        {b && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute border-(length:--border-strong-width) border-accent-solid bg-accent-solid/15"
            style={rect(b)}
          />
        )}
      </div>
      <p id={help} className="sr-only">
        Drag to draw a box. Enter starts a box in the middle, arrow keys move it, Shift moves 16
        columns, Alt and arrow keys resize it, Delete clears it.
      </p>
      <ViewerOverlay className="pointer-events-none absolute bottom-(--viewer-inset) left-(--viewer-inset) flex flex-col gap-0.5 px-2.5 py-1.5 font-mono text-xs tabular-nums">
        <span className="text-fg-secondary">
          {hover
            ? `x ${hover[0]}  z ${hover[1]}${y != null ? `  y ${y}` : ''}`
            : 'Point at the map'}
        </span>
        <span className="text-fg">
          {b
            ? `${b[0]} ${b[1]} to ${b[2]} ${b[3]} · ${size![0]} × ${size![1]}${margin ? ` · margin ${margin}` : ''}`
            : 'Drag to draw a box'}
        </span>
        <span className="sr-only" aria-live="polite">
          {described}
        </span>
      </ViewerOverlay>
    </div>
  )
}
