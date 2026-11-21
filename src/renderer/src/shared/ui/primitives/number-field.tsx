import * as React from 'react'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useFieldControl } from '@/shared/ui/primitives/field'
import { inputSurface } from '@/shared/ui/primitives/input'
import { clampNumber, parseNumber, type Limits } from '@/shared/ui/primitives/math'

type NumberFieldProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'min' | 'max' | 'step'
> &
  Limits & {
    value: number | null
    onValueChange: (value: number | null) => void
    /** Shown after the number, e.g. "blocks" or "px". */
    unit?: string
    /** Hides the stepper buttons (keys still step). */
    hideStepper?: boolean
  }

/**
 * A number with a stepper: Arrow keys step, Shift+Arrow and Page keys step ×10, Home/End jump to min/max.
 * Typing is free; the value commits on blur or Enter, clamped. Empty commits null.
 */
function NumberField({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  unit,
  hideStepper,
  className,
  disabled,
  readOnly,
  onKeyDown,
  onBlur,
  ...rest
}: NumberFieldProps): React.ReactElement {
  const props = useFieldControl(rest)
  const limits = { min, max, step }
  const [draft, setDraft] = React.useState<string | null>(null)
  const shown = draft ?? (value == null ? '' : String(value))
  const locked = disabled || readOnly

  const commit = (next: number | null): void => {
    setDraft(null)
    const v = next == null ? null : clampNumber(next, limits)
    if (v !== value) onValueChange(v)
  }
  const nudge = (times: number): void => {
    const base = (draft != null ? parseNumber(draft) : value) ?? min ?? 0
    commit(base + times * step)
  }

  const key = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    onKeyDown?.(e)
    if (e.defaultPrevented || locked) return
    const big = e.shiftKey ? 10 : 1
    const moves: Record<string, () => void> = {
      ArrowUp: () => nudge(big),
      ArrowDown: () => nudge(-big),
      PageUp: () => nudge(10),
      PageDown: () => nudge(-10),
      Home: () => min != null && commit(min),
      End: () => max != null && commit(max),
      Enter: () => draft != null && commit(parseNumber(draft) ?? value)
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    move()
  }

  const stepButton =
    'flex w-(--density-control-sm) shrink-0 cursor-pointer items-center justify-center text-fg-secondary can-hover:bg-surface-hover can-hover:text-fg disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div
      data-slot="number-field"
      data-disabled={disabled || undefined}
      className={cn(
        inputSurface,
        'flex h-(--density-control) w-full items-stretch overflow-hidden has-[input:focus-visible]:outline-(length:--focus-width) has-[input:focus-visible]:outline-offset-(--focus-offset) has-[input:focus-visible]:outline-focus has-[input[aria-invalid=true]]:border-danger-solid has-[input[readonly]]:border-border-default has-[input[readonly]]:bg-transparent data-disabled:opacity-50',
        className
      )}
    >
      <input
        type="text"
        inputMode="decimal"
        role="spinbutton"
        autoComplete="off"
        aria-valuenow={value ?? undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={value == null ? undefined : unit ? `${value} ${unit}` : undefined}
        data-slot="number-field-input"
        disabled={disabled}
        readOnly={readOnly}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={key}
        onBlur={(e) => {
          onBlur?.(e)
          if (draft != null) commit(draft.trim() === '' ? null : (parseNumber(draft) ?? value))
        }}
        className="h-full min-w-0 flex-1 cursor-text bg-transparent px-2 font-mono text-(length:--density-text) tabular-nums outline-none selection:bg-selection placeholder:text-fg-muted disabled:cursor-not-allowed"
        {...props}
      />
      {unit && (
        <span aria-hidden className="flex items-center pe-2 text-sm text-fg-muted">
          {unit}
        </span>
      )}
      {!hideStepper && (
        <div className="flex border-s border-border-default">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Decrease"
            disabled={locked || (min != null && value != null && value <= min)}
            onClick={() => nudge(-1)}
            className={stepButton}
          >
            <MinusIcon className="size-3.5" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Increase"
            disabled={locked || (max != null && value != null && value >= max)}
            onClick={() => nudge(1)}
            className={cn(stepButton, 'border-s border-border-default')}
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

export { NumberField }
