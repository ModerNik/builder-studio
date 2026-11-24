// Dock groups and the panel sheet for narrower workbenches. Docks have no tab strip: the Panels toggles beside the
// screen tabs, the title-bar Chat toggle and their shortcuts show and hide them.
import type { ReactElement, ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { Maximize2, Minimize2, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { DockPanelSpec, DockSide, SheetSize } from '@/shared/lib/layout'
import { useWorkbench } from '../model/context'
import { IconButton, type TabBadgeTone } from '@/shared/ui/common/parts'
import { focusRing } from '@/shared/ui/common/styles'
import { useReturnFocus } from '@/shared/lib/focus'

export interface WorkbenchPanel extends DockPanelSpec {
  title: string
  icon: LucideIcon
  /** Toggle shortcut, e.g. `Ctrl+I`. */
  keys?: string
  badge?: number | 'dot'
  badgeLabel?: string
  /** `attention` for asks waiting on the user, `running` for live jobs, `danger` for failed jobs. */
  badgeTone?: TabBadgeTone
  /** Default width (right) or height (bottom) as a length token, e.g. `--dock-assistant`. */
  size?: string
  content: ReactNode
}

/** Every panel stays mounted, so a draft in the composer or a scroll position survives switching; one shows. */
function PanelStack({ panels, front }: { panels: WorkbenchPanel[]; front: string }): ReactNode {
  return panels.map((p) => (
    <div
      key={p.id}
      role="region"
      aria-label={p.title}
      hidden={p.id !== front}
      className={cn(focusRing, 'min-h-0 flex-1 overflow-auto focus-visible:-outline-offset-2')}
    >
      {p.content}
    </div>
  ))
}

/** One dock group: a right column or the bottom dock. Panels sharing it show the one toggled last. */
export function DockGroup({
  panels,
  value
}: {
  side: DockSide
  panels: WorkbenchPanel[]
  value: string
}): ReactElement {
  const front = panels.find((p) => p.id === value) ?? panels[0]
  return (
    <aside
      aria-label={front.title}
      data-workbench-region=""
      tabIndex={-1}
      className="flex h-full min-h-0 flex-col bg-surface-panel outline-none"
    >
      <PanelStack panels={panels} front={front.id} />
    </aside>
  )
}

/** The panel its toggle asked for, in a sheet: half or full height at tablet width, full screen on phones. Modal. */
export function PanelSheet({
  panels,
  tab,
  size,
  container
}: {
  panels: WorkbenchPanel[]
  tab: string | null
  size: SheetSize
  container: HTMLElement | null
}): ReactElement {
  const { dock, tier } = useWorkbench()
  const current = panels.find((p) => p.id === tab) ?? panels[0]
  const returnFocus = useReturnFocus()
  return (
    <Dialog.Root open={!!tab} onOpenChange={(open) => !open && dock({ type: 'close-sheet' })}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="workbench-scrim absolute inset-0 z-overlay bg-surface-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          {...returnFocus}
          // start on the sheet, not its first button: a focused button opens its tooltip over the panel
          onOpenAutoFocus={(e) => {
            returnFocus.onOpenAutoFocus()
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).focus()
          }}
          className={cn(
            'workbench-sheet absolute inset-x-0 bottom-0 z-modal flex flex-col overflow-hidden border-t border-border-default bg-surface-panel shadow-lg outline-none',
            size === 'full' ? 'top-0' : 'h-[min(60%,40rem)] rounded-t-xl'
          )}
        >
          {size === 'half' && (
            <span
              aria-hidden="true"
              className="mx-auto mt-1.5 h-1 w-9 shrink-0 rounded-full bg-border-strong"
            />
          )}
          <div className="flex h-[max(var(--shell-tabbar),var(--density-control))] shrink-0 items-center gap-1 border-b border-border-subtle ps-3 pe-0.5">
            <Dialog.Title className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-base font-medium [&_svg]:size-3.5">
              {current && <current.icon aria-hidden="true" />}
              {current?.title ?? 'Panels'}
            </Dialog.Title>
            {tier !== 'phone' && (
              <IconButton
                icon={size === 'full' ? Minimize2 : Maximize2}
                label={size === 'full' ? 'Half height' : 'Full height'}
                onClick={() =>
                  dock({ type: 'sheet-size', size: size === 'full' ? 'half' : 'full' })
                }
              />
            )}
            <Dialog.Close asChild>
              <IconButton icon={X} label={`Close ${current?.title ?? 'panels'}`} />
            </Dialog.Close>
          </div>
          {current && <PanelStack panels={panels} front={current.id} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
