// What every block tool works with: the tool ids, a cell read against the build as it is at that moment, the
// changes a tool makes and the limits on them.
import type { Cell } from '@/entities/viewer/model/inspection'
import type { BlockReader } from '@/entities/viewer/ui/BuildViewer'
import { cellKey } from './geometry'
import type { Layer } from './history'

export type ToolId =
  | 'select'
  | 'place'
  | 'erase'
  | 'pick'
  | 'brush'
  | 'paint'
  | 'fill'
  | 'shape'
  | 'terrain'
  | 'transform'
  | 'ruler'

/** A cell's block, or null for air. */
export type Read = (c: Cell) => string | null
/** A cell and its new block; null removes it. */
export type Change = [Cell, string | null]

/** The chosen block: its state, and how it replaces another block keeping that one's shape and facing. */
export interface Block {
  state: string
  swap: (from: string) => string
}

export interface Box {
  min: Cell
  max: Cell
}

// shortcut: Delete writes a removal for every cell in the box, air too; past this many cells it refuses.
// Upgrade when the viewer can say which cells hold blocks.
/** The most cells one edit changes: a selection erased, a stroke, a fill. */
export const MAX_CELLS = 32 ** 3
/** The largest Brush, Paint and Terrain size. */
export const MAX_SIZE = 32

export const SIDES: Cell[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1]
]

const AIR = /^minecraft:(?:cave_|void_)?air$/

/** The block at a file cell: the stroke's own changes first, then the hand edits (build cells, `origin` away),
 *  then the file. */
export function readOf(
  layer: Layer,
  reader: BlockReader | null,
  origin: readonly number[],
  pending?: ReadonlyMap<string, string | null>
): Read {
  return (c) => {
    const k = cellKey(c)
    if (pending?.has(k)) return pending.get(k)!
    const b = cellKey(c.map((v, i) => v + origin[i]))
    if (layer.has(b)) return layer.get(b)!
    const s = reader?.at(c)
    return s && !AIR.test(s) ? s : null
  }
}
