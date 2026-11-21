// Site picker maths on the bridge's site_map heights (int16, rows of z, -32768 where no chunk).
export type Box = [number, number, number, number] // x1, z1, x2, z2, inclusive

export const norm = ([a, b, c, d]: Box): Box => [
  Math.min(a, c),
  Math.min(b, d),
  Math.max(a, c),
  Math.max(b, d)
]

/** min, max and median top-block y of the box's columns that have a chunk. */
export function boxStats(
  map: { origin: [number, number]; size: [number, number] },
  h: Int16Array,
  box: Box
): { min: number; max: number; median: number } | null {
  const [x1, z1, x2, z2] = norm(box)
  const ys: number[] = []
  for (let z = Math.max(z1, map.origin[1]); z <= Math.min(z2, map.origin[1] + map.size[1] - 1); z++)
    for (
      let x = Math.max(x1, map.origin[0]);
      x <= Math.min(x2, map.origin[0] + map.size[0] - 1);
      x++
    ) {
      const y = h[(z - map.origin[1]) * map.size[0] + (x - map.origin[0])]
      if (y !== -32768) ys.push(y)
    }
  if (!ys.length) return null
  ys.sort((a, b) => a - b)
  return { min: ys[0], max: ys[ys.length - 1], median: ys[ys.length >> 1] }
}

/** The map box around a centre, `side` columns wide. */
export const mapBox = ([x, z]: number[], side: number): Box => [
  x - side / 2,
  z - side / 2,
  x + side / 2 - 1,
  z + side / 2 - 1
]

/** How many of the world's region files (512 × 512 columns each) the box reads. */
export const regionsIn = (regions: [number, number][], box: Box): number => {
  const [x1, z1, x2, z2] = norm(box).map((v) => Math.floor(v / 512))
  return regions.filter(([rx, rz]) => rx >= x1 && rx <= x2 && rz >= z1 && rz <= z2).length
}

/** The ORIGIN line for build.py: the box's min corner, one above its median ground. */
export const originLine = (box: Box, median: number): string => {
  const b = norm(box)
  return `ORIGIN = (${b[0]}, ${median + 1}, ${b[1]})`
}
