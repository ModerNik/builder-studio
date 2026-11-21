import { useState, type ReactElement } from 'react'
import { CopyIcon, EyeOffIcon, MapPinIcon, Trash2Icon } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/shared/ui/primitives/context-menu'
import { Guidance } from '../specimen'

export const meta = { group: 'Overlays', title: 'Context menu' }

export default function ContextMenuSection(): ReactElement {
  const [hidden, setHidden] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <ContextMenu>
        <ContextMenuTrigger className="flex h-40 max-w-md items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-viewer text-sm text-fg-secondary">
          Right-click (or Shift+F10 on focus) a block here
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuLabel className="font-mono">minecraft:cut_copper</ContextMenuLabel>
          <ContextMenuItem>
            <MapPinIcon />
            Pin a note here
            <ContextMenuShortcut>N</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <CopyIcon />
            Copy coordinates
          </ContextMenuItem>
          <ContextMenuCheckboxItem checked={hidden} onCheckedChange={setHidden}>
            Hide this part
          </ContextMenuCheckboxItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <EyeOffIcon />
              Isolate
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem>This block type</ContextMenuItem>
              <ContextMenuItem>This part</ContextMenuItem>
              <ContextMenuItem disabled>This layer</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive">
            <Trash2Icon />
            Remove from palette
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <Guidance>
        A context menu is a shortcut, never the only way to reach an action: every item also lives in a
        visible menu or button. Same rows and keys as Dropdown menu.
      </Guidance>
    </div>
  )
}
