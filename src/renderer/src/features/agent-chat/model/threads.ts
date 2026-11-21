// The thread switcher's stored sessions: the build's session list, and renaming, forking and removing a session.
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { AgentSession, Provider } from '@shared/api'
import { studio } from '@/shared/api/studio'
import { closeThread, openSession, type Thread } from './agent'

export const useAgentSessions = (
  provider: Provider,
  build: string
): UseQueryResult<AgentSession[]> =>
  useQuery({
    queryKey: ['agent-sessions', provider, build],
    queryFn: () => studio.agent.sessions(build),
    enabled: !!build
  })

export const renameSession = (s: AgentSession, title: string): Promise<void> =>
  studio.agent.rename({ provider: s.provider, id: s.id }, title)

export const forkSession = (s: AgentSession, build: string): Promise<void> =>
  studio.agent.fork({ provider: s.provider, id: s.id }, build).then(openSession)

export async function removeSession(s: AgentSession, threads: Thread[]): Promise<void> {
  const live = threads.find((t) => t.session === s.id)
  if (live) await closeThread(live.id)
  await studio.agent.remove({ provider: s.provider, id: s.id })
}
