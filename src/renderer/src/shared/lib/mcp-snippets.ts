// Shared companion MCP connection snippets and chat prompts, reused by Settings › External agents
// and the Agent panel's MCP popover so commands never drift out of sync.
import { MCP_URL } from '@shared/api'

export type McpClientId = 'claude' | 'codex' | 'codex-timeout' | 'desktop'

export interface McpClientSnippet {
  id: McpClientId
  name: string
  shortName: string
  where: string
  snippet: string
}

export const MCP_CLIENT_SNIPPETS: readonly McpClientSnippet[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    shortName: 'Claude Code',
    where: 'Run in a terminal, from the workspace.',
    snippet: `claude mcp add --transport http builder-studio ${MCP_URL}`
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    shortName: 'Codex',
    where: 'Run in a terminal.',
    snippet: `codex mcp add builder-studio --url ${MCP_URL}`
  },
  {
    id: 'codex-timeout',
    name: 'Codex CLI: review timeout',
    shortName: 'Codex timeout',
    where: 'In ~/.codex/config.toml, so request_review can wait for you.',
    snippet: `[mcp_servers.builder-studio]\nurl = "${MCP_URL}"\ntool_timeout_sec = 86400`
  },
  {
    id: 'desktop',
    name: 'Claude Desktop',
    shortName: 'Desktop JSON',
    where:
      'In %APPDATA%\\Claude\\claude_desktop_config.json (needs Node), then restart Claude Desktop. It only ' +
      'launches local servers, so mcp-remote bridges to this one.',
    snippet: JSON.stringify(
      { mcpServers: { 'builder-studio': { command: 'npx', args: ['-y', 'mcp-remote', MCP_URL] } } },
      null,
      2
    )
  }
]

/** Ready-to-paste prompt telling an external AI agent chat how to connect and work on the open build. */
export function buildAgentChatPrompt(buildName?: string | null): string {
  const target = buildName?.trim()
  if (target) {
    return `Use the builder-studio MCP server (${MCP_URL}). Call guide() first, then help me work on build "${target}".`
  }
  return `Use the builder-studio MCP server (${MCP_URL}). Call guide() first, then help me with my current build in Builder Studio.`
}

/** Workspace-relative or absolute path to the embedded agent's .mcp.json configuration file. */
export function workspaceMcpPath(workspace?: string | null): string {
  if (!workspace) return '<workspace>/.mcp.json'
  const sep = workspace.includes('\\') ? '\\' : '/'
  return `${workspace.replace(/[\\/]+$/, '')}${sep}.mcp.json`
}
