import { useState, type ReactElement } from 'react'
import { CopyIcon, FolderOpenIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/shared/ui/primitives/dropdown-menu'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import { Guidance, LONG, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Overlays', title: 'Dropdown menu' }

function DemoMenuItems(): ReactElement {
  const [grid, setGrid] = useState(true)
  const [axes, setAxes] = useState(false)
  const [sort, setSort] = useState('newest')
  return (
    <>
      <DropdownMenuLabel>watchtower</DropdownMenuLabel>
      <DropdownMenuGroup>
        <DropdownMenuItem>
          <PencilIcon />
          Rename
          <DropdownMenuShortcut>F2</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CopyIcon />
          Duplicate
          <DropdownMenuShortcut>Ctrl+D</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <FolderOpenIcon />
          Show in folder
        </DropdownMenuItem>
        <DropdownMenuItem disabled>Export (needs a draft)</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem checked={grid} onCheckedChange={setGrid}>
        Show grid
      </DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked={axes} onCheckedChange={setAxes}>
        Show axes
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Sort versions</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
            <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="name">By name</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem className="max-w-72">
        <span className="truncate">{LONG}</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive">
        <Trash2Icon />
        Delete build
        <DropdownMenuShortcut>Del</DropdownMenuShortcut>
      </DropdownMenuItem>
    </>
  )
}

export default function DropdownMenuSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="icon trigger">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="Build actions">
                <MoreHorizontalIcon />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DemoMenuItems />
            </DropdownMenuContent>
          </DropdownMenu>
        </Specimen>
        <Specimen label="button trigger, end-aligned">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Actions</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DemoMenuItems />
            </DropdownMenuContent>
          </DropdownMenu>
        </Specimen>
        <Specimen label="RTL">
          <div dir="rtl">
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button variant="outline">תפריט</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60">
                <DemoMenuItems />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Specimen>
      </Specimens>
      <Guidance>
        Arrow keys move, Right/Left open and close submenus, typing jumps to an item, Esc closes and returns
        focus. Shortcuts shown in menus are hints; bind keys separately. Put destructive items last, after a
        separator; confirm them with an AlertDialog when they cannot be undone.
      </Guidance>
    </div>
  )
}
