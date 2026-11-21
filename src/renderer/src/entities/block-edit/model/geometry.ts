// Cell geometry for the drawing tools: brush stamps and the points a drag passes through.
import type { Cell } from '@/entities/viewer/model/inspection'

export type BrushShape = 'sphere' | 'cube' | 'cylinder'

export const cellKey = (c: readonly number[]): string => c.join(',')

/** The cells of a brush `size` blocks across, centred on `at` (an even size leans toward plus). */
export function stamp(shape: BrushShape, size: number, at: Cell): Cell[] {
  const lo = -Math.floor((size - 1) / 2)
  const mid = lo + (size - 1) / 2
  const r2 = (size / 2) ** 2
  const out: Cell[] = []
  for (let y = lo; y < lo + size; y++)
    for (let z = lo; z < lo + size; z++)
      for (let x = lo; x < lo + size; x++) {
        const flat = (x - mid) ** 2 + (z - mid) ** 2
        if (shape === 'sphere' && flat + (y - mid) ** 2 > r2) continue
        if (shape === 'cylinder' && flat > r2) continue
        out.push([at[0] + x, at[1] + y, at[2] + z])
      }
  return out
}

/** The cells from `a` (left out) to `b` (included), at most `step` apart, so a fast drag leaves no gaps. */
export function along(a: Cell, b: Cell, step: number): Cell[] {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / Math.max(step, 1))
  return Array.from(
    { length: n },
    (_, i) => a.map((v, k) => Math.round(v + ((b[k] - v) * (i + 1)) / n)) as Cell
  )
}

/** The points from `a` (left out) toward `b` exactly `spacing` apart, none past `b`: a drag's next stamps. */
export function every(a: Cell, b: Cell, spacing: number): Cell[] {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  return Array.from(
    { length: Math.floor(d / spacing) },
    (_, i) => a.map((v, k) => Math.round(v + ((b[k] - v) * spacing * (i + 1)) / d)) as Cell
  )
}

export type SolidKind = 'box' | 'cylinder' | 'sphere'

/** How far cell `i` of `n` across sits from their middle, as a share of half their width, squared. */
const reach = (i: number, n: number): number => (((i + 0.5) / n) * 2 - 1) ** 2
const within = (kind: SolidKind, c: Cell, n: Cell): boolean => {
  if (c.some((v, i) => v < 0 || v >= n[i])) return false
  if (kind === 'box') return true
  const flat = reach(c[0], n[0]) + reach(c[2], n[2])
  return (kind === 'sphere' ? flat + reach(c[1], n[1]) : flat) <= 1
}

/** The cells of a W × H × D shape from its min corner (a cylinder stands upright); a hollow one keeps
 *  only a shell `wall` thick. */
export function solid(kind: SolidKind, size: Cell, min: Cell, wall = 0): Cell[] {
  const inner = size.map((v) => v - 2 * wall) as Cell
  const out: Cell[] = []
  for (let y = 0; y < size[1]; y++)
    for (let z = 0; z < size[2]; z++)
      for (let x = 0; x < size[0]; x++) {
        if (!within(kind, [x, y, z], size)) continue
        if (wall && within(kind, [x - wall, y - wall, z - wall], inner)) continue
        out.push([min[0] + x, min[1] + y, min[2] + z])
      }
  return out
}
