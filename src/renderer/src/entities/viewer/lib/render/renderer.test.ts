import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CameraManager, computeClipPlanes } from './renderer'

function fakeDom(): HTMLElement {
  const noop = (): void => {}
  const doc = { addEventListener: noop, removeEventListener: noop }
  return {
    style: {},
    clientWidth: 1280,
    clientHeight: 960,
    ownerDocument: doc,
    addEventListener: noop,
    removeEventListener: noop,
    setPointerCapture: noop,
    releasePointerCapture: noop,
    getRootNode: () => doc
  } as unknown as HTMLElement
}

describe('computeClipPlanes', () => {
  it('keeps depth precision tight and never clips builds of any size when zoomed out', () => {
    for (const [radius, dist] of [
      [10, 40],
      [150, 500],
      [400, 1500],
      [2000, 8000]
    ]) {
      const { near, far } = computeClipPlanes('perspective', dist, dist, radius)
      expect(near).toBeGreaterThan(0.05)
      expect(near).toBeLessThan(dist - radius)
      expect(far).toBeGreaterThan(dist + radius)
      expect(far / near).toBeLessThan(500)
    }
  })

  it('shrinks near cleanly for close-up interior inspection', () => {
    const { near, far } = computeClipPlanes('perspective', 40, 8, 200)
    expect(near).toBeLessThanOrEqual(0.1)
    expect(near).toBeGreaterThanOrEqual(0.05)
    expect(far).toBeGreaterThan(200)
  })

  it('keeps isometric near positive for SSAO and expands far for huge builds', () => {
    const { near, far } = computeClipPlanes('isometric', 1500, 1500, 600)
    expect(near).toBeGreaterThan(0)
    expect(far).toBeGreaterThan(1500 + 600)
  })
})

describe('CameraManager', () => {
  it('keeps all corners of a huge build inside the frustum and clip planes when framing', () => {
    const cm = new CameraManager(fakeDom())
    const box = new THREE.Box3(new THREE.Vector3(-250, 0, -250), new THREE.Vector3(250, 120, 250))
    const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
      (i) =>
        new THREE.Vector3(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z
        )
    )
    for (const projection of ['isometric', 'perspective'] as const) {
      cm.setAspect(4 / 3)
      cm.frame(box, new THREE.Vector3(1, 0.7, 1), projection)
      cm.active.updateMatrixWorld(true)
      for (const c of corners) {
        const ndc = c.clone().project(cm.active)
        expect(Math.abs(ndc.x)).toBeLessThanOrEqual(1)
        expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1)
        expect(ndc.z).toBeGreaterThanOrEqual(-1)
        expect(ndc.z).toBeLessThanOrEqual(1)
      }
    }
    cm.dispose()
  })

  it('pulls the orthographic camera outside the build bounds when switching from a close perspective view', () => {
    const cm = new CameraManager(fakeDom())
    const box = new THREE.Box3(new THREE.Vector3(-200, 0, -200), new THREE.Vector3(200, 100, 200))
    const centre = box.getCenter(new THREE.Vector3())
    const radius = box.getSize(new THREE.Vector3()).length() / 2
    cm.setBounds(box)
    cm.lookAt(new THREE.Vector3(10, 20, 10), centre)
    cm.setProjection('isometric')
    expect(cm.ortho.position.distanceTo(centre)).toBeGreaterThanOrEqual(radius * 2.49)
    expect(cm.ortho.far).toBeGreaterThan(cm.ortho.position.distanceTo(centre) + radius)
    cm.dispose()
  })
})
