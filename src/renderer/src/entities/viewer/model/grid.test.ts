import { expect, test } from 'vitest'
import { gridSpan, gridStep } from './grid'

test('gridStep keeps lines 8px apart in powers of two', () => {
  expect(gridStep(40)).toBe(1)
  expect(gridStep(8)).toBe(1)
  expect(gridStep(4)).toBe(2)
  expect(gridStep(3)).toBe(4)
  expect(gridStep(0.1)).toBe(128)
  expect(gridStep(0)).toBe(1)
  expect(gridStep(NaN)).toBe(1)
})

test('gridSpan ends on lines through the origin, 8 steps past the build', () => {
  // one block apart: the old grid's reach, cell edges at half-integers
  expect(gridSpan(0, 9, 0, 1)).toEqual([-8.5, 17.5])
  // four apart, origin at cell 2: lines at 1.5 + 4k
  const [first, last] = gridSpan(0, 9, 2, 4)
  expect(Math.abs((first - 1.5) % 4)).toBe(0)
  expect(Math.abs((last - 1.5) % 4)).toBe(0)
  expect(first).toBeLessThanOrEqual(-0.5 - 32)
  expect(last).toBeGreaterThanOrEqual(9.5 + 32)
  expect(first).toBeGreaterThan(-0.5 - 36)
  expect(last).toBeLessThan(9.5 + 36)
})
