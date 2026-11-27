// The axis gizmo: the world axes as the camera sees them, in the stage's top-end corner. A drag on it orbits
// the camera, a click on a bubble looks from that side. It reports what it did through `onAnnounce` for a
// ViewerStatusToast. BuildViewer draws it over every 3D view.
import { useRef, useState, type PointerEvent, type ReactElement } from 'react'
import { cn } from '@/shared/lib/utils'
import type { ViewName } from '@/entities/viewer/model/look'
import {
  CAMERA_VIEWS,
  GIZMO_SIZE,
  GIZMO_TURN,
  axisClickView,
  projectAxes,
  type AxisEnd,
  type Orientation
} from '@/entities/viewer/model/axis-gizmo'

const SIZE = GIZMO_SIZE
const C = SIZE / 2
const TURN = GIZMO_TURN
const CLICK = 4 // pixels of travel under which a press is a click
const LABELS = new Map(CAMERA_VIEWS.map((item) => [item.view, item.label]))
const id = (end: AxisEnd): string => `${end.sign > 0 ? '+' : '-'}${end.axis}`
const STEP: Record<string, (i: number) => number> = {
  ArrowRight: (i) => (i + 1) % 6,
  ArrowDown: (i) => (i + 1) % 6,
  ArrowLeft: (i) => (i + 5) % 6,
  ArrowUp: (i) => (i + 5) % 6,
  Home: () => 0,
  End: () => 5
}

export function AxisGizmo({
  orientation,
  onViewChange,
  onOrbit,
  onAnnounce,
  className
}: {
  orientation: Orientation
  onViewChange: (view: ViewName) => void
  /** Orbit by these radians: `yaw` around the up axis, `pitch` toward the top. */
  onOrbit: (yaw: number, pitch: number) => void
  onAnnounce?: (text: string) => void
  className?: string
}): ReactElement {
  const ends = projectAxes(orientation)
  const svg = useRef<SVGSVGElement>(null)
  const [rover, setRover] = useState('+x')
  const press = useRef<{ x: number; y: number; travel: number; end: AxisEnd | null } | null>(null)
  const choose = (end: AxisEnd): void => {
    const view = axisClickView(end)
    onAnnounce?.(LABELS.get(view)!)
    onViewChange(view)
  }
  const endAt = (target: EventTarget): AxisEnd | null => {
    const key = (target as Element).closest?.('[data-end]')?.getAttribute('data-end')
    return ends.find((e) => id(e) === key) ?? null
  }

  const down = (event: PointerEvent<SVGSVGElement>): void => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    press.current = { x: event.clientX, y: event.clientY, travel: 0, end: endAt(event.target) }
  }
  const move = (event: PointerEvent<SVGSVGElement>): void => {
    const p = press.current
    if (!p) return
    const [dx, dy] = [event.clientX - p.x, event.clientY - p.y]
    p.travel += Math.abs(dx) + Math.abs(dy)
    p.x = event.clientX
    p.y = event.clientY
    if (p.travel >= CLICK) onOrbit(dx * TURN, dy * TURN)
  }
  const up = (): void => {
    const p = press.current
    press.current = null
    if (p?.end && p.travel < CLICK) choose(p.end)
  }

  // back to front, each positive end's line under its bubble
  const drawn = [...ends].sort((a, b) => a.depth - b.depth)
  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="group"
      aria-label="Camera axes"
      className={cn(
        'axis-gizmo pointer-events-auto absolute top-(--viewer-inset) right-(--viewer-inset) z-floating block size-(--viewer-gizmo-size) touch-none',
        className
      )}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => (press.current = null)}
    >
      <circle className="axis-gizmo-backdrop" cx={C} cy={C} r={C - 1} />
      {drawn.map((end) => {
        const r = end.sign > 0 ? 9.5 : 7
        const colour = `var(--axis-${end.axis})`
        return (
          <g key={id(end)}>
            {end.sign > 0 && (
              <line
                x1={C}
                y1={C}
                x2={C + end.x}
                y2={C + end.y}
                style={{ stroke: colour }}
                strokeWidth={2}
                strokeLinecap="round"
                aria-hidden="true"
              />
            )}
            <g
              role="button"
              data-end={id(end)}
              tabIndex={id(end) === rover ? 0 : -1}
              aria-label={end.label}
              className={cn('axis-gizmo-end', end.sign < 0 && 'axis-gizmo-minus')}
              transform={`translate(${C + end.x} ${C + end.y})`}
              onFocus={() => setRover(id(end))}
              // a click from assistive technology; pointer clicks end in `up`
              onClick={(event) => event.detail === 0 && choose(end)}
              onKeyDown={(event) => {
                const step = STEP[event.key]
                if (step) {
                  event.preventDefault()
                  const next = id(ends[step(ends.indexOf(end))])
                  svg.current?.querySelector<SVGElement>(`[data-end="${next}"]`)?.focus()
                } else if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  choose(end)
                }
              }}
            >
              <title>{end.label}</title>
              <circle className="axis-gizmo-ring" r={r + 3} />
              <circle
                className="axis-gizmo-dot"
                r={r}
                style={{ fill: colour, stroke: colour }}
                strokeWidth={end.sign > 0 ? 0 : 1}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                className="pointer-events-none fill-fg-inverse font-medium"
              >
                {end.axis.toUpperCase()}
              </text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}
