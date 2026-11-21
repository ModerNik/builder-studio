import * as React from 'react'
import { type VariantProps } from 'class-variance-authority'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'
import { toggleVariants } from '@/shared/ui/primitives/toggle'

const Variant = React.createContext<VariantProps<typeof toggleVariants>>({})

/** A row of toggles; arrow keys move between items. Use type="single" or "multiple". */
function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants>): React.ReactElement {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn('inline-flex w-fit items-center gap-0.5', className)}
      {...props}
    >
      <Variant.Provider value={{ variant, size }}>{children}</Variant.Provider>
    </ToggleGroupPrimitive.Root>
  )
}

function ToggleGroupItem({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleVariants>): React.ReactElement {
  const group = React.useContext(Variant)
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        toggleVariants({ variant: variant ?? group.variant, size: size ?? group.size }),
        className
      )}
      {...props}
    />
  )
}

type SegmentedControlProps = Omit<
  React.ComponentProps<typeof ToggleGroupPrimitive.Root>,
  'type' | 'value' | 'defaultValue' | 'onValueChange'
> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  size?: 'default' | 'sm'
}

/** One choice out of a few (theme, view mode). Always has a value: clicking the selected segment keeps it. */
function SegmentedControl({
  className,
  value,
  defaultValue,
  onValueChange,
  size = 'default',
  ...props
}: SegmentedControlProps): React.ReactElement {
  const [own, setOwn] = React.useState(defaultValue ?? '')
  const current = value ?? own
  return (
    <ToggleGroupPrimitive.Root
      data-slot="segmented-control"
      data-size={size}
      type="single"
      value={current}
      onValueChange={(v) => {
        if (!v) return
        setOwn(v)
        onValueChange?.(v)
      }}
      className={cn(
        'group/segmented inline-flex w-fit items-center gap-0.5 rounded-md bg-surface-sunken p-0.5 ring-1 ring-border-default ring-inset',
        className
      )}
      {...props}
    />
  )
}

function SegmentedControlItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>): React.ReactElement {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="segmented-control-item"
      className={cn(
        "focus-ring inline-flex h-[calc(var(--density-control)-0.25rem)] min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-2.5 text-(length:--density-text) font-medium whitespace-nowrap text-fg-secondary transition-[color,background-color,box-shadow] duration-fast ease-standard select-none group-data-[size=sm]/segmented:h-[calc(var(--density-control-sm)-0.25rem)] group-data-[size=sm]/segmented:px-2 can-hover:text-fg disabled:cursor-not-allowed disabled:opacity-50 data-[state=on]:bg-surface-raised data-[state=on]:text-fg data-[state=on]:shadow-sm dark:data-[state=on]:bg-surface-active [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

export { SegmentedControl, SegmentedControlItem, ToggleGroup, ToggleGroupItem }
