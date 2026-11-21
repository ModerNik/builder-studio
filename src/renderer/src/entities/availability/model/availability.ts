// What the app can do right now, and engine bridge calls, which wait for the feature they need.
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { Availability, BridgeMethod, BridgeMethods } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'

studio.availability.onChanged(
  () =>
    void queryClient
      .cancelQueries({ queryKey: ['availability'] })
      .then(() => queryClient.invalidateQueries({ queryKey: ['availability'] }))
)
export const cancelRuntime = (): void => void studio.runtime.cancel()

export const useAvailability = (): UseQueryResult<Availability> =>
  useQuery({
    queryKey: ['availability'],
    queryFn: () => studio.availability.get(),
    staleTime: 60_000
  })

export function useBridge<M extends BridgeMethod>(
  method: M,
  params: BridgeMethods[M]['params'] | null,
  minecraftVersion?: string
): UseQueryResult<BridgeMethods[M]['result']> {
  const availability = useAvailability().data
  return useQuery({
    queryKey: ['bridge', method, params, minecraftVersion],
    queryFn: () => studio.bridge.call(method, params!, undefined, minecraftVersion),
    enabled:
      params !== null &&
      !!availability?.features[['render', 'compare'].includes(method) ? 'render' : 'engine'].ok
  })
}
