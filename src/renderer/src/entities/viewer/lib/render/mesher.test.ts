import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { chunksAround, Mesher } from './mesher'
import type { Schematic } from './schematic'

describe('chunksAround', () => {
  it('re-meshes only the chunk of a cell inside it', () => {
    expect([...chunksAround([40, 20, 40], [[5, 5, 5]])]).toEqual([0])
  })

  it('adds the chunks beside a cell on a chunk face', () => {
    // nx = 3, nz = 3: ids count x fastest, then z, then y. The cell is in chunk 9; east is 10, below is 0
    expect([...chunksAround([40, 20, 40], [[15, 16, 0]])].sort((a, b) => a - b)).toEqual([0, 9, 10])
  })

  it('ignores neighbours outside the grid', () => {
    expect([...chunksAround([16, 16, 16], [[0, 0, 0]])]).toEqual([0])
  })
})

describe('Mesher cullData', () => {
  it('culls buried emissive faces against the full schematic data', async () => {
    // 3x3x3 cube of stone with a single sea_lantern buried in the center (1,1,1)
    const palette = ['minecraft:air', 'minecraft:stone', 'minecraft:sea_lantern']
    const full = new Uint16Array(27).fill(1)
    const center = (1 * 3 + 1) * 3 + 1
    full[center] = 2
    const onlyEmissive = new Uint16Array(27)
    onlyEmissive[center] = 2

    const sub: Schematic = { min: [0, 0, 0], size: [3, 3, 3], palette, data: onlyEmissive }
    const mats = [0, 1, 2, 3].map(() => new THREE.MeshBasicMaterial())
    const group = new THREE.Group()

    await new Mesher(sub, null, null, full).build(group, mats)
    expect(group.children).toHaveLength(0)

    // Uncover the top face: exactly 1 quad (4 vertices) should be emitted
    full[(2 * 3 + 1) * 3 + 1] = 0
    await new Mesher(sub, null, null, full).build(group, mats)
    expect(group.children).toHaveLength(1)
    const mesh = group.children[0] as THREE.Mesh
    expect(mesh.geometry.getAttribute('position').count).toBe(4)

    mats.forEach((m) => m.dispose())
    mesh.geometry.dispose()
  })
})
