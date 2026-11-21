import * as React from 'react'
import { Switch as SwitchPrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'
import { useFieldControl } from '@/shared/ui/primitives/field'

/** An on/off setting that applies at once. The thumb slides 12px (instant under reduced motion). */
function Switch({
  className,
  ...rest
}: React.ComponentProps<typeof SwitchPrimitive.Root>): React.ReactElement {
  const props = useFieldControl(rest)
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer focus-ring relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-[background-color] duration-fast ease-standard before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[""] aria-invalid:ring-1 aria-invalid:ring-danger-solid disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent-solid data-[state=unchecked]:bg-border-strong',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-3 rounded-full bg-surface-panel shadow-sm transition-transform duration-fast ease-standard data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-3"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
