import type { ReactElement } from 'react'
import type { Settings } from '@shared/api'
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/primitives/toggle-group'

type Theme = Settings['appearance']['theme']

export function ThemeControl({
  value,
  onChange,
  disabled
}: {
  value: Theme
  onChange: (theme: Theme) => void
  disabled?: boolean
}): ReactElement {
  return (
    <SegmentedControl
      aria-label="Theme"
      className="inline-grid grid-flow-col auto-cols-fr"
      value={value}
      onValueChange={(theme) => onChange(theme as Theme)}
      disabled={disabled}
    >
      <SegmentedControlItem value="dark" className="px-3">
        Dark
      </SegmentedControlItem>
      <SegmentedControlItem value="light" className="px-3">
        Light
      </SegmentedControlItem>
      <SegmentedControlItem value="system" className="px-3">
        System
      </SegmentedControlItem>
    </SegmentedControl>
  )
}
