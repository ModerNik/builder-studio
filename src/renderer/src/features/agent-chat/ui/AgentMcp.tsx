// The Agent panel's MCP servers: the active thread's live status of each server from <workspace>/.mcp.json
// (plus the built-in studio one), with an on/off switch where the provider supports it.
import type { ReactElement } from 'react'
import { Plug } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover'
import { Switch } from '@/shared/ui/primitives/switch'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { StatusDot } from '@/shared/ui/status/StatusDot'
import type { JobState } from '@/shared/ui/status/state'
import { Tip } from '@/shared/ui/common/Tip'
import { Button } from '@/shared/ui/primitives/button'
import { useSettings } from '@/entities/settings/model/settings'
import { useThread } from '@/features/agent-chat/model/agent'
import { toggleMcp, useMcpServers } from '@/features/agent-chat/model/mcp'

const STATE: Record<string, JobState> = {
  connected: 'done',
  failed: 'failed',
  'needs-auth': 'awaiting-approval',
  pending: 'queued',
  disabled: 'cancelled'
}

export function McpButton({
  open,
  setOpen
}: {
  open: boolean
  setOpen(open: boolean): void
}): ReactElement {
  const id = useThread((t) => t.id)
  const live = useThread((t) => t.state.status !== 'off')
  const toggle = useThread((t) => t.state.capabilities.mcpToggle)
  const workspace = useSettings().data?.workspace
  const list = useMcpServers(id, open && live)
  const servers = live ? (list.data ?? []) : []
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip label="MCP servers">
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            aria-label="MCP servers"
            className="size-(--density-control-sm) shrink-0 p-0 text-fg-secondary hover:text-fg"
          >
            <Plug aria-hidden className="size-3.5" />
          </Button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="end" className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-1 p-2">
        <h4 className="px-1 font-medium">MCP servers</h4>
        {list.error && (
          <InlineNotice tone="danger" className="px-1">
            {String(list.error)}
          </InlineNotice>
        )}
        <ul className="flex flex-col">
          {servers.map((s) => (
            <li key={s.name} className="flex flex-col gap-0.5 rounded-md px-1 py-1">
              <div className="flex min-h-(--density-row) items-center gap-2">
                <StatusDot state={STATE[s.status] ?? 'idle'} label="" />
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{s.name}</span>
                <span className="text-sm text-fg-secondary">
                  {s.status}
                  {s.scope && ` · ${s.scope}`}
                </span>
                {toggle &&
                  (s.name === 'studio' ? (
                    <Tip label="Built in, always on">
                      <span tabIndex={0} className="inline-flex rounded-full">
                        <Switch aria-label="Enable studio" checked disabled />
                      </span>
                    </Tip>
                  ) : (
                    <Switch
                      aria-label={`Enable ${s.name}`}
                      checked={s.status !== 'disabled'}
                      onCheckedChange={(on) =>
                        void toggleMcp(id, s.name, on).then(() => list.refetch())
                      }
                    />
                  ))}
              </div>
              {s.error && <p className="text-sm break-words text-danger-text">{s.error}</p>}
            </li>
          ))}
        </ul>
        {servers.every((s) => s.name === 'studio') && (
          <p className="px-1 text-sm text-fg-secondary">
            {live
              ? 'Add servers'
              : 'Send a message to start the agent, then see its servers. Add them'}{' '}
            in <span className="font-mono break-all">{workspace ?? '<workspace>'}/.mcp.json</span>.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
