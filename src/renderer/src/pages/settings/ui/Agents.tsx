// Settings › External agents: how to point Claude Code, Codex or Claude Desktop at the companion MCP server.
import type { ReactElement } from 'react'
import { CopyButton } from '@/shared/ui/common/CopyButton'
import {
  CopySnippet,
  SettingsPanel,
  SettingsRow,
  SettingsSection
} from '@/entities/settings/ui/Settings'
import { MCP_CLIENT_SNIPPETS } from '@/shared/lib/mcp-snippets'
import { MCP_URL } from '@shared/api'

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
          {MCP_CLIENT_SNIPPETS.map((c) => (
            <SettingsRow
              key={c.id}
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
