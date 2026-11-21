import * as React from 'react'
import { XIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const chipBase =
  "inline-flex h-(--density-control-sm) max-w-full min-w-0 shrink-0 items-center gap-1 rounded-md border px-2 text-xs whitespace-nowrap transition-[color,background-color,border-color] duration-fast ease-standard [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"

/** A filter or tag you can switch on and off (aria-pressed). */
function Chip({
  className,
  selected = false,
  children,
  ...props
}: React.ComponentProps<'button'> & { selected?: boolean }): React.ReactElement {
  return (
    <button
      type="button"
      data-slot="chip"
      aria-pressed={selected}
      className={cn(
        chipBase,
        'focus-ring cursor-pointer border-border-default text-fg-secondary can-hover:bg-surface-hover can-hover:text-fg disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-accent-subtle-border aria-pressed:bg-accent-subtle aria-pressed:text-accent-text',
        className
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
    </button>
  )
}

/** A tag with a remove button, e.g. an attached file or a picked block. */
function RemovableChip({
  className,
  children,
  onRemove,
  removeLabel,
  disabled,
  ...props
}: React.ComponentProps<'span'> & {
  onRemove: () => void
  /** The remove button's name; defaults to "Remove <text>" when children is a string. */
  removeLabel?: string
  disabled?: boolean
}): React.ReactElement {
  const label = removeLabel ?? (typeof children === 'string' ? `Remove ${children}` : 'Remove')
  return (
    <span
      data-slot="chip"
      data-disabled={disabled || undefined}
      className={cn(chipBase, 'border-border-default bg-surface-hover pe-0.5 text-fg data-disabled:opacity-50', className)}
      {...props}
    >
      <span className="min-w-0 truncate">{children}</span>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onRemove}
        className="focus-ring inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-fg-muted can-hover:bg-surface-active can-hover:text-fg disabled:cursor-not-allowed"
      >
        <XIcon className="size-3" />
      </button>
    </span>
  )
}

export { Chip, RemovableChip }
