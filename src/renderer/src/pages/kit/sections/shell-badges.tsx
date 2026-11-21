import type { ReactElement } from 'react'
import { MessageCircle, ListChecks } from 'lucide-react'
import { TabBadge } from '@/shared/ui/common/parts'
import { PanelToggle } from '@/widgets/workbench-shell/ui/PanelToggle'
import { Specimen, Specimens, Guidance } from '../specimen'

export const meta = { group: 'Shell', title: 'Tab badges' }

export default function BadgesDemo(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens title="On a tab or panel toggle">
        <Specimen label="count">
          <span className="inline-flex items-center gap-1.5 text-sm text-fg-secondary">
            <ListChecks aria-hidden className="size-4" />
            Activity
            <TabBadge badge={3} label="3 problems" />
          </span>
        </Specimen>
        <Specimen label="dot">
          <span className="inline-flex items-center gap-1.5 text-sm text-fg-secondary">
            Review
            <TabBadge badge="dot" label="Changed" />
          </span>
        </Specimen>
        <Specimen label="needs you (attention)">
          <span className="inline-flex items-center gap-1.5 text-sm text-fg-secondary">
            <MessageCircle aria-hidden className="size-4" />
            Chat
            <TabBadge badge={2} label="2 asks need you" tone="attention" />
          </span>
        </Specimen>
        <Specimen label="Chat toggle, needs you">
          <PanelToggle
            panel={{
              id: 'assistant',
              side: 'right',
              title: 'Chat',
              icon: MessageCircle,
              keys: 'Ctrl+J',
              badge: 2,
              badgeLabel: '2 asks need you',
              badgeTone: 'attention',
              content: null
            }}
          />
        </Specimen>
        <Specimen label="needs you, 100+">
          <TabBadge badge={128} label="128 asks need you" tone="attention" />
        </Specimen>
      </Specimens>
      <Guidance>
        Give the Chat panel badgeTone attention with the number of asks waiting on the user, and
        pass the same number to the StatusBar as needsYou. The count is always spelled out for
        screen readers; amber matches the awaiting-approval state.
      </Guidance>
    </div>
  )
}
