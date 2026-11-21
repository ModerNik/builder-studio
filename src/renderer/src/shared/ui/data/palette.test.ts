import { describe, expect, it } from 'vitest'
import { shadeSteps } from './palette'

describe('shadeSteps', () => {
  it('flags steps that are too close or a big jump (the palette strip board ramp)', () => {
    const steps = shadeSteps([0.36, 0.47, 0.52, 0.55, 0.57, 0.58, 0.89])
    expect(steps.map((s) => s.delta)).toEqual([0.11, 0.05, 0.03, 0.02, 0.01, 0.31])
    expect(steps.map((s) => s.problem)).toEqual([null, null, 'close', 'close', 'close', 'jump'])
  })
  it('has no steps for one tile', () => {
    expect(shadeSteps([0.5])).toEqual([])
  })
})
