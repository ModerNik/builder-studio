// The rows of a tool's settings in the Edit tab (DESIGN › Tool options): one row per setting, each label above
// its control in a narrow dock, as in the block state editor.
import { useId, type ReactElement, type ReactNode } from 'react'
import { NumberField } from '@/shared/ui/primitives/number-field'
import { Slider } from '@/shared/ui/primitives/slider'
import { Switch } from '@/shared/ui/primitives/switch'
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/primitives/toggle-group'
import { MAX_SIZE } from '../model/edit'

export function Rows({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="@container/options mt-2 w-full">
      <div className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-2 @max-[22rem]/options:grid-cols-1 @max-[22rem]/options:gap-y-3">
        {children}
      </div>
    </div>
  )
}

export function Row({
  label,
  children
}: {
  label: string
  children: (labelId: string) => ReactNode
}): ReactElement {
  const id = useId()
  return (
    <div className="col-span-2 grid grid-cols-subgrid items-center @max-[22rem]/options:col-span-1 @max-[22rem]/options:gap-y-1">
      <span id={id} className="truncate text-[0.8125rem] text-fg-secondary">
        {label}
      </span>
      {children(id)}
    </div>
  )
}

export function Hint({ children }: { children: ReactNode }): ReactElement {
  return (
    <p className="col-span-2 text-sm text-fg-muted @max-[22rem]/options:col-span-1">{children}</p>
  )
}

export function Choice<T extends string>({
  id,
  value,
  items,
  onChange
}: {
  id: string
  value: T
  items: [T, string][]
  onChange: (value: T) => void
}): ReactElement {
  return (
    <SegmentedControl
      size="sm"
      aria-labelledby={id}
      value={value}
      onValueChange={(v) => onChange(v as T)}
      className="w-full"
    >
      {items.map(([v, label]) => (
        <SegmentedControlItem key={v} value={v} className="min-w-0 px-1.5">
          <span className="truncate">{label}</span>
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  )
}

export function Toggle({
  id,
  checked,
  onChange
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
}): ReactElement {
  return <Switch aria-labelledby={id} checked={checked} onCheckedChange={onChange} />
}

export function Count({
  id,
  value,
  max,
  onChange
}: {
  id: string
  value: number
  max: number
  onChange: (value: number) => void
}): ReactElement {
  return (
    <NumberField
      aria-labelledby={id}
      value={value}
      min={1}
      max={max}
      onValueChange={(v) => v !== null && onChange(v)}
    />
  )
}

export function Size({
  value,
  label,
  onChange
}: {
  value: number
  label: string
  onChange: (value: number) => void
}): ReactElement {
  return (
    <Slider
      aria-label={label}
      min={1}
      max={MAX_SIZE}
      step={1}
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      showValue
    />
  )
}
