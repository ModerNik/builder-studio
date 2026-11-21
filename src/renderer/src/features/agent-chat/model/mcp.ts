// The active thread's MCP servers: their live status, and switching one on or off.
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { studio } from '@/shared/api/studio'
import { errorMessage } from '@/shared/ui/feedback/errors'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the popover reads all of it
export const useMcpServers = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['agent-mcp', id],
    queryFn: () => studio.agent.mcp(id),
    enabled
  })

export const toggleMcp = (id: string, name: string, on: boolean): Promise<void> =>
  studio.agent.mcpToggle(id, name, on).catch((err) => void toast.error(errorMessage(err)))
