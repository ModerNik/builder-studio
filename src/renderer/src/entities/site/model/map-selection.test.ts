import { describe, expect, it } from 'vitest'
import {
  boxSize,
  cellAt,
  centreBox,
  nudgeBox,
  resizeBox,
  withMargin,
  type MapFrame
} from './map-selection'

const map: MapFrame = { origin: [-256, 100], size: [512, 256] }

describe('map selection', () => {
  it('maps a point to its world column and rejects points off the map', () => {
    expect(cellAt(map, 0, 0, 1024, 512)).toEqual([-256, 100])
    expect(cellAt(map, 1023, 511, 1024, 512)).toEqual([255, 355])
    expect(cellAt(map, 1024, 10, 1024, 512)).toBeNull()
  })
  it('nudges a box and stops at the edge without changing its size', () => {
    const box = centreBox(map, 16)
    expect(boxSize(nudgeBox(map, box, 1, -1))).toEqual([16, 16])
    const edge = nudgeBox(map, box, -10_000, 0)
    expect(edge[0]).toBe(-256)
    expect(boxSize(edge)).toEqual([16, 16])
  })
  it('resizes from the far corner, never below one column or past the map', () => {
    const box: [number, number, number, number] = [0, 100, 3, 103]
    expect(resizeBox(map, box, -10, 0)).toEqual([0, 100, 0, 103])
    expect(resizeBox(map, box, 10_000, 1)).toEqual([0, 100, 255, 104])
  })
  it('grows the margin outline on every side and clips it to the map', () => {
    expect(withMargin(map, [0, 110, 9, 119], 4)).toEqual([-4, 106, 13, 123])
    expect(withMargin(map, [-256, 100, -250, 105], 8)).toEqual([-256, 100, -242, 113])
  })
  it('normalises boxes drawn backwards', () => {
    expect(nudgeBox(map, [5, 110, 0, 100], 1, 1)).toEqual([1, 101, 6, 111])
  })
})
