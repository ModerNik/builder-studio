// Combined Model list + stepped Reasoning Effort slider in a Popover.
// Uses a Popover (instead of DropdownMenu) so dragging and Left/Right arrow keys on the Slider
// never collide with Radix Menu focus handling, and changing the model keeps the popover open
// when reasoning effort can also be tuned.
import type { ReactElement } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover'
import { Slider } from '@/shared/ui/primitives/slider'
import { Tip } from '@/shared/ui/common/Tip'
import { cn } from '@/shared/lib/utils'
import { effortIndexOf, shortEffortStopLabel, type PickerOption } from '../model/modelEffort'

export function ModelEffortPicker({
  models = [],
  model = '',
  onModelChange,
  efforts = [],
  effort = '',
  onEffortChange,
  disabled = false,
  open,
  onOpenChange,
  className
}: {
  models?: PickerOption[]
  model?: string
  onModelChange?: (value: string) => void
  /** Omit or pass empty array when the provider has no reasoning effort setting (Ollama). */
  efforts?: PickerOption[]
  effort?: string
  onEffortChange?: (value: string) => void
  disabled?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}): ReactElement | null {
  if (!models.length && !efforts.length) return null

  const modelLabel = models.find((o) => o.value === model)?.label ?? model
  const effortIdx = effortIndexOf(efforts, effort)
  const activeEffort = efforts[effortIdx]
  const effortLabel = activeEffort?.label ?? effort
  const selectionLabel = [modelLabel, effortLabel].filter(Boolean).join(', ')
  const hasEffort = efforts.length > 0

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tip label={selectionLabel || 'Model and effort'}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            aria-label={selectionLabel || 'Model and effort'}
            className={cn(
              'h-(--density-control-sm) max-w-48 min-w-0 shrink justify-start gap-1.5 px-2 font-normal text-fg [&[data-state=open]_[data-slot=picker-chevron]]:rotate-180',
              className
            )}
          >
            <span className="min-w-0 truncate font-medium">{modelLabel}</span>
            {effortLabel && (
              <span className="shrink-0 text-sm text-fg-secondary">{effortLabel}</span>
            )}
            <ChevronDown
              data-slot="picker-chevron"
              className="size-3.5 shrink-0 text-fg-muted transition-transform duration-fast ease-standard motion-reduce:transition-none"
              aria-hidden
            />
          </Button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-2 p-2 shadow-lg"
      >
        {models.length > 0 && (
          <div role="radiogroup" aria-label="Model" className="flex flex-col gap-0.5">
            <span className="px-2 pt-0.5 pb-1 text-xs font-medium text-fg-muted">Model</span>
            {models.map((option) => {
              const selected = option.value === model
              const locked = !onModelChange
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={locked}
                  onClick={() => {
                    onModelChange?.(option.value)
                    if (!hasEffort) onOpenChange?.(false)
                  }}
                  className={cn(
                    'focus-ring flex min-h-(--density-row) w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1 text-left text-sm transition-colors duration-fast ease-standard',
                    selected
                      ? 'bg-accent-subtle/60 font-medium text-fg'
                      : 'text-fg-secondary can-hover:bg-surface-hover can-hover:text-fg',
                    locked && 'cursor-not-allowed opacity-60'
                  )}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {selected && <Check aria-hidden className="size-4 shrink-0 text-accent-text" />}
                </button>
              )
            })}
          </div>
        )}
        {hasEffort && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-surface-raised p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-fg-secondary">Reasoning effort</span>
              <span className="text-xs font-medium text-accent-text">{effortLabel}</span>
            </div>
            <Slider
              min={0}
              max={Math.max(1, efforts.length - 1)}
              step={1}
              stops={efforts.length}
              disabled={!onEffortChange || efforts.length <= 1}
              value={[effortIdx]}
              aria-label="Reasoning effort"
              aria-valuetext={effortLabel}
              onValueChange={([nextIdx]) => {
                const chosen = efforts[nextIdx]
                if (chosen) onEffortChange?.(chosen.value)
              }}
            />
            <div className="flex items-center justify-between gap-1">
              {efforts.map((item, idx) => {
                const active = idx === effortIdx
                return (
                  <button
                    key={item.value}
                    type="button"
                    disabled={!onEffortChange}
                    aria-pressed={active}
                    onClick={() => onEffortChange?.(item.value)}
                    className={cn(
                      'focus-ring cursor-pointer rounded-sm px-1 py-0.5 text-2xs transition-colors duration-fast ease-standard disabled:cursor-not-allowed disabled:opacity-50',
                      active ? 'font-semibold text-accent-text' : 'text-fg-muted can-hover:text-fg'
                    )}
                  >
                    {shortEffortStopLabel(item.value, item.label, efforts.length)}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
