// What the Agent panel does besides rendering: rename and fork the active thread, edit or rewind a turn, and send a
// permission answer to the active thread.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Permit, Provider, SessionRef } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { newThread, openSession, send, setThreadTitle, useAgent } from './agent'

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

export async function forkThread(ref: SessionRef, build: string, point?: string): Promise<void> {
  try {
    const fork = await studio.agent.fork(ref, build, point)
    await openSession(fork, build)
    void queryClient.invalidateQueries({ queryKey: ['agent-sessions', ref.provider, build] })
    toast.success(point ? 'Forked conversation from this turn.' : 'Forked conversation.')
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

export async function editMessageTurn(
  ref: SessionRef,
  build: string,
  point: string,
  text: string,
  files: string[] | null,
  attachments?: string[]
): Promise<void> {
  const fork = await studio.agent.rewind(ref, build, point, files)
  if (fork) await openSession(fork, build)
  else newThread(build)
  void queryClient.invalidateQueries({ queryKey: ['agent-sessions', ref.provider, build] })
  await send(text, { attachments })
}

export const permitActive = (p: Permit): void =>
  void studio.agent.permit(useAgent.getState().active, p)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- callers read the query state
export function useRewindPreview(refId: SessionRef | null, build: string, point: string | null) {
  return useQuery({
    queryKey: ['agent-rewind-files', refId, build, point],
    queryFn: () => studio.agent.rewindPreview(refId!, build, point!),
    enabled: !!refId && !!point,
    staleTime: 0,
    retry: false
  })
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the dialog reads all of it
export function useRewind(
  refId: SessionRef,
  build: string,
  onClose: () => void,
  initialPoint = ''
) {
  const [point, setPoint] = useState(initialPoint)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string>()
  const points = useQuery({
    queryKey: ['agent-rewind-points', refId],
    queryFn: () => studio.agent.rewindPoints(refId),
    staleTime: 0
  })
  const resolvedPoint =
    points.data && point && !points.data.some((p) => p.id === point) ? '' : point
  const preview = useRewindPreview(refId, build, resolvedPoint || null)
  const rewind = async (files: string[] | null): Promise<void> => {
    if (running || !resolvedPoint) return
    setRunning(true)
    setError(undefined)
    try {
      const fork = await studio.agent.rewind(refId, build, resolvedPoint, files)
      if (fork) await openSession(fork, build)
      else newThread(build)
      void queryClient.invalidateQueries({ queryKey: ['agent-sessions', refId.provider, build] })
      onClose()
    } catch (e) {
      setError(errorMessage(e))
      void preview.refetch()
    } finally {
      setRunning(false)
    }
  }
  return { point: resolvedPoint, setPoint, running, error, setError, points, preview, rewind }
}
