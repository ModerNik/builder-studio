import * as React from 'react'
import { CheckIcon, MinusIcon } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'
import { useFieldControl } from '@/shared/ui/primitives/field'

/** checked="indeterminate" shows a dash (a partly selected group). The hit area grows past the 16px box. */
function Checkbox({
  className,
  ...rest
}: React.ComponentProps<typeof CheckboxPrimitive.Root>): React.ReactElement {
  const props = useFieldControl(rest)
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer focus-ring relative size-4 shrink-0 cursor-pointer rounded-xs border border-border-strong bg-surface-sunken text-accent-on-solid transition-[background-color,border-color] duration-fast ease-standard before:absolute before:-inset-2 before:content-[""] can-hover:border-fg-secondary aria-invalid:border-danger-solid disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-accent-solid data-[state=checked]:bg-accent-solid data-[state=indeterminate]:border-accent-solid data-[state=indeterminate]:bg-accent-solid',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="group flex items-center justify-center"
      >
        <CheckIcon className="size-3.5 group-data-[state=indeterminate]:hidden" strokeWidth={3} />
        <MinusIcon className="size-3.5 group-data-[state=checked]:hidden" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
