// What the Agent panel does besides rendering: rename and fork the active thread, rewind a session, and send a
// permission answer to the active thread.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Permit, Provider, SessionRef } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { newThread, openSession, setThreadTitle, useAgent } from './agent'

export async function renameThread(
  ref: SessionRef | null,
  id: string,
  provider: Provider,
  build: string,
  name: string
): Promise<void> {
  if (ref) await studio.agent.rename(ref, name)
  setThreadTitle(id, name)
  void queryClient.invalidateQueries({ queryKey: ['agent-sessions', provider, build] })
}

export const forkThread = (ref: SessionRef, build: string): void =>
  void studio.agent
    .fork(ref, build)
    .then((fork) => openSession(fork, build))
    .catch((e) => toast.error(errorMessage(e)))

export const permitActive = (p: Permit): void =>
  void studio.agent.permit(useAgent.getState().active, p)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the dialog reads all of it
export function useRewind(refId: SessionRef, build: string, onClose: () => void) {
  const [point, setPoint] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string>()
  const points = useQuery({
    queryKey: ['agent-rewind-points', refId],
    queryFn: () => studio.agent.rewindPoints(refId),
    staleTime: 0
  })
  const preview = useQuery({
    queryKey: ['agent-rewind-files', refId, build, point],
    queryFn: () => studio.agent.rewindPreview(refId, build, point),
    enabled: !!point,
    staleTime: 0,
    retry: false
  })
  const rewind = async (files: string[] | null): Promise<void> => {
    if (running) return
    setRunning(true)
    setError(undefined)
    try {
      const fork = await studio.agent.rewind(refId, build, point, files)
      if (fork) await openSession(fork, build)
      else newThread(build)
      onClose()
    } catch (e) {
      setError(errorMessage(e))
      void preview.refetch()
    } finally {
      setRunning(false)
    }
  }
  return { point, setPoint, running, error, setError, points, preview, rewind }
}
