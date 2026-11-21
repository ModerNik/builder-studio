// The voxel diff of two versions: the bridge's diff(a, b, tint) call as a query.
import { useQuery } from '@tanstack/react-query'
import { studio } from '@/shared/api/studio'
import type { ComparedVersion } from './comparison'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads all of it
export function useVoxelDiff(
  a: ComparedVersion,
  b: ComparedVersion,
  minecraftVersion: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['diff', a.path, a.mtime, b.path, b.mtime, minecraftVersion],
    queryFn: () =>
      studio.bridge.call('diff', { a: a.path, b: b.path, tint: true }, undefined, minecraftVersion),
    enabled
  })
}
