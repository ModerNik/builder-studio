// Viewer controls: the parts toolbar (colour by Blocks or Parts, Isolate, n selected) and the
// clip height control ([ and ] step a layer).
import type { ReactElement } from 'react'
import { Toolbar } from 'radix-ui'
import { Focus, Layers, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Slider } from '@/shared/ui/primitives/slider'
import { useShortcuts } from '@/shared/lib/shortcuts'
import { ViewerOverlay, ViewerSegmented, ViewerToolbarSeparator } from './ViewerOverlay'
import { viewerToolButton } from '../model/styles'

export type ColorBy = 'blocks' | 'parts'

export function PartsToolbar({
  colorBy,
  onColorBy,
  isolate,
  onIsolate,
  selected,
  onClear,
  className
}: {
  colorBy: ColorBy
  onColorBy: (v: ColorBy) => void
  isolate: boolean
  onIsolate: (on: boolean) => void
  /** Parts picked in the inspector or the view. */
  selected: number
  onClear: () => void
  className?: string
}): ReactElement {
  const none = selected === 0
  return (
    <Toolbar.Root
      aria-label="Parts"
      className={cn('viewer-overlay flex flex-wrap items-center gap-0.5 p-1 text-fg', className)}
    >
      <span className="px-1.5 text-xs text-fg-muted">Color by</span>
      <ViewerSegmented
        label="Color by"
        value={colorBy}
        onChange={onColorBy}
        options={[
          { value: 'blocks', label: 'Blocks' },
          { value: 'parts', label: 'Parts' }
        ]}
      />
      <ViewerToolbarSeparator />
      <Toolbar.Button
        aria-pressed={isolate}
        disabled={none}
        onClick={() => onIsolate(!isolate)}
        title={none ? 'Pick a part to isolate it' : 'Show only the selected parts'}
        className={cn(viewerToolButton, 'aria-pressed:bg-accent-subtle')}
      >
        <Focus aria-hidden="true" />
        Isolate
      </Toolbar.Button>
      {!none && (
        <>
          <ViewerToolbarSeparator />
          <span className="px-1.5 text-sm text-fg-secondary tabular-nums" aria-live="polite">
            {selected} selected
          </span>
          <Toolbar.Button
            aria-label="Clear the selection"
            title="Clear the selection"
            onClick={onClear}
            className={viewerToolButton}
          >
            <X aria-hidden="true" />
          </Toolbar.Button>
        </>
      )}
    </Toolbar.Root>
  )
}

/**
 * Clip height: layers above Y are hidden. At `max` every layer shows. Vertical stands beside the viewer
 * (Workspace A): the readout on top, the track running up, so higher on screen is higher in the build.
 */
export function ClipHeightControl({
  value,
  min,
  max,
  onChange,
  shortcuts = true,
  orientation = 'horizontal',
  className
}: {
  value: number
  min: number
  max: number
  onChange: (y: number) => void
  /** Register [ and ] (one control per screen does). */
  shortcuts?: boolean
  orientation?: 'horizontal' | 'vertical'
  className?: string
}): ReactElement {
  const clamp = (y: number): number => Math.min(max, Math.max(min, y))
  useShortcuts(
    shortcuts
      ? [
          {
            keys: '[',
            label: 'Clip one layer lower',
            group: 'View',
            run: () => onChange(clamp(value - 1))
          },
          {
            keys: ']',
            label: 'Clip one layer higher',
            group: 'View',
            run: () => onChange(clamp(value + 1))
          }
        ]
      : []
  )
  const all = value >= max
  const vertical = orientation === 'vertical'
  const readout = (
    <output
      className={cn(
        'min-w-0 shrink-0 font-mono text-xs text-fg tabular-nums',
        vertical ? 'text-center' : 'text-right'
      )}
      style={{ width: `${Math.max(3, 2 + Math.max(String(min).length, String(max).length))}ch` }}
      aria-hidden="true"
    >
      {all ? 'All' : `Y ${value}`}
    </output>
  )
  const slider = (
    <Slider
      aria-label="Clip height"
      aria-valuetext={all ? 'All layers' : `Y ${value}`}
      aria-keyshortcuts="[ ]"
      orientation={orientation}
      min={min}
      max={max}
      step={1}
      value={[value]}
      onValueChange={([y]) => onChange(y)}
      className={vertical ? 'min-h-44 flex-1' : 'w-28'}
    />
  )
  return vertical ? (
    <ViewerOverlay
      className={cn(
        'flex min-w-(--density-control) flex-col items-center gap-2 px-1.5 py-2.5',
        className
      )}
    >
      <Layers aria-hidden="true" className="size-4 shrink-0 text-fg-secondary" />
      {readout}
      {slider}
    </ViewerOverlay>
  ) : (
    <ViewerOverlay
      className={cn('flex h-(--density-control) items-center gap-2 px-2.5', className)}
    >
      <Layers aria-hidden="true" className="size-4 shrink-0 text-fg-secondary" />
      <span aria-hidden="true" className="text-sm text-fg-secondary">
        Height
      </span>
      {slider}
      {readout}
    </ViewerOverlay>
  )
}
