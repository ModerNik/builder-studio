import { describe, expect, it } from 'vitest'
import { branchIds, treeKey, visibleRows, type TreeNode } from './tree'

const tree: TreeNode[] = [
  {
    id: 'keep',
    label: 'keep',
    children: [
      { id: 'keep/walls', label: 'walls' },
      { id: 'keep/roof', label: 'roof', children: [{ id: 'keep/roof/ridge', label: 'ridge' }] }
    ]
  },
  { id: 'bridge', label: 'bridge' }
]

describe('visibleRows', () => {
  it('hides children of collapsed nodes and tracks level and parent', () => {
    expect(visibleRows(tree, new Set()).map((r) => r.node.id)).toEqual(['keep', 'bridge'])
    const rows = visibleRows(tree, new Set(['keep', 'keep/roof']))
    expect(rows.map((r) => [r.node.id, r.level, r.parent])).toEqual([
      ['keep', 1, null],
      ['keep/walls', 2, 'keep'],
      ['keep/roof', 2, 'keep'],
      ['keep/roof/ridge', 3, 'keep/roof'],
      ['bridge', 1, null]
    ])
  })
})

describe('treeKey', () => {
  const open = new Set(['keep'])
  const rows = visibleRows(tree, open)
  it('moves with the arrows and stops at the ends', () => {
    expect(treeKey(rows, 'keep', 'ArrowDown', open)).toEqual({ focus: 'keep/walls' })
    expect(treeKey(rows, 'bridge', 'ArrowDown', open)).toEqual({ focus: 'bridge' })
    expect(treeKey(rows, 'keep', 'ArrowUp', open)).toEqual({ focus: 'keep' })
    expect(treeKey(rows, 'keep/roof', 'Home', open)).toEqual({ focus: 'keep' })
    expect(treeKey(rows, 'keep', 'End', open)).toEqual({ focus: 'bridge' })
  })
  it('expands, enters, collapses and climbs with right and left', () => {
    expect(treeKey(rows, 'keep/roof', 'ArrowRight', open)).toEqual({ expand: 'keep/roof' })
    expect(treeKey(rows, 'keep', 'ArrowRight', open)).toEqual({ focus: 'keep/walls' })
    expect(treeKey(rows, 'keep', 'ArrowLeft', open)).toEqual({ collapse: 'keep' })
    expect(treeKey(rows, 'keep/walls', 'ArrowLeft', open)).toEqual({ focus: 'keep' })
    expect(treeKey(rows, 'bridge', 'ArrowLeft', open)).toEqual({})
    expect(treeKey(rows, 'keep/walls', 'ArrowRight', open)).toEqual({})
  })
  it('ignores other keys and recovers a lost focus', () => {
    expect(treeKey(rows, 'keep', 'a', open)).toBeNull()
    expect(treeKey(rows, 'gone', 'ArrowDown', open)).toEqual({ focus: 'keep' })
  })
})

describe('branchIds', () => {
  it('lists a node and all its descendants', () => {
    expect(branchIds(tree[0])).toEqual(['keep', 'keep/walls', 'keep/roof', 'keep/roof/ridge'])
  })
})
