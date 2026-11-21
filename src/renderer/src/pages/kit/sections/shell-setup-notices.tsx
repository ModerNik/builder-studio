import { useState, type ReactElement } from 'react'
import { DropdownMenu } from 'radix-ui'
import { Bot, Download, GitBranch, Monitor } from 'lucide-react'
import {
  SetupNoticesChip,
  SetupNoticesMenuItem,
  type SetupNotice
} from '@/entities/availability/ui/SetupNotices'
import { menuContent } from '@/shared/ui/common/styles'
import { Button } from '@/shared/ui/primitives/button'
import { Specimen, Specimens, Guidance } from '../specimen'

export const meta = { group: 'Shell', title: 'Setup notices chip' }

export default function SetupNoticesDemo(): ReactElement {
  const [installing, setInstalling] = useState(false)
  const notices: SetupNotice[] = [
    {
      id: 'browser',
      label: 'Preview browser',
      detail: 'Unlocks preview images',
      icon: Monitor,
      action: 'Install',
      busy: installing ? 'Installing…' : undefined,
      onFix: () => setInstalling(true)
    },
    {
      id: 'export',
      label: 'Exported schematics folder',
      detail: 'Unlocks Export to Minecraft',
      icon: Download,
      action: 'Set up',
      onFix: () => {}
    },
    {
      id: 'identity',
      label: 'Your name for build history',
      detail: 'Unlocks saving build versions',
      icon: GitBranch,
      action: 'Set up',
      onFix: () => {}
    }
  ]
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="three missing (click it)">
          <SetupNoticesChip notices={notices} />
        </Specimen>
        <Specimen label="one missing">
          <SetupNoticesChip
            notices={[
              {
                id: 'ai',
                label: 'AI assistant',
                detail: 'Sign in to Claude Code',
                icon: Bot,
                action: 'Set up',
                onFix: () => {}
              }
            ]}
          />
        </Specimen>
        <Specimen label="nothing missing: renders nothing">
          <span className="text-sm text-fg-muted">
            <SetupNoticesChip notices={[]} />
            (no chip)
          </span>
        </Specimen>
        <Specimen label="tablet and phone: in the title bar ⋯ menu">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="sm">
                More
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="start" sideOffset={4} className={menuContent}>
                <SetupNoticesMenuItem notices={notices} onSelect={() => {}} />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </Specimen>
      </Specimens>
      <Guidance>
        Goes in the TitleBar setup slot. Each row has one fix: an install runs straight away and
        shows its progress on the button, anything else opens its Settings section. The chip goes
        away once nothing is missing; Settings › Advanced › Diagnostics lists every requirement.
      </Guidance>
    </div>
  )
}
