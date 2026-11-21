import { Quaternion, Vector3 } from 'three'
import type { ViewName } from './look'

export type Orientation = [number, number, number, number]

export const CAMERA_VIEWS: { view: ViewName; label: string; group: string }[] = [
  { view: 'iso_se', label: 'Southeast', group: 'Corners' },
  { view: 'iso_ne', label: 'Northeast', group: 'Corners' },
  { view: 'iso_nw', label: 'Northwest', group: 'Corners' },
  { view: 'iso_sw', label: 'Southwest', group: 'Corners' },
  { view: 'under_se', label: 'Southeast, from below', group: 'Corners' },
  { view: 'under_ne', label: 'Northeast, from below', group: 'Corners' },
  { view: 'under_nw', label: 'Northwest, from below', group: 'Corners' },
  { view: 'under_sw', label: 'Southwest, from below', group: 'Corners' },
  { view: 'top', label: 'Top', group: 'Sides' },
  { view: 'bottom', label: 'Bottom', group: 'Sides' },
  { view: 'elev_s', label: 'Front (south)', group: 'Sides' },
  { view: 'elev_e', label: 'Right (east)', group: 'Sides' },
  { view: 'elev_n', label: 'Back (north)', group: 'Sides' },
  { view: 'elev_w', label: 'Left (west)', group: 'Sides' },
  { view: 'top_s', label: 'Top front edge', group: 'Edges' },
  { view: 'top_e', label: 'Top right edge', group: 'Edges' },
  { view: 'top_n', label: 'Top back edge', group: 'Edges' },
  { view: 'top_w', label: 'Top left edge', group: 'Edges' },
  { view: 'elev_se', label: 'Front right edge', group: 'Edges' },
  { view: 'elev_ne', label: 'Back right edge', group: 'Edges' },
  { view: 'elev_nw', label: 'Back left edge', group: 'Edges' },
  { view: 'elev_sw', label: 'Front left edge', group: 'Edges' },
  { view: 'bottom_s', label: 'Bottom front edge', group: 'Edges' },
  { view: 'bottom_e', label: 'Bottom right edge', group: 'Edges' },
  { view: 'bottom_n', label: 'Bottom back edge', group: 'Edges' },
  { view: 'bottom_w', label: 'Bottom left edge', group: 'Edges' },
  { view: 'orbit', label: 'Free orbit', group: '' }
]

export type Axis = 'x' | 'y' | 'z'
/** One end of an axis on the gizmo: x and y from its centre in SVG units, depth toward the camera (-1..1). */
export interface AxisEnd {
  axis: Axis
  sign: 1 | -1
  view: ViewName
  label: string
  x: number
  y: number
  depth: number
}

// keyboard order: the positive ends, then the negative ones
const ENDS: [Axis, 1 | -1, ViewName, string][] = [
  ['x', 1, 'elev_e', 'Look from +X (east)'],
  ['y', 1, 'top', 'Look from +Y (top)'],
  ['z', 1, 'elev_s', 'Look from +Z (south)'],
  ['x', -1, 'elev_w', 'Look from −X (west)'],
  ['y', -1, 'bottom', 'Look from −Y (bottom)'],
  ['z', -1, 'elev_n', 'Look from −Z (north)']
]
const UNIT: Record<Axis, [number, number, number]> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }

/** The six axis ends as the camera sees them, in keyboard order; draw them sorted by depth. */
export function projectAxes(orientation: Orientation, radius = 32): AxisEnd[] {
  const inverse = new Quaternion(...orientation).normalize().invert()
  return ENDS.map(([axis, sign, view, label]) => {
    const p = new Vector3(...UNIT[axis]).multiplyScalar(sign).applyQuaternion(inverse)
    return { axis, sign, view, label, x: p.x * radius, y: -p.y * radius, depth: p.z }
  })
}

/** A click on an end looks from that side, or from the opposite one when the camera already does. */
export function axisClickView(end: AxisEnd): ViewName {
  if (end.depth < 0.98) return end.view
  return ENDS.find(([axis, sign]) => axis === end.axis && sign !== end.sign)![2]
}
