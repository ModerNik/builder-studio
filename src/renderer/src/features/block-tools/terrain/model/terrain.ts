// Terrain (DESIGN › Tool options): a heightmap brush. Each column in a round footprint has a top block; Raise
// and Lower move it up or down by the strength (less toward the edge), Smooth moves it toward its neighbours'
// mean and Flatten toward the height where the stroke started. Raised cells copy the column's top block.
import type { Cell } from '@/entities/viewer/model/inspection'
import type { Change, Read } from '@/entities/block-edit/model/edit'
import { cellKey } from '@/entities/block-edit/model/geometry'

export interface TerrainOptions {
  mode: 'raise' | 'lower' | 'smooth' | 'flatten'
  size: number
  strength: number
}

/** How far above and below the pointer a column's top is looked for. */
const REACH = 16

/** One pass of the terrain brush centred on the column of `at`; `from` is where the stroke started. */
export function terrainAt(o: TerrainOptions, at: Cell, read: Read, from: Cell = at): Change[] {
  const r = o.size / 2
  const span = Math.ceil(r)
  const lo = at[1] - REACH
  const tops = new Map<string, number | null>()
  // the column's highest block within reach of the pointer, or null where there is none
  const topOf = (x: number, z: number): number | null => {
    const k = cellKey([x, z])
    if (!tops.has(k)) {
      let y = at[1] + REACH
      while (y >= lo && read([x, y, z]) === null) y--
      tops.set(k, y < lo ? null : y)
    }
    return tops.get(k)!
  }
  const out: Change[] = []
  for (let dz = -span; dz <= span; dz++)
    for (let dx = -span; dx <= span; dx++) {
      const d = Math.hypot(dx, dz)
      if (d > r) continue
      const [x, z] = [at[0] + dx, at[2] + dz]
      const top = topOf(x, z)
      if (top === null) continue
      // full strength at the centre, at least one block out to the edge
      const amount = Math.max(1, Math.round(o.strength * (1 - (d / (r + 1)) ** 2)))
      const goal =
        o.mode === 'raise'
          ? top + amount
          : o.mode === 'lower'
            ? top - amount
            : Math.round(o.mode === 'flatten' ? from[1] : (meanTop(x, z, topOf) ?? top))
      const to = top + Math.max(-amount, Math.min(amount, goal - top))
      const block = read([x, top, z])!
      for (let y = top + 1; y <= to; y++) out.push([[x, y, z], block])
      for (let y = to + 1; y <= top; y++) out.push([[x, y, z], null])
    }
  return out
}

/** The mean top of a column and its eight neighbours that have one. */
function meanTop(
  x: number,
  z: number,
  topOf: (x: number, z: number) => number | null
): number | null {
  let [sum, n] = [0, 0]
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const t = topOf(x + dx, z + dz)
      if (t !== null) [sum, n] = [sum + t, n + 1]
    }
  return n ? sum / n : null
}
