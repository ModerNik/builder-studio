import { useState, type ReactElement } from 'react'
import { FileIcon } from 'lucide-react'
import { Chip, RemovableChip } from '@/shared/ui/primitives/chip'
import { forceFocus, LONG, RTL_TEXT, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Display', title: 'Chip' }

const filters = ['Walls', 'Roof', 'Stairs', 'Windows']

export default function ChipSection(): ReactElement {
  const [on, setOn] = useState(['Roof'])
  const [files, setFiles] = useState(['tower_ref.png', 'palette.json', LONG])
  return (
    <div className="flex flex-col gap-6">
      <Specimens title="Toggle chips">
        <Specimen label="live filter group">
          <div role="group" aria-label="Parts" className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <Chip
                key={f}
                selected={on.includes(f)}
                onClick={() => setOn(on.includes(f) ? on.filter((x) => x !== f) : [...on, f])}
              >
                {f}
              </Chip>
            ))}
          </div>
        </Specimen>
        <Specimen label="hover">
          <Chip className="bg-surface-hover text-fg">Walls</Chip>
        </Specimen>
        <Specimen label="focus">
          <Chip className={forceFocus} tabIndex={-1}>
            Walls
          </Chip>
        </Specimen>
        <Specimen label="disabled">
          <Chip disabled>Entities</Chip>
        </Specimen>
        <Specimen label="RTL">
          <div dir="rtl">
            <Chip selected>{RTL_TEXT}</Chip>
          </div>
        </Specimen>
      </Specimens>
      <Specimens title="Removable chips">
        <Specimen label="attachments (long name truncates)" className="max-w-80">
          <div className="flex max-w-full flex-wrap gap-1.5">
            {files.map((f) => (
              <RemovableChip key={f} className="max-w-60" onRemove={() => setFiles(files.filter((x) => x !== f))}>
                <FileIcon aria-hidden />
                {f}
              </RemovableChip>
            ))}
            {files.length === 0 && <span className="text-sm text-fg-muted">All removed</span>}
          </div>
        </Specimen>
        <Specimen label="disabled">
          <RemovableChip onRemove={() => {}} removeLabel="Remove oak_planks" disabled>
            oak_planks
          </RemovableChip>
        </Specimen>
      </Specimens>
    </div>
  )
}
