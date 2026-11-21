// Settings › External agents: how to point Claude Code, Codex or Claude Desktop at the companion MCP server.
import type { ReactElement } from 'react'
import { CopyButton } from '@/shared/ui/common/CopyButton'
import {
  CopySnippet,
  SettingsPanel,
  SettingsRow,
  SettingsSection
} from '@/entities/settings/ui/Settings'
import { MCP_URL } from '@shared/api'

const CLIENTS: { name: string; where: string; snippet: string }[] = [
  {
    name: 'Claude Code',
    where: 'Run in a terminal, from the workspace.',
    snippet: `claude mcp add --transport http builder-studio ${MCP_URL}`
  },
  {
    name: 'Codex CLI',
    where: 'Run in a terminal.',
    snippet: `codex mcp add builder-studio --url ${MCP_URL}`
  },
  {
    name: 'Codex CLI: review timeout',
    where: 'In ~/.codex/config.toml, so request_review can wait for you.',
    snippet: `[mcp_servers.builder-studio]\nurl = "${MCP_URL}"\ntool_timeout_sec = 86400`
  },
  {
    name: 'Claude Desktop',
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

const code = 'font-mono text-sm'

export function Agents(): ReactElement {
  return (
    <div className="flex flex-col gap-8">
      <SettingsPanel>
        <SettingsRow title="Server address" detail={MCP_URL} mono>
          <CopyButton text={MCP_URL} label="Copy server address" />
        </SettingsRow>
      </SettingsPanel>
      <SettingsSection id="h-clients" title="Connect a client">
        <SettingsPanel>
          {CLIENTS.map((c) => (
            <SettingsRow
              key={c.name}
              title={c.name}
              detail={c.where}
              below={<CopySnippet code={c.snippet} label={c.name} />}
            />
          ))}
        </SettingsPanel>
        <p className="max-w-prose text-sm text-fg-secondary">
          The agent should call the <code className={code}>guide</code> tool first: it returns the
          workspace, the Python command and the build workflow.{' '}
          <code className={code}>request_review</code> waits until you send or decline the review;
          if the client gives up first, raise its tool timeout (Claude Code: a longer{' '}
          <code className={code}>MCP_TOOL_TIMEOUT</code>, in milliseconds). Only this PC can
          connect, and web pages can’t reach the server.
        </p>
      </SettingsSection>
    </div>
  )
}
