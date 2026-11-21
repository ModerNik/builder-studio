import { useState, type ReactElement } from 'react'
import { BoxIcon, FileTextIcon, PlayIcon, SettingsIcon, SunMoonIcon } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from '@/shared/ui/primitives/command'
import { ShortcutHint } from '@/shared/ui/primitives/kbd'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Overlays', title: 'Command palette' }

function Items(): ReactElement {
  return (
    <>
      <CommandEmpty>No command matches</CommandEmpty>
      <CommandGroup heading="Builds">
        <CommandItem>
          <BoxIcon />
          watchtower
        </CommandItem>
        <CommandItem>
          <BoxIcon />
          harbour_crane
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Actions">
        <CommandItem>
          <PlayIcon />
          Generate draft
          <CommandShortcut>Ctrl+Enter</CommandShortcut>
        </CommandItem>
        <CommandItem>
          <SunMoonIcon />
          Toggle theme
        </CommandItem>
        <CommandItem>
          <SettingsIcon />
          Open settings
          <CommandShortcut>Ctrl+,</CommandShortcut>
        </CommandItem>
        <CommandItem disabled>
          <FileTextIcon />
          Export (no draft yet)
        </CommandItem>
      </CommandGroup>
    </>
  )
}

export default function CommandSection(): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="palette dialog">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setOpen(true)}>
              Open palette
            </Button>
            <ShortcutHint keys="Ctrl+K">or press</ShortcutHint>
          </div>
          <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Type a command or a build name" />
            <CommandList>
              <Items />
            </CommandList>
          </CommandDialog>
        </Specimen>
        <Specimen label="inline" className="w-80">
          <Command className="border border-border-default">
            <CommandInput placeholder="Filter" />
            <CommandList>
              <Items />
            </CommandList>
          </Command>
        </Specimen>
        <Specimen label="loading" className="w-80">
          <Command className="border border-border-default">
            <CommandInput placeholder="Searching docs" loading />
            <CommandList>
              <CommandEmpty>Searching…</CommandEmpty>
            </CommandList>
          </Command>
        </Specimen>
      </Specimens>
      <Guidance>
        The app’s palette opens with Ctrl+K (the Shell owns that binding). Arrow keys move, Enter runs, Esc
        closes and returns focus.
      </Guidance>
    </div>
  )
}
