import * as React from 'react'
import { XIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useFieldControl } from '@/shared/ui/primitives/field'

// The well every text control shares: sunken fill, strong border (3:1), danger border when invalid.
const inputSurface =
  'rounded-md border border-border-strong bg-surface-sunken text-(length:--density-text) text-fg transition-[border-color,background-color] duration-fast ease-standard aria-invalid:border-danger-solid'
const inputText =
  'min-w-0 cursor-text bg-transparent outline-none placeholder:text-fg-muted disabled:cursor-not-allowed selection:bg-selection file:me-2 file:h-full file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg'

type InputProps = React.ComponentProps<'input'> & {
  /** An icon or text before the value, e.g. a search icon. */
  leading?: React.ReactNode
  /** Text or a control after the value, e.g. a unit. */
  trailing?: React.ReactNode
  /** Shows a clear button while the (controlled) value is not empty. */
  onClear?: () => void
}

/** A one-line text input. With leading, trailing or onClear it becomes a group, and className styles the group. */
function Input({ className, type, leading, trailing, onClear, ...rest }: InputProps): React.ReactElement {
  const props = useFieldControl(rest)
  const plain = leading == null && trailing == null && !onClear
  if (plain)
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          inputSurface,
          inputText,
          'focus-ring h-(--density-control) w-full px-2 aria-invalid:focus-visible:outline-danger-solid disabled:opacity-50 [&[readonly]]:border-border-default [&[readonly]]:bg-transparent',
          className
        )}
        {...props}
      />
    )
  const clearable = !!onClear && props.value != null && props.value !== '' && !props.readOnly && !props.disabled
  return (
    <div
      data-slot="input-group"
      data-disabled={props.disabled || undefined}
      className={cn(
        inputSurface,
        'flex h-(--density-control) w-full items-center gap-1.5 px-2 has-[input:focus-visible]:outline-(length:--focus-width) has-[input:focus-visible]:outline-offset-(--focus-offset) has-[input:focus-visible]:outline-focus has-[input[aria-invalid=true]]:border-danger-solid has-[input[aria-invalid=true]:focus-visible]:outline-danger-solid has-[input[readonly]]:border-border-default has-[input[readonly]]:bg-transparent data-disabled:opacity-50 [&_svg:not([class*="size-"])]:size-4 [&>svg]:shrink-0 [&>svg]:text-fg-muted',
        className
      )}
    >
      {leading}
      <input
        type={type}
        data-slot="input"
        className={cn(inputText, 'h-full flex-1 self-stretch')}
        {...props}
      />
      {clearable && (
        <button
          type="button"
          aria-label="Clear"
          className="focus-ring -me-1 inline-flex size-(--density-control-xs) shrink-0 cursor-pointer items-center justify-center rounded-sm text-fg-muted can-hover:bg-surface-hover can-hover:text-fg"
          onClick={(e) => {
            onClear()
            e.currentTarget.parentElement?.querySelector('input')?.focus()
          }}
        >
          <XIcon className="size-3.5" />
        </button>
      )}
      {trailing != null && (
        <span className="shrink-0 text-sm text-fg-muted tabular-nums">{trailing}</span>
      )}
    </div>
  )
}

export { Input, inputSurface, type InputProps }
