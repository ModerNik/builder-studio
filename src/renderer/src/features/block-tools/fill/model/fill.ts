// Fill (DESIGN › Tool options): what one click changes. Connected and Air spread from the clicked cell through
// its six sides; Replace takes every block of the clicked kind. All stay inside the limit box.
import type { Cell } from '@/entities/viewer/model/inspection'
import {
  SIDES,
  type Block,
  type Box,
  type Change,
  type Read
} from '@/entities/block-edit/model/edit'
import { cellKey } from '@/entities/block-edit/model/geometry'

export interface FillOptions {
  mode: 'connected' | 'air' | 'replace'
  limit: 'selection' | 'layer' | 'build'
  keep: boolean
}

/** The most cells Replace looks at in one click (a 128-block cube), so a huge build cannot freeze the app. */
export const MAX_SCAN = 128 ** 3

const inside = (c: Cell, b: Box): boolean => c.every((v, i) => v >= b.min[i] && v <= b.max[i])
/** The block's id without its states, so stairs facing any way are one kind. */
const kind = (s: string): string => s.split('[')[0]

/** The cells one click changes from `at` (the clicked block, or for Air the cell in front of the clicked face),
 *  or null when it would reach more than `cap` cells. */
export function fillAt(
  o: FillOptions,
  at: Cell,
  read: Read,
  block: Block,
  limit: Box,
  cap: number
): Change[] | null {
  const from = read(at)
  if (!inside(at, limit) || (o.mode === 'air') !== (from === null)) return []
  const same = (s: string | null): boolean =>
    from === null ? s === null : s !== null && kind(s) === kind(from)
  let cells: Cell[] = []
  if (o.mode === 'replace') {
    const { min, max } = limit
    if (max.reduce((n, v, i) => n * (v - min[i] + 1), 1) > MAX_SCAN) return null
    for (let y = min[1]; y <= max[1]; y++)
      for (let z = min[2]; z <= max[2]; z++)
        for (let x = min[0]; x <= max[0]; x++)
          if (same(read([x, y, z])) && cells.push([x, y, z]) > cap) return null
  } else {
    cells = [at]
    const seen = new Set([cellKey(at)])
    for (let i = 0; i < cells.length; i++)
      for (const d of SIDES) {
        const n: Cell = [cells[i][0] + d[0], cells[i][1] + d[1], cells[i][2] + d[2]]
        const k = cellKey(n)
        if (seen.has(k) || !inside(n, limit)) continue
        seen.add(k)
        if (same(read(n)) && cells.push(n) > cap) return null
      }
  }
  const out: Change[] = []
  for (const c of cells) {
    const s = read(c)
    const to = s !== null && o.keep ? block.swap(s) : block.state
    if (to !== s) out.push([c, to])
  }
  return out
}
