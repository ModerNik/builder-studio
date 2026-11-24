import type { ReactElement } from 'react'
import { cn } from '@/shared/lib/utils'
import { IconButton, TabBadge } from '@/shared/ui/common/parts'
import { useWorkbench } from '../model/context'
import type { WorkbenchPanel } from './Dock'

/** A dock's toggle: pressed while its panel shows, with the panel's badge (Chat's "needs you" count, Activity's job dot). */
export function PanelToggle({ panel }: { panel: WorkbenchPanel }): ReactElement {
  const { dock, openPanels } = useWorkbench()
  const badge = panel.badge
  return (
    <span className="relative inline-flex">
      <IconButton
        icon={panel.icon}
        label={
          badge !== undefined && panel.badgeLabel
            ? `${panel.title}, ${panel.badgeLabel}`
            : panel.title
        }
        keys={panel.keys}
        aria-pressed={openPanels?.includes(panel.id)}
        onClick={() => dock({ type: 'toggle', id: panel.id })}
      />
      {badge !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute flex',
            badge === 'dot' ? 'end-1.5 top-1.5' : '-end-0.5 top-0.5'
          )}
        >
          <TabBadge badge={badge} tone={panel.badgeTone} />
        </span>
      )}
    </span>
  )
}
