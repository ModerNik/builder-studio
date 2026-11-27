// The Agent panel's MCP button & single-view quick-connect popover:
// - Shows live companion MCP server address (127.0.0.1:7341/mcp) with instant copy
// - Offers a build-aware copyable chat prompt for external AI agents
// - Offers one-click client setup commands (Claude Code, Codex, Claude Desktop JSON)
// - Lists the active embedded thread's live MCP servers from <workspace>/.mcp.json (plus built-in studio) with toggles
import { useState, type ReactElement } from 'react'
import { ExternalLink, Plug } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { MCP_URL, type McpStatus } from '@shared/api'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover'
import { Switch } from '@/shared/ui/primitives/switch'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { StatusDot } from '@/shared/ui/status/StatusDot'
import type { JobState } from '@/shared/ui/status/state'
import { CopyButton } from '@/shared/ui/common/CopyButton'
import { Tip } from '@/shared/ui/common/Tip'
import { Button } from '@/shared/ui/primitives/button'
import { cn } from '@/shared/lib/utils'
import {
  buildAgentChatPrompt,
  MCP_CLIENT_SNIPPETS,
  workspaceMcpPath,
  type McpClientId
} from '@/shared/lib/mcp-snippets'
import { useBuild } from '@/entities/build/model/builds'
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

const POPOVER_CLIENTS: readonly McpClientId[] = ['claude', 'codex', 'desktop']

function CompactCopyBox({
  code,
  label,
  wrap = false
}: {
  code: string
  label: string
  wrap?: boolean
}): ReactElement {
  return (
    <div className="flex min-w-0 items-start gap-1 rounded-md border border-border-subtle bg-surface-sunken p-1.5 pl-2.5">
      <pre
        aria-label={label}
        tabIndex={0}
        className={cn(
          'focus-ring min-w-0 flex-1 py-0.5 font-mono text-xs text-fg select-text',
          wrap
            ? 'break-words whitespace-pre-wrap'
            : 'max-h-36 overflow-x-auto overflow-y-auto whitespace-pre'
        )}
      >
        {code}
      </pre>
      <CopyButton text={code} label={`Copy ${label}`} size="xs" className="shrink-0" />
    </div>
  )
}

