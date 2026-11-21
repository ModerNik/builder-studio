// The Agent composer's queries and calls: the provider's models and commands, attaching a file, and applying a
// model pick to a live thread.
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AgentModel, Effort, Provider } from '@shared/api'
import { studio } from '@/shared/api/studio'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { agentModelsQuery } from './agent'

export const useAgentModels = (provider: Provider): UseQueryResult<AgentModel[]> =>
  useQuery(agentModelsQuery(provider))

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the composer reads all of it
export const useAgentCommands = (provider: Provider, id: string, live: boolean) =>
  useQuery({
    queryKey: ['agent-commands', provider, live ? id : null],
    queryFn: () => studio.agent.commands(live ? id : null)
  })

export const attachFile = async (build: string, name: string, f: File): Promise<string> =>
  studio.agent.attach(build, name, new Uint8Array(await f.arrayBuffer()))

export const configureModel = (id: string, model: string, effort: Effort | null): void =>
  void studio.agent
    .configure(id, model, effort)
    .catch((e) => toast.error('Couldn’t apply model settings. ' + errorMessage(e)))
