// Palette strip: block tiles in a row on viewer grey, the result of every Palette tool and the Styles
// keys. Each tile is a button that copies its block id. With `check`, bars under the tiles show each one's
// lightness and the step from the tile before; steps that read badly turn amber and say why.
import type { ReactElement, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/primitives/badge'
import { useCopy } from '@/shared/ui/common/copy'
import { BreakableId } from './ImageCards'
import { shadeSteps } from './palette'

export interface PaletteBlock {
  /** Block id without minecraft:, e.g. "deepslate_bricks". */
  id: string
  /** The block's colour (from the measured block colours); missing draws a dashed tile. */
  color?: string | null
  /** OKLab lightness, 0–1. */
  l?: number
}

const SIZES = {
  sm: 'w-18', // 72: inline and Styles keys; no L value
  md: 'w-24', // 96: tool results
  lg: 'w-30' // 120: pinned palettes
} as const
type Size = keyof typeof SIZES

const lText = (l: number): string => l.toFixed(2)

export function PaletteTile({
  block,
  size = 'md',
  selected,
  onSelect
}: {
  block: PaletteBlock
  size?: Size
  selected?: boolean
  /** Also called on click, after the copy. */
  onSelect?: () => void
}): ReactElement {
  const { copied, copy } = useCopy()
  const showL = size !== 'sm' && block.l != null
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${block.id}${block.l != null ? `, L ${lText(block.l)}` : ''}${block.color ? '' : ', no texture'}, click to copy`}
      onClick={() => {
        copy(block.id)
        onSelect?.()
      }}
      className={cn(
        'focus-ring flex shrink-0 cursor-pointer flex-col gap-1 rounded-md border border-transparent p-1.5 text-start transition-colors duration-fast ease-standard can-hover:hover:bg-surface-overlay aria-pressed:border-accent-solid aria-pressed:bg-surface-overlay',
        SIZES[size]
      )}
    >
      <span
        className={cn(
          'relative aspect-square w-full rounded-sm',
          block.color
            ? 'shadow-[inset_0_0_0_1px_var(--color-border-strong)]'
            : 'border border-dashed border-fg-muted'
        )}
        // block colours are data, not chrome, so they come in as values
        style={block.color ? { background: block.color } : undefined}
      >
        {copied && (
          <span className="absolute inset-x-0 bottom-1 flex justify-center">
            <Badge variant="success">
              <Check aria-hidden />
              Copied
            </Badge>
          </span>
        )}
      </span>
      <span className="font-mono text-2xs break-words text-fg">
        <BreakableId id={block.id} />
      </span>
      {showL && (
        <span className="font-mono text-2xs text-fg-secondary tabular-nums">
          L {lText(block.l!)}
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? `Copied ${block.id}` : ''}
      </span>
    </button>
  )
}

export function PaletteStrip({
  blocks,
  label,
  size = 'md',
  check = false,
  selected,
  onSelect,
  summary,
  className
}: {
  blocks: PaletteBlock[]
  /** Names the list for screen readers, e.g. "Ramp from deepslate to calcite". */
  label: string
  size?: Size
  /** Lightness bars and step labels under the tiles (ramps); needs `l` on every block. */
  check?: boolean
  /** The selected block id. */
  selected?: string
  onSelect?: (id: string) => void
  /** The check line: range, hue swing and the problems in words. */
  summary?: ReactNode
  className?: string
}): ReactElement {
  const steps = check ? shadeSteps(blocks.map((b) => b.l ?? 0)) : []
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 rounded-lg bg-surface-viewer p-2', className)}>
      <ul aria-label={label} className="flex flex-wrap gap-1">
        {blocks.map((b, i) => {
          const step = i > 0 ? steps[i - 1] : undefined
          return (
            <li key={`${b.id}-${i}`} className="flex flex-col">
              <PaletteTile
                block={b}
                size={size}
                selected={selected === b.id}
                onSelect={onSelect && (() => onSelect(b.id))}
              />
              {check && (
                <span className="flex flex-col gap-1 px-1.5 pb-1">
                  <span
                    aria-hidden="true"
                    className="flex h-10 items-end rounded-xs bg-surface-sunken"
                  >
                    <span
                      className={cn(
                        'w-full rounded-xs',
                        step?.problem ? 'bg-warning-solid' : 'bg-fg-muted'
                      )}
                      style={{ height: `${Math.round((b.l ?? 0) * 100)}%` }}
                    />
                  </span>
                  <span
                    className={cn(
                      'font-mono text-2xs tabular-nums',
                      step?.problem ? 'text-warning-text' : 'text-fg-muted'
                    )}
                  >
                    {step ? `${step.delta >= 0 ? '+' : ''}${step.delta.toFixed(2)}` : 'start'}
                    {step?.problem && (
                      <span className="sr-only">
                        {step.problem === 'close'
                          ? ', too close to the one before'
                          : ', a big jump'}
                      </span>
                    )}
                  </span>
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {summary && <p className="px-1.5 text-sm text-fg-secondary">{summary}</p>}
    </div>
  )
}
