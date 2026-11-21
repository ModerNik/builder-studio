import * as React from 'react'
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'
import { useFieldControl } from '@/shared/ui/primitives/field'

/** Arrow keys move the choice. Label it with a Fieldset legend or aria-label. */
function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>): React.ReactElement {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn('grid gap-2', className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...rest
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>): React.ReactElement {
  const props = useFieldControl(rest)
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        'peer focus-ring relative flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface-sunken transition-[border-color] duration-fast ease-standard before:absolute before:-inset-2 before:content-[""] can-hover:border-fg-secondary aria-invalid:border-danger-solid disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-accent-solid',
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="size-2 rounded-full bg-accent-solid"
      />
    </RadioGroupPrimitive.Item>
  )
}

/**
 * A whole-card choice (Setup and Settings provider choice): the card is the radio, with a name, a meta
 * line and an optional badge at the end. `children` is the chosen card's detail (a check result, Check
 * again); it shows only while the card is checked and sits outside the radio, so it can hold buttons.
 */
function RadioCard({
  value,
  title,
  description,
  badge,
  disabled,
  children,
  className
}: {
  value: string
  title: React.ReactNode
  description?: React.ReactNode
  badge?: React.ReactNode
  disabled?: boolean
  children?: React.ReactNode
  className?: string
}): React.ReactElement {
  return (
    <div
      data-slot="radio-card"
      className={cn(
        'group/radio-card flex min-w-0 flex-col rounded-lg border border-border-default bg-surface-raised transition-[border-color,background-color] duration-fast ease-standard can-hover:has-[[data-slot=radio-card-item]:enabled:hover]:border-border-strong has-[[data-state=checked]]:border-accent-solid has-[[data-state=checked]]:bg-accent-subtle has-[:disabled]:opacity-50',
        className
      )}
    >
      <RadioGroupPrimitive.Item
        value={value}
        disabled={disabled}
        data-slot="radio-card-item"
        className="focus-ring flex min-h-(--density-row) w-full cursor-pointer items-start gap-3 rounded-lg p-3 text-start disabled:cursor-not-allowed"
      >
        <span
          aria-hidden
          className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-sunken group-has-[[data-state=checked]]/radio-card:border-accent-solid"
        >
          <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-accent-solid" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-medium text-fg">{title}</span>
          {description && <span className="text-sm text-fg-secondary">{description}</span>}
        </span>
        {badge && <span className="shrink-0">{badge}</span>}
      </RadioGroupPrimitive.Item>
      {children && (
        <div className="hidden flex-col gap-2 px-3 pb-3 ps-10 group-has-[[data-state=checked]]/radio-card:flex">
          {children}
        </div>
      )}
    </div>
  )
}

export { RadioCard, RadioGroup, RadioGroupItem }
