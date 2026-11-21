import { useState, type ReactElement } from 'react'
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger
} from '@/shared/ui/primitives/menubar'
import { Guidance } from '../specimen'

export const meta = { group: 'Overlays', title: 'Menubar' }

export default function MenubarSection(): ReactElement {
  const [grid, setGrid] = useState(true)
  return (
    <div className="flex flex-col gap-4">
      <Menubar aria-label="Application" className="w-fit rounded-md border border-border-default px-1">
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>
              New build <MenubarShortcut>Ctrl+N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem>
              Open… <MenubarShortcut>Ctrl+O</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem>Export</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarCheckboxItem checked={grid} onCheckedChange={setGrid}>
              Grid
            </MenubarCheckboxItem>
            <MenubarItem>
              Command palette <MenubarShortcut>Ctrl+K</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Help</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>Documentation</MenubarItem>
            <MenubarItem disabled>Check for updates</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <Guidance>
        Built from the shared menu rows because it was cheap; the S3 shell has no menu bar yet, so treat this
        as optional.
      </Guidance>
    </div>
  )
}
