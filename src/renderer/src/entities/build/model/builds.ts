// The build list as a query that follows the workspace watcher, and what the agent asked to show.
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { create } from 'zustand'
import type { BuildSummary } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'

studio.builds.onChanged(() => void queryClient.invalidateQueries({ queryKey: ['builds'] }))

export const useBuilds = (): UseQueryResult<BuildSummary[]> =>
  useQuery({ queryKey: ['builds'], queryFn: () => studio.builds.list() })
export const useBuild = (
  name: string
): Omit<UseQueryResult<BuildSummary[]>, 'data'> & { data: BuildSummary | undefined } => {
  const q = useBuilds()
  return { ...q, data: q.data?.find((b) => b.name === name) }
}

/** The last version (MCP show) or sheet (show_sheet) the agent asked to show: the workspace opens it. */
export const useShow = create<{ path: string | null; sheet: string | null; t: number }>(() => ({
  path: null,
  sheet: null,
  t: 0
}))
