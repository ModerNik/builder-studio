import { useState, type ReactElement } from 'react'
import { CircleCheck, KeyRound } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import {
  CopySnippet,
  SettingsPanel,
  SettingsRow,
  SettingsSection
} from '@/entities/settings/ui/Settings'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { MCP_URL } from '@shared/api'
import { MinecraftVersionSelect } from '@/entities/settings/ui/MinecraftVersionSelect'
import { Cell, Narrow, Sub, Touch } from '../composites-demo'

export const meta = { group: 'Settings', title: 'Settings layout' }

function Demo({ p }: { p: string }): ReactElement {
  const [dry, setDry] = useState(true)
  return (
    <SettingsSection
      id={`${p}-minecraft`}
      title="Minecraft"
      lead="Choose the default target, game files and export destination."
    >
      <SettingsPanel>
        <SettingsRow
          title="Default Minecraft target"
          detail="New builds and Labs use this version unless you choose another."
        >
          <MinecraftVersionSelect value="26.3" onChange={() => {}} />
        </SettingsRow>
        <SettingsRow
          title="Minecraft 26.3 game files"
          detail="D:\\Games\\Minecraft\\versions\\26.3\\26.3.jar"
          mono
        >
          <Button variant="outline">Change…</Button>
        </SettingsRow>
        <SettingsRow
          title="Exported schematics folder"
          detail="Finalize copies the checked .litematic here."
          htmlFor={`${p}-schematics`}
          below={
            <InlineNotice tone="warning">
              Not set: Export runs as a dry run until it is.
            </InlineNotice>
          }
        >
          <Input
            id={`${p}-schematics`}
            placeholder="C:\Users\you\AppData\Roaming\.minecraft\schematics"
            className="h-(--density-control) w-72 max-w-full font-mono text-sm"
          />
          <Button variant="outline" className="h-(--density-control)">
            Browse…
          </Button>
        </SettingsRow>
        <SettingsRow
          title="Dry run by default"
          detail="New exports start with dry run on."
          htmlFor={`${p}-dry`}
        >
          <input
            id={`${p}-dry`}
            type="checkbox"
            checked={dry}
            onChange={(e) => setDry(e.target.checked)}
            className="size-4 accent-(--accent-solid)"
          />
        </SettingsRow>
        <SettingsRow
          title="Engine"
          detail="D:\Minecraft\builder-studio-engine\.venv\Scripts\python.exe"
          mono
        >
          <StatusBadge tone="success" icon={CircleCheck}>
            Ready
          </StatusBadge>
        </SettingsRow>
        <SettingsRow title="Codex" detail="Sign in with ChatGPT opens your browser." disabled>
          <StatusBadge tone="warning" icon={KeyRound}>
            Sign-in needed
          </StatusBadge>
        </SettingsRow>
      </SettingsPanel>
      <SettingsPanel title="External agents">
        <SettingsRow
          title="Companion server"
          detail="Connect Claude Code or Codex running in your own terminal."
          below={
            <CopySnippet
              label="MCP command"
              code={`claude mcp add --transport http studio ${MCP_URL}`}
            />
          }
        />
        <SettingsRow
          title=".mcp.json"
          below={
            <CopySnippet
              label="MCP config"
              code={JSON.stringify(
                { mcpServers: { studio: { type: 'http', url: MCP_URL } } },
                null,
                2
              )}
            />
          }
        />
      </SettingsPanel>
    </SettingsSection>
  )
}

export default function SettingsLayout(): ReactElement {
  return (
    <div>
      <Sub
        title="SettingsSection, SettingsPanel, SettingsRow, CopySnippet"
        note="Version selection and per-version game-file paths compose from the existing settings controls; rows stack when narrow."
      >
        <Cell label="Wide" surface="bg">
          <div className="max-w-settings">
            <Demo p="kit-wide" />
          </div>
        </Cell>
        <Cell label="Narrow, touch density: rows stack" surface="bg">
          <Narrow width={22.5}>
            <Touch>
              <Demo p="kit-narrow" />
            </Touch>
          </Narrow>
        </Cell>
      </Sub>
    </div>
  )
}
