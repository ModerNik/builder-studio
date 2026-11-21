// Paint (DESIGN › Tool options): what one point of a stroke changes, read against the build at that moment.
import type { Cell } from '@/entities/viewer/model/inspection'
import { SIDES, type Block, type Change, type Read } from '@/entities/block-edit/model/edit'
import { stamp } from '@/entities/block-edit/model/geometry'

export interface PaintOptions {
  shape: 'sphere' | 'cube'
  size: number
  surface: boolean
  keep: boolean
}

/** Whether a cell has air on any of its six sides. */
const exposed = (c: Cell, read: Read): boolean =>
  SIDES.some((d) => read([c[0] + d[0], c[1] + d[1], c[2] + d[2]]) === null)

/** Paint: the blocks in the stamp become the chosen block; Surface only skips blocks with no air beside
 *  them, and Keep shape carries each block's states (facing, half) over. */
export function paintAt(o: PaintOptions, at: Cell, read: Read, block: Block | null): Change[] {
  if (!block) return []
  const out: Change[] = []
  for (const c of stamp(o.shape, o.size, at)) {
    const from = read(c)
    if (from === null || (o.surface && !exposed(c, read))) continue
    const to = o.keep ? block.swap(from) : block.state
    if (to !== from) out.push([c, to])
  }
  return out
}
