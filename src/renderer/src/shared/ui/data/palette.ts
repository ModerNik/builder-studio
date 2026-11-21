/** A step between two neighbouring tiles of a ramp: the lightness change and whether it reads badly. */
export interface ShadeStep {
  delta: number
  problem: 'close' | 'jump' | null
}

/**
 * Lightness steps along a ramp (OKLab L, 0–1): one per tile after the first. Steps under `close` read
 * as the same shade, over `jump` as a break.
 */
export function shadeSteps(ls: number[], close = 0.04, jump = 0.2): ShadeStep[] {
  return ls.slice(1).map((l, i) => {
    const delta = Math.round((l - ls[i]) * 100) / 100
    const size = Math.abs(delta)
    return { delta, problem: size < close ? 'close' : size > jump ? 'jump' : null }
  })
}
