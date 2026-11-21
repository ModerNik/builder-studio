// The floor grid's line spacing (DESIGN › Floor grid): one block up close, doubling as the view zooms out.

/** The smallest power-of-two step, in blocks, that keeps grid lines at least `minPx` apart on screen. */
export function gridStep(pxPerBlock: number, minPx = 8): number {
  if (!(pxPerBlock > 0)) return 1
  return 2 ** Math.max(0, Math.ceil(Math.log2(minPx / pxPerBlock)))
}

/** The first and last grid line along one axis: on `origin`'s corner, reaching `margin` steps past min and max. */
export function gridSpan(
  min: number,
  max: number,
  origin: number,
  step: number,
  margin = 8
): [number, number] {
  const o = origin - 0.5
  return [
    o + Math.floor((min - 0.5 - margin * step - o) / step) * step,
    o + Math.ceil((max + 0.5 + margin * step - o) / step) * step
  ]
}
