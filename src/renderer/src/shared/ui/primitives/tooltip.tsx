import * as React from 'react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'

// A Tooltip outside any TooltipProvider brings its own, so IconButton works anywhere;
// one provider near the root shares the delay, so moving between buttons opens instantly.
const Provided = React.createContext(false)

function TooltipProvider({
  delayDuration = 500,
  skipDelayDuration = 300,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>): React.ReactElement {
  return (
    <Provided.Provider value={true}>
      <TooltipPrimitive.Provider
        data-slot="tooltip-provider"
        delayDuration={delayDuration}
        skipDelayDuration={skipDelayDuration}
        {...props}
      />
    </Provided.Provider>
  )
}

function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>): React.ReactElement {
  const root = <TooltipPrimitive.Root data-slot="tooltip" {...props} />
  return React.useContext(Provided) ? root : <TooltipProvider>{root}</TooltipProvider>
}

function TooltipTrigger(
  props: React.ComponentProps<typeof TooltipPrimitive.Trigger>
): React.ReactElement {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>): React.ReactElement {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          'motion-pop z-tooltip flex max-w-64 items-center gap-2 rounded-sm bg-surface-inverse px-2 py-1 text-sm text-balance text-fg-inverse shadow-md [&_[data-slot=kbd]]:border-transparent [&_[data-slot=kbd]]:bg-fg-inverse/15 [&_[data-slot=kbd]]:text-fg-inverse',
          className
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