/** Domain-free single-view MCP popover content (reused by Agent panel and /kit). */
export function McpPopoverContent({
  buildName,
  workspace,
  live,
  servers,
  error,
  canToggle = false,
  onToggle,
  onOpenSettings
}: {
  buildName?: string | null
  workspace?: string | null
  live: boolean
  servers: McpStatus[]
  error?: string
  canToggle?: boolean
  onToggle?: (name: string, on: boolean) => void
  onOpenSettings?: () => void
}): ReactElement {
  const [clientId, setClientId] = useState<McpClientId>('claude')
  const prompt = buildAgentChatPrompt(buildName)
  const activeClient = MCP_CLIENT_SNIPPETS.find((c) => c.id === clientId) ?? MCP_CLIENT_SNIPPETS[0]
  const mcpFilePath = workspaceMcpPath(workspace)
  const shortUrl = MCP_URL.replace(/^https?:\/\//, '')

  return (
    <div className="flex flex-col gap-3">
      {/* Header: live companion server URL */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <StatusDot state="done" label="Companion MCP server running" />
          <h4 className="shrink-0 text-sm font-medium text-fg">MCP</h4>
          <code className="min-w-0 truncate rounded-sm bg-surface-sunken px-1.5 py-0.5 font-mono text-2xs text-fg-secondary select-text">
            {shortUrl}
          </code>
        </div>
        <CopyButton text={MCP_URL} label="Copy MCP server URL" size="xs" />
      </div>

      {/* Copyable prompt for external agent chat */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-fg-secondary">
          Paste into your external agent chat
        </span>
        <CompactCopyBox code={prompt} label="agent chat prompt" wrap />
      </div>

      {/* Setup command switcher */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-fg-secondary">Connect client</span>
          <div className="flex items-center gap-0.5" role="tablist" aria-label="MCP client">
            {POPOVER_CLIENTS.map((id) => {
              const item = MCP_CLIENT_SNIPPETS.find((c) => c.id === id)
              if (!item) return null
              const active = id === clientId
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setClientId(id)}
                  className={cn(
                    'focus-ring cursor-pointer rounded-sm px-1.5 py-0.5 text-2xs font-medium transition-colors duration-fast ease-standard',
                    active
                      ? 'bg-accent-subtle text-accent-text'
                      : 'text-fg-muted can-hover:bg-surface-hover can-hover:text-fg'
                  )}
                >
                  {item.shortName}
                </button>
              )
            })}
          </div>
        </div>
        <CompactCopyBox code={activeClient.snippet} label={`${activeClient.name} command`} />
        <p className="text-2xs text-fg-muted">{activeClient.where}</p>
      </div>

      {/* Embedded thread MCP servers */}
      <div className="flex flex-col gap-1.5 border-t border-border-strong/40 pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-fg-secondary">Embedded thread servers</span>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="focus-ring inline-flex cursor-pointer items-center gap-1 rounded-sm text-2xs font-medium text-accent-text can-hover:underline"
            >
              External agents <ExternalLink aria-hidden className="size-3" />
            </button>
          )}
        </div>
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
        {servers.length > 0 && (
          <ul className="flex flex-col gap-1">
            {servers.map((s) => (
              <li
                key={s.name}
                className="flex flex-col gap-0.5 rounded-md bg-surface-raised px-2 py-1"
              >
                <div className="flex min-h-(--density-control-sm) items-center gap-2">
                  <StatusDot state={STATE[s.status] ?? 'idle'} label="" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg">
                    {s.name}
                  </span>
                  <span className="shrink-0 text-2xs text-fg-muted">
                    {s.status}
                    {s.scope && ` · ${s.scope}`}
                  </span>
                  {canToggle &&
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
                        onCheckedChange={(on) => onToggle?.(s.name, on)}
                      />
                    ))}
                </div>
                {s.error && <p className="text-xs break-words text-danger-text">{s.error}</p>}
              </li>
            ))}
          </ul>
        )}
        {servers.every((s) => s.name === 'studio') && (
          <div className="flex flex-col gap-1">
            <p className="text-2xs text-fg-muted">
              {live
                ? 'Add extra servers for the embedded agent in:'
                : 'Send a message to inspect embedded thread servers, or add servers in:'}
            </p>
            <CompactCopyBox code={mcpFilePath} label="MCP config path" wrap />
          </div>
        )}
      </div>
    </div>
  )
}

export function McpButton({
  open,
  setOpen
}: {
  open: boolean
  setOpen(open: boolean): void
}): ReactElement {
  const navigate = useNavigate()
  const id = useThread((t) => t.id)
  const build = useThread((t) => t.build)
  const buildInfo = useBuild(build)
  const buildDisplayName = buildInfo.data?.displayName || build || null
  const live = useThread((t) => t.state.status !== 'off')
  const toggle = useThread((t) => t.state.capabilities.mcpToggle)
  const workspace = useSettings().data?.workspace
  const list = useMcpServers(id, open && live)
  const servers = live ? (list.data ?? []) : []

  const hasFailed = servers.some((s) => s.status === 'failed')
  const needsAuth = servers.some((s) => s.status === 'needs-auth')
  const dotTone = hasFailed
    ? 'bg-danger-solid'
    : needsAuth
      ? 'bg-warning-solid'
      : 'bg-success-solid'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip label="MCP server & external agent commands">
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="MCP servers and connection commands"
            className="h-(--density-control-sm) shrink-0 gap-1.5 px-2 text-xs font-medium text-fg-secondary hover:text-fg"
          >
            <span className="relative inline-flex">
              <Plug aria-hidden className="size-3.5" />
              <span
                aria-hidden
                className={cn('absolute -top-0.5 -right-0.5 size-1.5 rounded-full', dotTone)}
              />
            </span>
            <span className="max-sm:hidden">MCP</span>
          </Button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-3 shadow-lg">
        <McpPopoverContent
          buildName={buildDisplayName}
          workspace={workspace}
          live={live}
          servers={servers}
          error={list.error ? String(list.error) : undefined}
          canToggle={toggle}
          onToggle={(name, on) => void toggleMcp(id, name, on).then(() => list.refetch())}
          onOpenSettings={() => {
            setOpen(false)
            void navigate({ to: '/settings', search: { section: 'agents' } })
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
