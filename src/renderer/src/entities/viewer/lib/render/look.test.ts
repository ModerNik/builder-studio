import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { fitDirectionalShadow } from './look'

describe('fitDirectionalShadow', () => {
  it('fits every corner of a large flat building tightly inside the shadow frustum', () => {
    const sun = new THREE.DirectionalLight(0xffffff, Math.PI)
    const box = new THREE.Box3(new THREE.Vector3(-200, 0, -200), new THREE.Vector3(200, 30, 200))
    const dir = new THREE.Vector3(0.5, 0.7, -0.5).normalize()

    fitDirectionalShadow(sun, box, dir, 4096, true)

    const cam = sun.shadow.camera
    expect(cam.near).toBeGreaterThan(0)
    expect(cam.far).toBeGreaterThan(cam.near)
    expect(sun.shadow.normalBias).toBeGreaterThan(0)

    cam.updateMatrixWorld(true)
    const projView = new THREE.Matrix4().multiplyMatrices(
      cam.projectionMatrix,
      cam.matrixWorldInverse
    )
    for (let i = 0; i < 8; i++) {
      const corner = new THREE.Vector3(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z
      ).applyMatrix4(projView)
      expect(Math.abs(corner.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(corner.y)).toBeLessThanOrEqual(1)
      expect(corner.z).toBeGreaterThanOrEqual(-1)
      expect(corner.z).toBeLessThanOrEqual(1)
    }
  })

  it('handles overhead sun without NaN frustum values', () => {
    const sun = new THREE.DirectionalLight(0xffffff, Math.PI)
    const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(40, 20, 40))

    fitDirectionalShadow(sun, box, new THREE.Vector3(0, 1, 0), 2048, false)

    const cam = sun.shadow.camera
    expect(Number.isFinite(cam.left)).toBe(true)
    expect(Number.isFinite(cam.right)).toBe(true)
    expect(Number.isFinite(cam.near)).toBe(true)
    expect(Number.isFinite(cam.far)).toBe(true)
  })
})
