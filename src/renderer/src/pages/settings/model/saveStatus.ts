// Whether a settings save is running and how the last one ended, for the header's save status.
import { useIsMutating, useMutationState, type MutationStatus } from '@tanstack/react-query'

export function useSaveStatus(): { saving: boolean; last: MutationStatus | undefined } {
  const saving = useIsMutating({ mutationKey: ['settings', 'save'] }) > 0
  const last = useMutationState({
    filters: { mutationKey: ['settings', 'save'] },
    select: (m) => m.state.status
  }).at(-1)
  return { saving, last }
}
