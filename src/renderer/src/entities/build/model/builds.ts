// The build list as a query that follows the workspace watcher, and what the agent asked to show.
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { create } from 'zustand'
import type { BuildSummary } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'

studio.builds.onChanged(() => {
  void queryClient.invalidateQueries({ queryKey: ['builds'] })
  void queryClient.invalidateQueries({ queryKey: ['design'] })
  void queryClient.invalidateQueries({ queryKey: ['rounds'] })
  void queryClient.invalidateQueries({ queryKey: ['refs'] })
})

export const useBuilds = (): UseQueryResult<BuildSummary[]> =>
  useQuery({ queryKey: ['builds'], queryFn: () => studio.builds.list() })
export const useBuild = (
  name: string
): Omit<UseQueryResult<BuildSummary[]>, 'data'> & { data: BuildSummary | undefined } => {
  const q = useBuilds()
  return { ...q, data: q.data?.find((b) => b.name === name) }
}

export type ShowRequest = { path: string | null; sheet: string | null; t: number }

const EMPTY_SHOW: ShowRequest = { path: null, sheet: null, t: 0 }

/** A one-shot request to open a version (MCP show) or preview sheet (show_sheet) in the workspace. */
export const useShow = create<ShowRequest>(() => EMPTY_SHOW)

/** Returns what a pending show request asks `build` to open, or null if empty or for another build. */
export function matchShow(
  shown: ShowRequest,
  build: string
): { path: string } | { sheet: string } | null {
  const prefix = `builds/${build}/out/`
  if (shown.path?.startsWith(prefix)) return { path: shown.path }
  if (shown.sheet?.startsWith(prefix)) return { sheet: shown.sheet }
  return null
}

/** Clears `shown` once the workspace has consumed it, leaving newer requests untouched. */
export function clearShow(shown: ShowRequest): void {
  if (useShow.getState() === shown) useShow.setState(EMPTY_SHOW)
}
