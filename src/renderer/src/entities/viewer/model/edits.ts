// Hand edits drawn over a loaded file: the cells to set so the viewer shows an edit layer.
import type { Cell } from './inspection'

/** Edited cells by "x,y,z" in the viewer's coordinates: a block state, or null where a block was removed. */
export type EditLayer = ReadonlyMap<string, string | null>
export const AIR = 'minecraft:air'
export const cellKey = (c: readonly number[]): string => c.join(',')
export const keyCell = (key: string): Cell => key.split(',').map(Number) as Cell

/** The cells to set so the grid shows `layer`. `originals` keeps each touched cell's block from the file (this
 *  fills it), so a cell the layer no longer holds goes back to that block. */
export function layerCells(
  layer: EditLayer,
  originals: Map<string, string>,
  blockAt: (cell: Cell) => string
): [number, number, number, string][] {
  const out: [number, number, number, string][] = []
  for (const key of new Set([...originals.keys(), ...layer.keys()])) {
    const cell = keyCell(key)
    const now = blockAt(cell)
    if (!originals.has(key)) originals.set(key, now)
    const want = layer.has(key) ? (layer.get(key) ?? AIR) : originals.get(key)!
    if (want !== now) out.push([...cell, want])
  }
  return out
}
