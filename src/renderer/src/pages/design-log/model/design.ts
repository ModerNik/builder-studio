// The Design log's reads and writes: DESIGN.md, the saved review rounds, and the save with its cache refresh.
import { useQuery } from '@tanstack/react-query'
import type { BuildSummary } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads all of it
export function useDesignLog(name: string, build: BuildSummary | undefined) {
  // the watcher bumps build.mtime only for out/, so refetch on any builds change
  const md = useQuery({
    queryKey: ['design', name, build],
    queryFn: () => studio.design.read(name)
  })
  const rounds = useQuery({ queryKey: ['rounds', name], queryFn: () => studio.review.list(name) })
  return { md, rounds }
}

export const writeDesign = (name: string, base: string, md: string): Promise<void> =>
  studio.design.write(name, base, md)

export function designSaved(name: string): void {
  void queryClient.invalidateQueries({ queryKey: ['design', name] })
  void queryClient.invalidateQueries({ queryKey: ['builds'] })
}
