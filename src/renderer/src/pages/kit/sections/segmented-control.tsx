import { useState, type ReactElement } from 'react'
import { BoxIcon, ColumnsIcon, ImageIcon } from 'lucide-react'
import { ThemeControl } from '@/entities/settings/ui/ThemeControl'
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/primitives/toggle-group'
import { Guidance, RTL_TEXT, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Actions', title: 'Segmented control' }

export default function SegmentedControlSection(): ReactElement {
  const [view, setView] = useState('3d')
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('system')
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="Theme (equal segments)">
          <ThemeControl value={theme} onChange={setTheme} />
        </Specimen>
        <Specimen label={`view mode, controlled: ${view}`}>
          <SegmentedControl value={view} onValueChange={setView} aria-label="View">
            <SegmentedControlItem value="3d">
              <BoxIcon />
              3D
            </SegmentedControlItem>
            <SegmentedControlItem value="preview">
              <ImageIcon />
              Preview
            </SegmentedControlItem>
            <SegmentedControlItem value="compare">
              <ColumnsIcon />
              Compare
            </SegmentedControlItem>
          </SegmentedControl>
        </Specimen>
        <Specimen label="sm">
          <SegmentedControl size="sm" defaultValue="a" aria-label="Size example">
            <SegmentedControlItem value="a">Blocks</SegmentedControlItem>
            <SegmentedControlItem value="b">Parts</SegmentedControlItem>
          </SegmentedControl>
        </Specimen>
        <Specimen label="disabled item">
          <SegmentedControl defaultValue="a" aria-label="Disabled example">
            <SegmentedControlItem value="a">Draft</SegmentedControlItem>
            <SegmentedControlItem value="b" disabled>
              Review
            </SegmentedControlItem>
          </SegmentedControl>
        </Specimen>
        <Specimen label="all disabled">
          <SegmentedControl defaultValue="a" disabled aria-label="All disabled">
            <SegmentedControlItem value="a">On</SegmentedControlItem>
            <SegmentedControlItem value="b">Off</SegmentedControlItem>
          </SegmentedControl>
        </Specimen>
        <Specimen label="full width, RTL" className="w-72">
          <div dir="rtl" className="w-full">
            <SegmentedControl defaultValue="a" className="w-full" aria-label="RTL example">
              <SegmentedControlItem value="a">{RTL_TEXT}</SegmentedControlItem>
              <SegmentedControlItem value="b">ב</SegmentedControlItem>
            </SegmentedControl>
          </div>
        </Specimen>
      </Specimens>
      <Guidance>
        For two to five mutually exclusive options that apply at once (theme, view mode). Arrow keys move
        between segments; clicking the selected one keeps it selected.
      </Guidance>
    </div>
  )
}
