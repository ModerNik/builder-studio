import type { ReactElement } from 'react'
import { Layers, ListChecks, Palette, Pencil } from 'lucide-react'
import { Tip } from '@/shared/ui/common/Tip'
import { TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs'

const tabs = [
  { id: 'edit', label: 'Edit', icon: Pencil },
  { id: 'parts', label: 'Parts', icon: Layers },
  { id: 'checks', label: 'Checks', icon: ListChecks },
  { id: 'materials', label: 'Materials', icon: Palette }
]

/** The Editor dock's tabs, its only header: labels when all four fit, their icons below that. */
export function EditorTabs(): ReactElement {
  return (
    <div className="@container/editor w-full min-w-0">
      <TabsList variant="line" aria-label="Editor" className="grid w-full grid-cols-4 gap-0">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Tip key={id} label={label} side="bottom">
            <TabsTrigger
              value={id}
              aria-label={label}
              className="min-w-0 px-1 aria-selected:text-fg aria-selected:after:opacity-100 group-data-[orientation=horizontal]/tabs:after:bottom-0"
            >
              <span className="hidden @min-[20rem]/editor:inline">{label}</span>
              <Icon aria-hidden="true" className="@min-[20rem]/editor:hidden" />
            </TabsTrigger>
          </Tip>
        ))}
      </TabsList>
    </div>
  )
}
