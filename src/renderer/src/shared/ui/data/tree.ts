export type TreeNode = {
  id: string
  label: string
  children?: TreeNode[]
}

export type TreeRow<N extends TreeNode = TreeNode> = {
  node: N
  level: number
  parent: string | null
  hasChildren: boolean
}

/** The rows a tree shows: depth first, children only under expanded nodes. */
export function visibleRows<N extends TreeNode>(
  nodes: N[],
  expanded: ReadonlySet<string>,
  level = 1,
  parent: string | null = null,
  out: TreeRow<N>[] = []
): TreeRow<N>[] {
  for (const node of nodes) {
    const kids = (node.children ?? []) as N[]
    out.push({ node, level, parent, hasChildren: kids.length > 0 })
    if (kids.length && expanded.has(node.id)) visibleRows(kids, expanded, level + 1, node.id, out)
  }
  return out
}

export type TreeMove = { focus?: string; expand?: string; collapse?: string }

/** What a key does on the focused row (WAI-ARIA tree pattern); null for keys the tree ignores. */
export function treeKey(
  rows: TreeRow[],
  focus: string,
  key: string,
  expanded: ReadonlySet<string>
): TreeMove | null {
  const i = rows.findIndex((r) => r.node.id === focus)
  if (i < 0) return rows.length ? { focus: rows[0].node.id } : null
  const row = rows[i]
  switch (key) {
    case 'ArrowDown':
      return { focus: rows[Math.min(rows.length - 1, i + 1)].node.id }
    case 'ArrowUp':
      return { focus: rows[Math.max(0, i - 1)].node.id }
    case 'Home':
      return { focus: rows[0].node.id }
    case 'End':
      return { focus: rows[rows.length - 1].node.id }
    case 'ArrowRight':
      if (!row.hasChildren) return {}
      return expanded.has(row.node.id) ? { focus: rows[i + 1]?.node.id } : { expand: row.node.id }
    case 'ArrowLeft':
      if (row.hasChildren && expanded.has(row.node.id)) return { collapse: row.node.id }
      return row.parent ? { focus: row.parent } : {}
    default:
      return null
  }
}

/** Ids of the node and everything under it, for selecting a whole branch. */
export function branchIds(node: TreeNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(branchIds)]
}
