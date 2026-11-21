// Turning and flipping block states (DESIGN › Transform handles): when a selection turns or flips, its blocks'
// facing, axis, rotation, rail shapes, side connections, hinges and stair shapes turn and flip with it.
import { formatState, parseState } from './registry'

/** An axis to flip across: 0 is X (east and west swap), 1 is Y, 2 is Z (north and south swap). */
export type FlipAxis = 0 | 1 | 2

// clockwise seen from above
const ROUND = ['north', 'east', 'south', 'west']
const SIDES = new Set([...ROUND, 'up', 'down'])
const FLIPS: Record<string, string>[] = [
  { east: 'west', west: 'east' },
  {
    up: 'down',
    down: 'up',
    top: 'bottom',
    bottom: 'top',
    upper: 'lower',
    lower: 'upper',
    floor: 'ceiling',
    ceiling: 'floor'
  },
  { north: 'south', south: 'north' }
]
// a mirror swaps handedness: stair corners, door hinges, double chest halves
const HANDED: Record<string, string> = {
  left: 'right',
  right: 'left',
  inner_left: 'inner_right',
  inner_right: 'inner_left',
  outer_left: 'outer_right',
  outer_right: 'outer_left'
}
// the properties whose values flip upside down
const VERTICAL = new Set(['facing', 'half', 'type', 'face', 'attachment', 'vertical_direction'])

type Edit = (key: string, value: string, props: Record<string, string>) => [string, string]

function edit(state: string, f: Edit): string {
  if (!state.includes('[')) return state
  const { id, props } = parseState(state)
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(props)) {
    const [k2, v2] = f(k, v, props)
    out[k2] = v2
  }
  return formatState(id, out)
}

/** A rail's shape with its sides mapped, spelled the way the game spells it (north_south, south_east...). */
function rail(shape: string, side: (d: string) => string): string {
  if (shape.startsWith('ascending_')) return 'ascending_' + side(shape.slice(10))
  const ends = shape.split('_')
  if (ends.length !== 2 || !ends.every((d) => ROUND.includes(d))) return shape // a stair's shape
  const [a, b] = ends.map(side)
  const ns = (d: string): boolean => d === 'north' || d === 'south'
  if (ns(a) === ns(b)) return ns(a) ? 'north_south' : 'east_west'
  return ns(a) ? `${a}_${b}` : `${b}_${a}`
}

/** The state turned a quarter turn clockwise (seen from above) `turns` times. */
export function turnState(state: string, turns: number): string {
  const k = ((turns % 4) + 4) % 4
  if (!k) return state
  const side = (d: string): string => {
    const i = ROUND.indexOf(d)
    return i < 0 ? d : ROUND[(i + k) % 4]
  }
  return edit(state, (key, v) => {
    if (ROUND.includes(key)) return [side(key), v]
    if (key === 'facing') return [key, side(v)]
    if (key === 'axis' && k % 2) return [key, v === 'x' ? 'z' : v === 'z' ? 'x' : v]
    if (key === 'rotation') return [key, String((Number(v) + 4 * k) % 16)]
    if (key === 'shape') return [key, rail(v, side)]
    return [key, v]
  })
}

/** The state mirrored across `axis`. */
export function flipState(state: string, axis: FlipAxis): string {
  const swap = FLIPS[axis]
  const side = (d: string): string => swap[d] ?? d
  return edit(state, (key, v, props) => {
    if (axis === 1) {
      // up and down swap only where the block has both (a wall's `up` is its post)
      if ((key === 'up' || key === 'down') && 'up' in props && 'down' in props)
        return [side(key), v]
      return [key, VERTICAL.has(key) ? side(v) : v]
    }
    if (SIDES.has(key)) return [side(key), v]
    if (key === 'facing') return [key, side(v)]
    // 0 faces south and 4 west: X maps r to -r, Z maps it to 8 - r
    if (key === 'rotation') return [key, String(((axis === 0 ? 16 : 8) - Number(v) + 16) % 16)]
    if (key === 'shape') return [key, HANDED[v] ?? rail(v, side)]
    if (key === 'hinge' || key === 'type') return [key, HANDED[v] ?? v]
    return [key, v]
  })
}
