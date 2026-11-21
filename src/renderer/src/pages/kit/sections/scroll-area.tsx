import type { ReactElement } from 'react'
import { ScrollArea } from '@/shared/ui/primitives/scroll-area'
import { Specimen, Specimens } from '../specimen'

export const meta = { group: 'Display', title: 'Scroll area' }

const rows = Array.from({ length: 40 }, (_, i) => `minecraft:block_${String(i + 1).padStart(2, '0')}`)

export default function ScrollAreaSection(): ReactElement {
  return (
    <Specimens>
      <Specimen label="vertical (Tab focuses it, arrows scroll)">
        <ScrollArea className="h-48 w-56 rounded-md border border-border-default" aria-label="Blocks">
          <ul className="p-1">
            {rows.map((r) => (
              <li key={r} className="flex h-(--density-row) items-center px-2 font-mono text-sm">
                {r}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </Specimen>
      <Specimen label="horizontal">
        <ScrollArea className="w-72 rounded-md border border-border-default" aria-label="Palette">
          <div className="flex gap-2 p-3">
            {rows.slice(0, 20).map((r, i) => (
              <div
                key={r}
                className="size-12 shrink-0 rounded-sm border border-border-default"
                style={{ background: `var(--cat-${(i % 8) + 1})` }}
              />
            ))}
          </div>
        </ScrollArea>
      </Specimen>
    </Specimens>
  )
}
