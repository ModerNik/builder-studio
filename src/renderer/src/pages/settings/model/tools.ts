// Settings › Build tools: the runtime's checks and install state, workspace Git and the history identity.
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { RuntimeAction, RuntimeState } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads all of it
export function useRuntimeTools() {
  const delivery = useQuery({ queryKey: ['runtime-delivery'], queryFn: studio.runtime.delivery })
  const [state, setState] = useState<RuntimeState>({ busy: false, stage: 'idle' })
  const checks = useQuery({
    queryKey: ['runtime-diagnostics'],
    queryFn: studio.runtime.diagnose,
    enabled: !state.busy,
    retry: false
  })
  useEffect(() => {
    void studio.runtime.state().then(setState)
    return studio.runtime.onState((s) => {
      setState(s)
      if (!s.busy) void queryClient.invalidateQueries()
    })
  }, [])
  const install = useMutation({
    mutationFn: (action: RuntimeAction) => studio.runtime.install(action),
    onSettled: () => void checks.refetch()
  })
  const bootstrap = useMutation({ mutationFn: () => studio.workspace.bootstrap() })
  return { delivery, state, checks, install, bootstrap }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads all of it
export function useSaveIdentity(name: string, email: string, onSaved: () => void) {
  return useMutation({
    mutationFn: () => studio.runtime.identity(name, email),
    onSuccess: onSaved
  })
}
