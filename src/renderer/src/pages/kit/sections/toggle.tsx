import type { ReactElement } from 'react'
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, BoldIcon, GridIcon, ItalicIcon, ScanEyeIcon } from 'lucide-react'
import { Toggle } from '@/shared/ui/primitives/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/primitives/toggle-group'
import { forceFocus, Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Actions', title: 'Toggle and toggle group' }

export default function ToggleSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens title="Toggle">
        <Specimen label="off">
          <Toggle aria-label="Show grid">
            <GridIcon />
          </Toggle>
        </Specimen>
        <Specimen label="on">
          <Toggle aria-label="Show grid" defaultPressed>
            <GridIcon />
          </Toggle>
        </Specimen>
        <Specimen label="hover">
          <Toggle aria-label="Show grid" className="bg-surface-hover text-fg">
            <GridIcon />
          </Toggle>
        </Specimen>
        <Specimen label="focus">
          <Toggle aria-label="Show grid" className={forceFocus} tabIndex={-1}>
            <GridIcon />
          </Toggle>
        </Specimen>
        <Specimen label="disabled">
          <Toggle aria-label="Show grid" disabled>
            <GridIcon />
          </Toggle>
        </Specimen>
        <Specimen label="outline, with text">
          <Toggle variant="outline" defaultPressed>
            <ScanEyeIcon />
            Highlight changes
          </Toggle>
        </Specimen>
        <Specimen label="sm">
          <Toggle size="sm" aria-label="Bold">
            <BoldIcon />
          </Toggle>
        </Specimen>
      </Specimens>
      <Specimens title="Toggle group">
        <Specimen label="single">
          <ToggleGroup type="single" defaultValue="left" aria-label="Alignment">
            <ToggleGroupItem value="left" aria-label="Align left">
              <AlignLeftIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="center" aria-label="Align centre">
              <AlignCenterIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="right" aria-label="Align right">
              <AlignRightIcon />
            </ToggleGroupItem>
          </ToggleGroup>
        </Specimen>
        <Specimen label="multiple, outline">
          <ToggleGroup type="multiple" variant="outline" defaultValue={['bold']} aria-label="Text style">
            <ToggleGroupItem value="bold" aria-label="Bold">
              <BoldIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="italic" aria-label="Italic">
              <ItalicIcon />
            </ToggleGroupItem>
          </ToggleGroup>
        </Specimen>
        <Specimen label="disabled item">
          <ToggleGroup type="single" defaultValue="a" aria-label="Disabled example">
            <ToggleGroupItem value="a">Blocks</ToggleGroupItem>
            <ToggleGroupItem value="b" disabled>
              Entities
            </ToggleGroupItem>
          </ToggleGroup>
        </Specimen>
      </Specimens>
      <Guidance>
        Arrow keys move focus inside a group; Space or Enter toggles. Icon-only toggles need an aria-label.
      </Guidance>
    </div>
  )
}
