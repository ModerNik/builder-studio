// The blocks of a build's Minecraft version, from the engine's catalog.
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { BlockInfo } from '@shared/api'
import { studio } from '@/shared/api/studio'

export const useBlockRegistry = (minecraftVersion: string): UseQueryResult<BlockInfo[] | null> =>
  useQuery({
    queryKey: ['blocks', minecraftVersion],
    queryFn: () => studio.blocks.list(minecraftVersion),
    staleTime: Infinity
  })
