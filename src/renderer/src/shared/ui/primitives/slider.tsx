import * as React from 'react'
import { Slider as SliderPrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  /** Shows the current value after the track, formatted by formatValue. */
  showValue?: boolean
  /** Formats the shown value and the thumb's aria-valuetext, e.g. (v) => `${v} blocks`. */
  formatValue?: (value: number) => string
  /** Optional discrete step count for horizontal stepped sliders: renders aligned dots along the track. */
  stops?: number
}

/**
 * Arrow keys move one step, Page Up/Down and Shift+Arrow ten, Home/End to the ends.
 * Give it an aria-label (or wrap it in a Field) so the thumb has a name.
 */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  onValueChange,
  showValue = false,
  formatValue,
  stops,
  'aria-label': ariaLabel,
  'aria-valuetext': ariaValueText,
  ...props
}: SliderProps): React.ReactElement {
  const [own, setOwn] = React.useState(() =>
    Array.isArray(defaultValue) ? defaultValue : [min, max]
  )
  const values = Array.isArray(value) ? value : own
  const text = (v: number): string => (formatValue ? formatValue(v) : String(v))
  const activeValue = values[0] ?? min
  const showStops =
    stops !== undefined && stops > 1 && props.orientation !== 'vertical' && max > min

  const slider = (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      onValueChange={(v) => {
        setOwn(v)
        onValueChange?.(v)
      }}
      className={cn(
        'relative flex w-full cursor-pointer touch-none items-center select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[orientation=horizontal]:h-(--density-control-sm) data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        !showValue && className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-full bg-surface-active data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-accent-solid data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
        />
      </SliderPrimitive.Track>
      {showStops && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-1.5 flex items-center justify-between"
        >
          {Array.from({ length: stops }, (_, index) => {
            const stopVal = min + ((max - min) * index) / (stops - 1)
            const reached = stopVal <= activeValue + 1e-6
            return (
              <span
                key={index}
                className={cn(
                  'size-2 rounded-full transition-colors duration-fast ease-standard',
                  reached ? 'bg-accent-solid' : 'bg-border-strong'
                )}
              />
            )
          })}
        </span>
      )}
      {values.map((v, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={ariaLabel}
          aria-valuetext={ariaValueText ?? (formatValue ? text(v) : undefined)}
          className="focus-ring relative z-10 block size-3.5 shrink-0 rounded-full border-2 border-accent-solid bg-surface-panel shadow-sm transition-[border-color] duration-fast ease-standard before:absolute before:-inset-2 before:content-[''] can-hover:border-accent-solid-hover data-disabled:border-border-strong"
        />
      ))}
    </SliderPrimitive.Root>
  )
  if (!showValue) return slider
  return (
    <div data-slot="slider-group" className={cn('flex w-full items-center gap-3', className)}>
      {slider}
      <output
        aria-hidden
        className="min-w-[4ch] shrink-0 text-end font-mono text-sm text-fg-secondary tabular-nums"
      >
        {values.map(text).join('–')}
      </output>
    </div>
  )
}

export { Slider, type SliderProps }
