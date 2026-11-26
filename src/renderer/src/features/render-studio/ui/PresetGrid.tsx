// Visual preset swatch grid for Render Studio (shared with /kit).
import type { ReactElement } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Tip } from '@/shared/ui/common/Tip'
import { RENDER_PRESETS, type PresetId } from '@/entities/viewer/lib/cinematic/presets'

export function PresetGrid({
  value,
  onChange
}: {
  value: PresetId
  onChange: (preset: Exclude<PresetId, 'custom'>) => void
}): ReactElement {
  return (
    <div role="radiogroup" aria-label="Render look presets" className="grid grid-cols-2 gap-2">
      {RENDER_PRESETS.map((preset) => {
        const active = value === preset.id
        return (
          <Tip key={preset.id} label={preset.description}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(preset.id)}
              className={cn(
                'focus-ring group relative flex flex-col overflow-hidden rounded-md border text-start transition-colors duration-fast ease-standard',
                active
                  ? 'border-accent-solid bg-accent-subtle text-fg'
                  : 'border-border-default bg-surface-raised text-fg-secondary can-hover:border-border-strong can-hover:text-fg'
              )}
            >
              <div
                aria-hidden="true"
                className="relative h-9 w-full border-b border-border-subtle"
                style={{ background: preset.swatch }}
              >
                {active && (
                  <span className="absolute end-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-accent-solid text-accent-on-solid shadow-xs">
                    <Check className="size-3" strokeWidth={2.5} />
                  </span>
                )}
              </div>
              <span className="truncate px-2 py-1.5 text-xs font-medium">{preset.name}</span>
            </button>
          </Tip>
        )
      })}
    </div>
  )
}
