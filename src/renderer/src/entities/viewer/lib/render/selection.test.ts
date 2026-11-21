import { expect, it } from 'vitest'
import * as THREE from 'three'
import { selectionPass } from './selection'
import { SchematicObject } from './renderer'

it('keeps exact packed depth, hides occluded edges and clips the selection mask', () => {
  const pass = selectionPass(new THREE.Scene(), new THREE.OrthographicCamera())
  expect(pass.renderTargetDepthBuffer.texture.type).toBe(THREE.UnsignedByteType)
  expect(pass.renderTargetDepthBuffer.texture.magFilter).toBe(THREE.NearestFilter)
  expect(pass.hiddenEdgeColor.getHex()).toBe(0)
  expect(pass.edgeGlow).toBe(0)
  expect(pass.prepareMaskMaterial.clipping).toBe(true)
  expect(pass.prepareMaskMaterial.fragmentShader).toContain('clipping_planes_fragment')
  expect(pass.overlayMaterial.fragmentShader).toContain('(1.0 - mask.g) * 0.15')
  pass.dispose()
})

it('reuses the same geometry for selection and isolation without writing selection depth or shadows', () => {
  const object = new SchematicObject(
    'part',
    {
      min: [20, 5, 30],
      size: [1, 1, 1],
      palette: ['minecraft:air', 'minecraft:stone'],
      data: new Uint16Array([1])
    },
    null
  )
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), object.materials[0])
  object.group.add(mesh)
  object.maskOnly = true
  expect(object.materials.every((m) => !m.colorWrite && !m.depthWrite)).toBe(true)
  expect(mesh.castShadow).toBe(false)
  // Applying the opaque-glass look while masked must survive switching to isolation.
  object.materials[2].transparent = false
  object.maskOnly = false
  expect(object.materials[0].colorWrite).toBe(true)
  expect(object.materials[0].depthWrite).toBe(true)
  expect(object.materials[2].depthWrite).toBe(true)
  expect(object.group.children[0]).toBe(mesh)
  expect(object.box.min).toEqual([20, 5, 30])
  object.dispose()
})
