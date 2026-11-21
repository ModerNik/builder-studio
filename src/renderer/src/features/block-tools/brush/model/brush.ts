// Brush (DESIGN › Tool options): what one point of a stroke changes, read against the build at that moment.
import type { Cell } from '@/entities/viewer/model/inspection'
import type { Block, Change, Read } from '@/entities/block-edit/model/edit'
import { stamp, type BrushShape } from '@/entities/block-edit/model/geometry'

export interface BrushOptions {
  shape: BrushShape
  size: number
  mode: 'add' | 'erase'
}

/** Brush: Add fills the air in the stamp with the block; Erase removes the blocks in it. */
export function brushAt(o: BrushOptions, at: Cell, read: Read, block: Block | null): Change[] {
  const cells = stamp(o.shape, o.size, at)
  if (o.mode === 'erase') return cells.filter((c) => read(c) !== null).map((c) => [c, null])
  return block ? cells.filter((c) => read(c) === null).map((c) => [c, block.state]) : []
}
