import { useState, type ReactElement } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/primitives/collapsible'

export const meta = { group: 'Display', title: 'Collapsible' }

export default function CollapsibleSection(): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex max-w-sm flex-col gap-2">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="justify-start">
          <ChevronRightIcon
            aria-hidden
            className={`transition-transform duration-base ease-standard ${open ? 'rotate-90' : 'rtl:rotate-180'}`}
          />
          Engine log ({open ? 'open' : 'closed'})
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="rounded-md bg-surface-sunken p-3 font-mono text-sm text-fg-secondary">
          {'> engine draft watchtower\nloaded build.py\nplaced 1,204 blocks\nwrote out/watchtower_v14.litematic'}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}
