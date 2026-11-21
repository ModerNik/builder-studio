import type { ReactElement } from 'react'
import { InfoIcon } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Shortcut } from '@/shared/ui/primitives/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/primitives/tooltip'
import { Guidance, LONG, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Overlays', title: 'Tooltip' }

export default function TooltipSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="hover or focus">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Draft</Button>
            </TooltipTrigger>
            <TooltipContent>
              Generate a draft <Shortcut keys="Ctrl+Enter" />
            </TooltipContent>
          </Tooltip>
        </Specimen>
        <Specimen label="appearance (static copy)">
          <div className="flex items-center gap-2 rounded-sm bg-surface-inverse px-2 py-1 text-sm text-fg-inverse shadow-md">
            Undo <Shortcut keys="Ctrl+Z" className="[&_kbd]:border-transparent [&_kbd]:bg-fg-inverse/15 [&_kbd]:text-fg-inverse" />
          </div>
        </Specimen>
        <Specimen label="sides">
          <div className="flex gap-2">
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <Tooltip key={side}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {side}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={side}>On the {side}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </Specimen>
        <Specimen label="long text wraps at 256px">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="About revisions">
                <InfoIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{LONG}</TooltipContent>
          </Tooltip>
        </Specimen>
      </Specimens>
      <Guidance>
        Tooltips name or explain; they never hold the only copy of something the user needs. They open on
        keyboard focus as well as hover, after 500ms (instant when moving between triggers). Disabled
        controls get no tooltip, so explain a disabled state in visible text. Use IconButton for icon-only
        buttons: it adds the tooltip for you.
      </Guidance>
    </div>
  )
}
