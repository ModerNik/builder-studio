// App settings as a query that follows changes made in the main process.
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { Settings } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'

studio.settings.onChanged((s) => queryClient.setQueryData(['settings'], s))

export const useSettings = (): UseQueryResult<Settings> =>
  useQuery({ queryKey: ['settings'], queryFn: () => studio.settings.get() })
export function reloadWorkspace(): void {
  localStorage.removeItem('run-options')
  for (const key of Object.keys(localStorage))
    if (key.startsWith('site:')) localStorage.removeItem(key)
  window.location.reload()
}

export function useMinecraftPack(version?: string): UseQueryResult<string> {
  return useQuery({
    queryKey: ['minecraft-pack', version],
    queryFn: async () => (await studio.minecraft.pack(version)).url,
    enabled: !!version,
    staleTime: 60_000
  })
}
