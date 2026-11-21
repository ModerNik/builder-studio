// A block's header and one control per property: segments for a few values, a select for more, a switch for
// true or false, a number field for numbers. Under 22rem each name sits above its control.
import { useId, type ReactElement } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { NumberField } from '@/shared/ui/primitives/number-field'
import { Switch } from '@/shared/ui/primitives/switch'
import { Toggle } from '@/shared/ui/primitives/toggle'
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/primitives/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import type { BlockInfo, BlockProp } from '@/entities/block/model/registry'
import { BlockIcon } from './BlockTile'

function PropControl({
  prop,
  value,
  onChange,
  id
}: {
  prop: BlockProp
  value: string
  onChange: (value: string) => void
  id: string
}): ReactElement {
  if (prop.type === 'bool')
    return (
      <Switch
        aria-labelledby={id}
        checked={value === 'true'}
        onCheckedChange={(on) => onChange(String(on))}
      />
    )
  if (prop.type === 'int') {
    const nums = prop.values.map(Number)
    return (
      <NumberField
        aria-labelledby={id}
        value={Number(value)}
        min={Math.min(...nums)}
        max={Math.max(...nums)}
        onValueChange={(v) => v !== null && onChange(String(v))}
        className="w-28"
      />
    )
  }
  if (prop.values.length <= 4)
    return (
      <SegmentedControl
        size="sm"
        aria-labelledby={id}
        value={value}
        onValueChange={onChange}
        className="w-full"
      >
        {prop.values.map((v) => (
          <SegmentedControlItem key={v} value={v} className="min-w-0 px-1.5">
            <span className="truncate">{v}</span>
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    )
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-labelledby={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {prop.values.map((v) => (
          <SelectItem key={v} value={v}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function BlockStateEditor({
  block,
  props,
  onChange,
  icon,
  color,
  favourite,
  onFavourite,
  className
}: {
  block: BlockInfo
  /** The state's properties; missing ones show the block's defaults. */
  props: Record<string, string>
  onChange: (props: Record<string, string>) => void
  icon?: string
  color?: string | null
  favourite: boolean
  onFavourite: () => void
  className?: string
}): ReactElement {
  const base = useId()
  return (
    <div className={cn('@container/state flex min-w-0 flex-col gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center">
          <BlockIcon icon={icon} color={color} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-medium text-fg">{block.label}</div>
          <div className="truncate font-mono text-[0.8125rem] text-fg-muted">{block.id}</div>
        </div>
        <Toggle
          size="sm"
          aria-label="Favourite"
          pressed={favourite}
          onPressedChange={onFavourite}
          className="data-[state=on]:text-accent-text"
        >
          <Star aria-hidden="true" className={cn(favourite && 'fill-current')} />
        </Toggle>
      </div>
      {block.props.length ? (
        // in a narrow dock each name sits above its control, so four values still fit side by side
        <div className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-2 @max-[22rem]/state:grid-cols-1 @max-[22rem]/state:gap-y-3">
          {block.props.map((p) => (
            <div
              key={p.name}
              className="col-span-2 grid grid-cols-subgrid items-center @max-[22rem]/state:col-span-1 @max-[22rem]/state:gap-y-1"
            >
              <span
                id={`${base}-${p.name}`}
                className="truncate font-mono text-[0.8125rem] text-fg-secondary"
              >
                {p.name}
              </span>
              <PropControl
                id={`${base}-${p.name}`}
                prop={p}
                value={props[p.name] ?? block.defaults[p.name]}
                onChange={(v) => onChange({ ...props, [p.name]: v })}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-fg-muted">This block has no states.</p>
      )}
    </div>
  )
}
