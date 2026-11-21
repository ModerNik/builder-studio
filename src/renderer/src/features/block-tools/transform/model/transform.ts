// Transform (DESIGN › Tool options): the selected box moved, turned and flipped, worked out as the cells it
// changes. Flips come first, then the quarter turns about the box's centre, then the offset. Air in the box is
// left out, so the blocks land among what is already there.
import type { Cell } from '@/entities/viewer/model/inspection'
import { flipState, turnState, type FlipAxis } from '@/entities/block/model/turn'
import type { Box, Change, Read } from '@/entities/block-edit/model/edit'
import { cellKey } from '@/entities/block-edit/model/geometry'

export interface TransformOptions {
  mode: 'move' | 'copy'
}

export interface Moves {
  offset: Cell
  /** Quarter turns clockwise seen from above. */
  turns: number
  flip: [boolean, boolean, boolean]
}
export const STILL: Moves = { offset: [0, 0, 0], turns: 0, flip: [false, false, false] }

const quarter = (turns: number): number => ((turns % 4) + 4) % 4
export const moved = (m: Moves): boolean =>
  quarter(m.turns) !== 0 || m.flip.some(Boolean) || m.offset.some((v) => v !== 0)
export const sizeOf = (b: Box): Cell => b.max.map((v, i) => v - b.min[i] + 1) as Cell
/** The cell the handles sit on before the box moves: its centre, rounded down. */
export const pivotOf = (b: Box): Cell => b.min.map((v, i) => Math.floor((v + b.max[i]) / 2)) as Cell

/** The Edit tab's Transform controls (DESIGN › Tool options). */
export interface TransformState {
  /** The selection's size, or null without one. */
  size: Cell | null
  /** The blocks in it, air left out; null when it is too big to transform. */
  blocks: number | null
  moves: Moves
  /** Turn by quarter turns: 1 is clockwise seen from above. */
  onTurn: (by: number) => void
  /** Mirror across the view's X, Y or Z. */
  onFlip: (axis: FlipAxis) => void
  onCancel: () => void
  onApply: () => void
}

/** The tool HUD's line: the mode and box, then how far it moved and turned. */
export function transformSummary(
  mode: TransformOptions['mode'],
  size: Cell | null,
  m: Moves
): string {
  if (!size) return 'Select a box first'
  const turn = quarter(m.turns) * 90
  return [
    `${mode === 'copy' ? 'Copy' : 'Move'} ${size.join('×')}`,
    m.offset.some((v) => v !== 0) && `offset ${m.offset.join(' ')}`,
    turn && `${turn}°`,
    m.flip.some(Boolean) && 'flipped'
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Moves with a flip across the view's `axis` added: after an odd turn, X and Z swap places in the box. */
export function flipped(m: Moves, axis: FlipAxis): Moves {
  const a = axis !== 1 && quarter(m.turns) % 2 ? 2 - axis : axis
  return { ...m, flip: m.flip.map((f, i) => (i === a ? !f : f)) as Moves['flip'] }
}

/** Where the box lands: its size turned about its centre, then moved by the offset. */
export function landing(box: Box, m: Moves): Box {
  const size = sizeOf(box)
  const to: Cell = quarter(m.turns) % 2 ? [size[2], size[1], size[0]] : size
  const min = box.min.map((v, i) => v + Math.floor((size[i] - to[i]) / 2) + m.offset[i]) as Cell
  return { min, max: min.map((v, i) => v + to[i] - 1) as Cell }
}

/** The box's blocks where they land, their states turned and flipped with them. */
export function transformed(box: Box, m: Moves, read: Read): Change[] {
  const size = sizeOf(box)
  const k = quarter(m.turns)
  const at = landing(box, m).min
  const states = new Map<string, string>() // each palette state is turned once
  const out: Change[] = []
  for (let y = box.min[1]; y <= box.max[1]; y++)
    for (let z = box.min[2]; z <= box.max[2]; z++)
      for (let x = box.min[0]; x <= box.max[0]; x++) {
        const s = read([x, y, z])
        if (s === null) continue
        let l = [x - box.min[0], y - box.min[1], z - box.min[2]]
        l = l.map((v, i) => (m.flip[i] ? size[i] - 1 - v : v))
        // a clockwise quarter turn takes (x, z) to (depth - 1 - z, x)
        for (let i = 0, w = size[0], d = size[2]; i < k; i++, [w, d] = [d, w])
          l = [d - 1 - l[2], l[1], l[0]]
        if (!states.has(s))
          states.set(
            s,
            turnState(
              ([0, 1, 2] as FlipAxis[]).reduce((t, a) => (m.flip[a] ? flipState(t, a) : t), s),
              k
            )
          )
        out.push([l.map((v, i) => v + at[i]) as Cell, states.get(s)!])
      }
  return out
}

/** The whole edit: Copy adds the blocks where they land; Move also clears where they were and none lands. */
export function transformEdit(box: Box, m: Moves, read: Read, copy: boolean): Change[] {
  const placed = transformed(box, m, read)
  if (copy) return placed
  const landed = new Set(placed.map(([c]) => cellKey(c)))
  const cleared: Change[] = []
  for (let y = box.min[1]; y <= box.max[1]; y++)
    for (let z = box.min[2]; z <= box.max[2]; z++)
      for (let x = box.min[0]; x <= box.max[0]; x++)
        if (read([x, y, z]) !== null && !landed.has(cellKey([x, y, z])))
          cleared.push([[x, y, z], null])
  return [...cleared, ...placed]
}
