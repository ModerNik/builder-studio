// Hand edits and their undo history. The layer maps build cells ("x,y,z") to a block state, or null where a
// block was removed; each edit keeps every cell's layer entry before and after, so undo and redo are exact.
import type { EditsFile } from '@shared/api'
import type { ToolId } from './edit'

export type Layer = ReadonlyMap<string, string | null>
type Entry = string | null | undefined // undefined: the cell is not in the layer
export interface Edit {
  label: string
  tool: ToolId
  changes: [key: string, before: Entry, after: Entry][]
}
export interface History {
  layer: Layer
  edits: Edit[]
  cursor: number // edits[0..cursor) are applied
}
export const EMPTY: History = { layer: new Map(), edits: [], cursor: 0 }

const put = (layer: Map<string, string | null>, key: string, e: Entry): void =>
  void (e === undefined ? layer.delete(key) : layer.set(key, e))

/** Record and apply an edit; it drops the edits that were undone. Cells already as asked are left out. */
export function commit(
  h: History,
  label: string,
  tool: ToolId,
  cells: Iterable<[string, Entry]>
): History {
  const changes: Edit['changes'] = []
  for (const [key, after] of cells) {
    const before = h.layer.get(key)
    const had = h.layer.has(key)
    if (had ? before !== after : after !== undefined)
      changes.push([key, had ? before : undefined, after])
  }
  if (!changes.length) return h
  const layer = new Map(h.layer)
  for (const [key, , after] of changes) put(layer, key, after)
  const edits = [...h.edits.slice(0, h.cursor), { label, tool, changes }]
  return { layer, edits, cursor: edits.length }
}

/** Undo or redo up to `cursor` edits applied. */
export function moveTo(h: History, cursor: number): History {
  const to = Math.max(0, Math.min(cursor, h.edits.length))
  if (to === h.cursor) return h
  const layer = new Map(h.layer)
  if (to < h.cursor)
    for (let i = h.cursor - 1; i >= to; i--)
      for (const [key, before] of [...h.edits[i].changes].reverse()) put(layer, key, before)
  else
    for (let i = h.cursor; i < to; i++)
      for (const [key, , after] of h.edits[i].changes) put(layer, key, after)
  return { ...h, layer, cursor: to }
}

/** The layer as data/edits.json holds it. */
export function encodeLayer(layer: Layer): EditsFile {
  const states: string[] = []
  const index = new Map<string, number>()
  const cells: number[] = []
  for (const [key, state] of layer) {
    let s = 0
    if (state !== null) {
      if (!index.has(state)) index.set(state, states.push(state))
      s = index.get(state)!
    }
    cells.push(...key.split(',').map(Number), s)
  }
  return { version: 1, states, cells }
}

export function decodeLayer(file: EditsFile | null): Map<string, string | null> {
  const layer = new Map<string, string | null>()
  if (!file) return layer
  for (let i = 0; i < file.cells.length; i += 4) {
    const [x, y, z, s] = file.cells.slice(i, i + 4)
    layer.set(`${x},${y},${z}`, s ? file.states[s - 1] : null)
  }
  return layer
}

/** The layer in a file's own cells: build cells minus where the file's (0, 0, 0) sits. */
export function viewLayer(layer: Layer, origin: readonly number[]): Map<string, string | null> {
  if (origin.every((o) => o === 0)) return new Map(layer)
  const out = new Map<string, string | null>()
  for (const [key, state] of layer)
    out.set(
      key
        .split(',')
        .map((v, i) => Number(v) - origin[i])
        .join(','),
      state
    )
  return out
}
