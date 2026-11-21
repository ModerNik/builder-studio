import { expect, test } from 'vitest'
import { boxStats, mapBox, originLine, regionsIn } from './site'

test('box stats skip columns without a chunk and clip to the map', () => {
  // a 3 x 2 map at world (10, 20): row z=20 is 1 2 3, row z=21 is none 5 6
  const h = Int16Array.from([1, 2, 3, -32768, 5, 6])
  const map = { origin: [10, 20] as [number, number], size: [3, 2] as [number, number] }
  expect(boxStats(map, h, [12, 21, 5, 0])).toEqual({ min: 1, max: 6, median: 3 })
  expect(boxStats(map, h, [10, 21, 10, 21])).toBeNull()
})

test('map box, regions read and the ORIGIN line', () => {
  expect(mapBox([0, 0], 16)).toEqual([-8, -8, 7, 7])
  expect(
    regionsIn(
      [
        [-1, -1],
        [0, 0],
        [3, 3]
      ],
      [-8, -8, 7, 7]
    )
  ).toBe(2)
  expect(originLine([5, 9, 1, 2], 66)).toBe('ORIGIN = (1, 67, 2)')
})
