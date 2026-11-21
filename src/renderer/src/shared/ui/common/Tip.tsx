// Tooltip and labelled icon button for the composites, on the kit's Tooltip.
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/primitives/tooltip'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { cn } from '@/shared/lib/utils'

export function Tip({
  label,
  side = 'top',
  children
}: {
  label: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactElement
}): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

/** An icon-only button: the label is its accessible name and its tooltip. */
export function IconAction({
  label,
  icon: Icon,
  tip,
  className,
  size = 'sm',
  ...props
}: Omit<ComponentProps<'button'>, 'children'> & {
  label: string
  icon: LucideIcon
  /** Tooltip text when it should say more than the label. */
  tip?: ReactNode
  size?: 'sm' | 'xs'
}): ReactElement {
  return (
    <Tip label={tip ?? label}>
      <Button
        type="button"
        variant="ghost"
        aria-label={label}
        className={cn(
          'shrink-0 p-0 text-fg-secondary hover:text-fg',
          size === 'sm'
            ? 'size-(--density-control-sm)'
            : 'size-6 pointer-coarse:size-(--density-control-sm)',
          className
        )}
        {...props}
      >
        <Icon className="size-3.5" aria-hidden />
      </Button>
    </Tip>
  )
}
