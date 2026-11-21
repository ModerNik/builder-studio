// The Ruler's measure between two cells (DESIGN › Ruler legs): its X, Z and Y legs, the blocks it spans and
// the straight distance between the cell centres.
import type { Cell } from './inspection'

export interface Measure {
  from: Cell
  to: Cell
}
export interface Leg {
  axis: 'x' | 'z' | 'y'
  from: Cell
  to: Cell
  /** The blocks along it, counting both ends. */
  blocks: number
}

/** From `from`, along X, then Z, then Y to `to`; a leg one block long is left out. */
export function legs({ from, to }: Measure): Leg[] {
  const out: Leg[] = []
  let at = from
  for (const [axis, i] of [
    ['x', 0],
    ['z', 2],
    ['y', 1]
  ] as const) {
    if (to[i] === at[i]) continue
    const next = at.map((v, k) => (k === i ? to[i] : v)) as Cell
    out.push({ axis, from: at, to: next, blocks: Math.abs(to[i] - at[i]) + 1 })
    at = next
  }
  return out
}

/** The box the two cells span, W × H × D, counting both ends. */
export const spanOf = ({ from, to }: Measure): Cell =>
  from.map((v, i) => Math.abs(to[i] - v) + 1) as Cell

/** The straight distance between the cell centres, in blocks. */
export const distanceOf = ({ from, to }: Measure): number =>
  Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])
