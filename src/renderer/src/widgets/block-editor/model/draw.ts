// The stroke tools: which tools draw with a drag, where each works for a hovered face, and what one point of a
// stroke changes, read against the build as it is at that moment.
import type { Cell } from '@/entities/viewer/model/inspection'
import type { ViewerHit } from '@/entities/viewer/ui/BuildViewer'
import type { Block, Change, Read, ToolId } from '@/entities/block-edit/model/edit'
import { brushAt } from '@/features/block-tools/brush/model/brush'
import { paintAt } from '@/features/block-tools/paint/model/paint'
import { cornerOf, shapeAt } from '@/features/block-tools/shape/model/shape'
import { terrainAt } from '@/features/block-tools/terrain/model/terrain'
import type { ToolOptions } from './options'

/** The tools that draw with a drag. */
export const STROKES = new Set<ToolId>(['brush', 'paint', 'shape', 'terrain'])

/** Where a stroke tool works for a hovered face: on the block, in the cell in front of it, or for a shape
 *  its min corner. */
export function anchorOf(tool: ToolId, o: ToolOptions, h: ViewerHit): Cell {
  if (tool === 'shape' && o.shape.kind !== 'line') return cornerOf(o.shape.size, h)
  return tool === 'paint' || tool === 'terrain' || (tool === 'brush' && o.brush.mode === 'erase')
    ? h.cell
    : h.adjacent
}

/** How far apart a drag's points are drawn, so a fast drag leaves no gaps. */
export const stepOf = (tool: ToolId, o: ToolOptions): number =>
  tool === 'brush' || tool === 'paint' || tool === 'terrain' ? Math.max(1, o[tool].size / 3) : 1

/** One point of a stroke tool; `from` is where the stroke started. */
export function drawAt(
  tool: ToolId,
  o: ToolOptions,
  at: Cell,
  read: Read,
  block: Block | null,
  from?: Cell
): Change[] {
  if (tool === 'brush') return brushAt(o.brush, at, read, block)
  if (tool === 'paint') return paintAt(o.paint, at, read, block)
  if (tool === 'shape') return shapeAt(o.shape, at, read, block)
  if (tool === 'terrain') return terrainAt(o.terrain, at, read, from)
  return []
}
