// A block as a square button: its isometric icon from the game's textures, or its colour without them.
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '@/shared/lib/utils'
import { Swatch } from '@/shared/ui/data/values'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/primitives/tooltip'

/** The block's icon or swatch alone, for headers and rows. */
export function BlockIcon({
  icon,
  color,
  className
}: {
  /** An image URL; '' or undefined falls back to the colour. */
  icon?: string
  color?: string | null
  className?: string
}): ReactElement {
  return icon ? (
    <img
      src={icon}
      alt=""
      draggable={false}
      className={cn('size-full object-contain [image-rendering:pixelated]', className)}
    />
  ) : (
    <Swatch color={color} size="md" className={className} />
  )
}

export function BlockTile({
  label,
  icon,
  color,
  selected = false,
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'children' | 'color'> & {
  /** The block's name: the accessible name and the tooltip. */
  label: string
  icon?: string
  color?: string | null
  selected?: boolean
}): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={selected}
          className={cn(
            'focus-ring flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-surface-viewer p-1 transition-[background-color,box-shadow] duration-fast ease-standard can-hover:bg-surface-hover aria-pressed:shadow-[inset_0_0_0_1.5px_var(--accent-solid)]',
            className
          )}
          {...props}
        >
          <BlockIcon icon={icon} color={color} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
