export type Cell = [number, number, number]

export interface CellBounds {
  min: number[]
  max: number[]
}

export function readBlock(
  cell: Cell,
  bounds: CellBounds,
  read: (...cell: Cell) => string | null | undefined
): { cell: Cell; state: string | undefined } | null {
  if (
    !cell.every((n, axis) => Number.isInteger(n) && n >= bounds.min[axis] && n <= bounds.max[axis])
  )
    return null

  const state = read(...cell) ?? undefined
  return {
    cell,
    state: state && !/^(?:minecraft:)?(?:air|cave_air|void_air)$/.test(state) ? state : undefined
  }
}
