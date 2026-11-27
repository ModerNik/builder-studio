// Fast O(1)-per-step analytical heightfield ray-marching for instant 3D world terrain picking
// without brute-force triangle raycasting across millions of terrain polygons.
import type { WorldCursor } from '../model/types'

const MIN_WORLD_Y = -64
const MAX_WORLD_Y = 320

/**
 * Intersect a 3D world ray with the loaded terrain heightfield `heightAt(x, z)`.
 * Uses direct lookup for vertical rays (2D top-down) and adaptive stepping + binary refinement for 3D/Iso.
 */
export function raymarchHeightfield(
  origin: readonly [number, number, number],
  dir: readonly [number, number, number],
  heightAt: (x: number, z: number) => number | null,
  maxDist = 6000
): WorldCursor | null {
  const [ox, oy, oz] = origin
  let [dx, dy, dz] = dir
  const len = Math.hypot(dx, dy, dz)
  if (len < 1e-8) return null
  dx /= len
  dy /= len
  dz /= len

  // Fast O(1) path for top-down vertical rays
  if (Math.abs(dx) < 1e-5 && Math.abs(dz) < 1e-5 && dy < 0) {
    const ix = Math.floor(ox)
    const iz = Math.floor(oz)
    const h = heightAt(ix, iz)
    return h === null ? null : { x: ix, y: h, z: iz }
  }

  let tStart = 0
  let tEnd = maxDist
  if (Math.abs(dy) < 1e-6) {
    if (oy < MIN_WORLD_Y || oy > MAX_WORLD_Y + 1) return null
  } else {
    const tA = (MAX_WORLD_Y + 1 - oy) / dy
    const tB = (MIN_WORLD_Y - oy) / dy
    const tMin = Math.min(tA, tB)
    const tMax = Math.max(tA, tB)
    if (tMax < 0 || tMin > maxDist) return null
    tStart = Math.max(0, tMin)
    tEnd = Math.min(maxDist, tMax)
  }

  let prevT = tStart
  for (let t = tStart; t <= tEnd; ) {
    const px = ox + dx * t
    const py = oy + dy * t
    const pz = oz + dz * t
    const ix = Math.floor(px)
    const iz = Math.floor(pz)
    const h = heightAt(ix, iz)
    if (h !== null && py <= h + 1) {
      // Binary-refine exact surface crossing between prevT and t
      let lo = prevT
      let hi = t
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) * 0.5
        const mx = Math.floor(ox + dx * mid)
        const mz = Math.floor(oz + dz * mid)
        const my = oy + dy * mid
        const mh = heightAt(mx, mz)
        if (mh !== null && my <= mh + 1) hi = mid
        else lo = mid
      }
      const hx = Math.floor(ox + dx * hi)
      const hz = Math.floor(oz + dz * hi)
      const hh = heightAt(hx, hz)
      return { x: hx, y: hh ?? h, z: hz }
    }
    prevT = t
    const step = t < 180 ? 0.75 : t < 600 ? 1.5 : t < 1800 ? 3.5 : 7.0
    t += step
  }

  return null
}
