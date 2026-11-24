// Pure placement & ground-stat maths for the 3D World Map (Scout Terrain & Place Build modes).
import type { Box2D, GroundStats, RotationDeg, Vec3 } from './types'

export function normalizeBox([x1, z1, x2, z2]: Box2D): Box2D {
  return [Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2)]
}

export function boxDimensions(box: Box2D): [number, number] {
  const [x1, z1, x2, z2] = normalizeBox(box)
  return [x2 - x1 + 1, z2 - z1 + 1]
}

export function boxWithMargin(box: Box2D, margin: number): Box2D {
  const [x1, z1, x2, z2] = normalizeBox(box)
  const m = Math.max(0, Math.round(margin))
  return [x1 - m, z1 - m, x2 + m, z2 + m]
}

export function rotatedFootprint(size: Vec3, rotation: RotationDeg): [number, number] {
  return rotation === 90 || rotation === 270 ? [size[2], size[0]] : [size[0], size[2]]
}

/** World X/Z bounding box [x1, z1, x2, z2] of a build placed with its min corner at `origin` and turned by `rotation`. */
export function buildBoxFromOrigin(origin: Vec3, size: Vec3, rotation: RotationDeg): Box2D {
  const [w, d] = rotatedFootprint(size, rotation)
  return [origin[0], origin[2], origin[0] + Math.max(1, w) - 1, origin[2] + Math.max(1, d) - 1]
}

/** Default build ORIGIN from an approximate terrain area box: min X/Z corner, one block above median ground. */
export function originFromArea(box: Box2D, medianGround: number): Vec3 {
  const [x1, z1] = normalizeBox(box)
  return [x1, medianGround + 1, z1]
}

export function formatOriginLine([x, y, z]: Vec3): string {
  return `ORIGIN = (${x}, ${y}, ${z})`
}

export function nudgeBox(box: Box2D, dx: number, dz: number): Box2D {
  const [x1, z1, x2, z2] = normalizeBox(box)
  return [x1 + dx, z1 + dz, x2 + dx, z2 + dz]
}

export function nudgeOrigin([x, y, z]: Vec3, dx: number, dy: number, dz: number): Vec3 {
  return [x + dx, y + dy, z + dz]
}

export function nextRotation(current: RotationDeg, delta: 90 | -90): RotationDeg {
  return ((((current + delta) % 360) + 360) % 360) as RotationDeg
}

/** Sample min, max and median ground Y across a box using a height lookup (downsamples huge boxes cleanly). */
export function computeGroundStats(
  box: Box2D,
  heightAt: (x: number, z: number) => number | null
): GroundStats | null {
  const [x1, z1, x2, z2] = normalizeBox(box)
  const w = x2 - x1 + 1
  const d = z2 - z1 + 1
  const step = Math.max(1, Math.ceil(Math.sqrt((w * d) / 4096)))
  const ys: number[] = []
  for (let z = z1; z <= z2; z += step) {
    for (let x = x1; x <= x2; x += step) {
      const y = heightAt(x, z)
      if (y !== null) ys.push(y)
    }
  }
  if (!ys.length) return null
  ys.sort((a, b) => a - b)
  return { min: ys[0], max: ys[ys.length - 1], median: ys[ys.length >> 1] }
}

/** Centered square box around (cx, cz) with given width and depth. */
export function centeredBox(cx: number, cz: number, width: number, depth: number): Box2D {
  const w = Math.max(1, Math.round(width))
  const d = Math.max(1, Math.round(depth))
  const x1 = Math.round(cx - w / 2)
  const z1 = Math.round(cz - d / 2)
  return [x1, z1, x1 + w - 1, z1 + d - 1]
}
