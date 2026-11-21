// Map selection maths for MapSelectionCanvas: world columns under the pointer, and keyboard nudges that
// keep the box on the map. Boxes are lib/site's [x1, z1, x2, z2], inclusive.
import { norm, type Box } from './site'

export interface MapFrame {
  origin: [number, number] // world x, z of the map's top-left pixel
  size: [number, number] // columns across (x) and down (z)
}

/** The world column under a point inside a `width`×`height` element, or null outside the map. */
export function cellAt(
  map: MapFrame,
  px: number,
  py: number,
  width: number,
  height: number
): [number, number] | null {
  const x = Math.floor((px / width) * map.size[0])
  const z = Math.floor((py / height) * map.size[1])
  if (x < 0 || z < 0 || x >= map.size[0] || z >= map.size[1]) return null
  return [map.origin[0] + x, map.origin[1] + z]
}

const limits = (map: MapFrame): Box => [
  map.origin[0],
  map.origin[1],
  map.origin[0] + map.size[0] - 1,
  map.origin[1] + map.size[1] - 1
]

/** Moves the whole box, stopping at the map's edge. */
export function nudgeBox(map: MapFrame, box: Box, dx: number, dz: number): Box {
  const [x1, z1, x2, z2] = norm(box)
  const [minX, minZ, maxX, maxZ] = limits(map)
  const mx = Math.min(Math.max(dx, minX - x1), maxX - x2)
  const mz = Math.min(Math.max(dz, minZ - z1), maxZ - z2)
  return [x1 + mx, z1 + mz, x2 + mx, z2 + mz]
}

/** Grows or shrinks the box from its far corner; it stays at least one column and on the map. */
export function resizeBox(map: MapFrame, box: Box, dx: number, dz: number): Box {
  const [x1, z1, x2, z2] = norm(box)
  const [, , maxX, maxZ] = limits(map)
  return [x1, z1, Math.min(maxX, Math.max(x1, x2 + dx)), Math.min(maxZ, Math.max(z1, z2 + dz))]
}

/** The box grown by `margin` columns on every side, clipped to the map. */
export function withMargin(map: MapFrame, box: Box, margin: number): Box {
  const [x1, z1, x2, z2] = norm(box)
  const [minX, minZ, maxX, maxZ] = limits(map)
  return [
    Math.max(minX, x1 - margin),
    Math.max(minZ, z1 - margin),
    Math.min(maxX, x2 + margin),
    Math.min(maxZ, z2 + margin)
  ]
}

/** A `side`-wide box centred on the map, for starting a selection from the keyboard. */
export function centreBox(map: MapFrame, side: number): Box {
  const w = Math.min(side, map.size[0])
  const h = Math.min(side, map.size[1])
  const x = map.origin[0] + Math.floor((map.size[0] - w) / 2)
  const z = map.origin[1] + Math.floor((map.size[1] - h) / 2)
  return [x, z, x + w - 1, z + h - 1]
}

export const boxSize = (box: Box): [number, number] => {
  const [x1, z1, x2, z2] = norm(box)
  return [x2 - x1 + 1, z2 - z1 + 1]
}
