// Shape (DESIGN › Tool options): where a shape stands for a hovered face, and what one stamp changes.
import type { Cell } from '@/entities/viewer/model/inspection'
import type { ViewerHit } from '@/entities/viewer/ui/BuildViewer'
import type { Block, Change, Read } from '@/entities/block-edit/model/edit'
import { solid, stamp, type SolidKind } from '@/entities/block-edit/model/geometry'

export interface ShapeOptions {
  kind: SolidKind | 'line'
  size: Cell
  hollow: boolean
  wall: number
  spacing: number
  width: number
}

/** A shape's min corner so it stands out from the hovered face: centred across it, rising from it on a
 *  side face, and hanging from it under a block. */
export const cornerOf = (size: Cell, h: ViewerHit): Cell =>
  h.adjacent.map((v, i) =>
    h.normal[i] < 0
      ? v - size[i] + 1
      : h.normal[i] > 0 || i === 1
        ? v
        : v - Math.floor((size[i] - 1) / 2)
  ) as Cell

/** Shape: one stamp from its min corner, or for Line one point of the line `width` across, into air only. */
export function shapeAt(o: ShapeOptions, at: Cell, read: Read, block: Block | null): Change[] {
  if (!block) return []
  const cells =
    o.kind === 'line'
      ? stamp('cube', o.width, at)
      : solid(o.kind, o.size, at, o.hollow ? o.wall : 0)
  return cells.filter((c) => read(c) === null).map((c) => [c, block.state])
}
