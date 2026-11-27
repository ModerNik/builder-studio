import { expect, test } from 'vitest'
import { Euler, Quaternion } from 'three'
import {
  CAMERA_VIEWS,
  GIZMO_SIZE,
  GIZMO_TURN,
  axisClickView,
  projectAxes,
  type AxisEnd,
  type Orientation
} from './axis-gizmo'

const orientation = (pitch: number, yaw: number): Orientation =>
  new Quaternion().setFromEuler(new Euler(pitch, yaw, 0, 'YXZ')).toArray()
const end = (ends: AxisEnd[], axis: string, sign: number): AxisEnd =>
  ends.find((e) => e.axis === axis && e.sign === sign)!

test('a camera looking north from the south sees +X right, +Y up and +Z toward it', () => {
  const ends = projectAxes([0, 0, 0, 1])
  expect(ends.map((e) => `${e.sign > 0 ? '+' : '-'}${e.axis}`)).toEqual([
    '+x',
    '+y',
    '+z',
    '-x',
    '-y',
    '-z'
  ])
  expect(end(ends, 'x', 1).x).toBeCloseTo(32)
  expect(end(ends, 'y', 1).y).toBeCloseTo(-32)
  expect(end(ends, 'z', 1).depth).toBeCloseTo(1)
  expect(end(ends, 'z', -1).depth).toBeCloseTo(-1)
})

test('turning the camera moves the ends instead of relabelling them', () => {
  const east = projectAxes(orientation(0, Math.PI / 2)) // looking west from the east
  expect(end(east, 'x', 1).depth).toBeCloseTo(1)
  expect(end(east, 'z', 1).x).toBeCloseTo(-32)
  const top = projectAxes(orientation(-Math.PI / 2, 0))
  expect(end(top, 'y', 1).depth).toBeCloseTo(1)
  for (const e of projectAxes(orientation(-0.6, 0.8))) {
    expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true)
    expect(Math.hypot(e.x, e.y)).toBeLessThanOrEqual(32.0001)
  }
})

test('clicking the side the camera already looks from turns to the opposite one', () => {
  const front = projectAxes([0, 0, 0, 1])
  expect(axisClickView(end(front, 'z', 1))).toBe('elev_n')
  expect(axisClickView(end(front, 'x', 1))).toBe('elev_e')
  expect(axisClickView(end(front, 'y', -1))).toBe('bottom')
  const top = projectAxes(orientation(-Math.PI / 2, 0))
  expect(axisClickView(end(top, 'y', 1))).toBe('bottom')
})

test('every camera view has one menu entry', () => {
  expect(CAMERA_VIEWS.map((item) => item.view)).toContain('orbit')
  expect(new Set(CAMERA_VIEWS.map((item) => item.view)).size).toBe(CAMERA_VIEWS.length)
})

test('dragging across the gizmo orbits by 60 degrees', () => {
  expect(GIZMO_SIZE * GIZMO_TURN).toBeCloseTo(Math.PI / 3)
})
