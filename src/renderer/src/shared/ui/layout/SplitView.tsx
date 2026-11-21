// Two resizable panes with preset proportions. Narrower than `stackBelow` (its own width, not the window's)
// the panes stack, so a split inside a dock or a sheet behaves like one on a phone.
import { useRef, type ReactElement, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { focusRing } from '@/shared/ui/common/styles'
import { remPx, useContainerWidth } from '@/shared/lib/layout'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/shared/ui/primitives/resizable'

type Size = string
// a pane scrolls on its own, so it takes focus for keyboard scrolling (axe scrollable-region-focusable)
const pane = cn(focusRing, 'h-full overflow-auto focus-visible:-outline-offset-2')
// rem or %, as react-resizable-panels reads them
const PRESETS: Record<
  'list-detail' | 'detail-aside' | 'compare',
  { first: [Size, Size, Size]; second: [Size, Size, Size] }
> = {
  // [default, min, max]
  'list-detail': { first: ['20rem', '15rem', '50%'], second: ['60%', '40%', '100%'] },
  'detail-aside': { first: ['60%', '40%', '100%'], second: ['22.5rem', '17.5rem', '50%'] },
  compare: { first: ['50%', '25%', '75%'], second: ['50%', '25%', '75%'] }
}

export function SplitView({
  preset,
  first,
  second,
  labels,
  stackBelow = 48,
  className
}: {
  preset: keyof typeof PRESETS
  first: ReactNode
  second: ReactNode
  /** Region names, e.g. ['Builds', 'Details']. */
  labels: [string, string]
  stackBelow?: number
  className?: string
}): ReactElement {
  const box = useRef<HTMLDivElement>(null)
  const width = useContainerWidth(box)
  const stacked = width > 0 && width < stackBelow * remPx()
  const p = PRESETS[preset]
  return (
    <div ref={box} className={cn('min-h-0 min-w-0', className)}>
      <ResizablePanelGroup
        key={stacked ? 'v' : 'h'}
        orientation={stacked ? 'vertical' : 'horizontal'}
      >
        <ResizablePanel
          defaultSize={stacked ? '50%' : p.first[0]}
          minSize={stacked ? '20%' : p.first[1]}
          maxSize={stacked ? '80%' : p.first[2]}
        >
          <section aria-label={labels[0]} tabIndex={0} className={pane}>
            {first}
          </section>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          defaultSize={stacked ? '50%' : p.second[0]}
          minSize={stacked ? '20%' : p.second[1]}
          maxSize={stacked ? '80%' : p.second[2]}
        >
          <section aria-label={labels[1]} tabIndex={0} className={pane}>
            {second}
          </section>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
