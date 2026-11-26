import type { ReactElement } from 'react'
import { cn } from '@/shared/lib/utils'
import { formatKeys } from '@/shared/lib/shortcuts'
import { Tip } from '@/shared/ui/common/Tip'
import { IconButton, TabBadge } from '@/shared/ui/common/parts'
import { chromeButton } from '@/shared/ui/common/styles'
import { useWorkbench } from '../model/context'
import type { WorkbenchPanel } from './Dock'

/**
 * A dock's toggle: pressed while its panel shows, with the panel's badge (Chat's "needs you" count,
 * Activity's job dot). Right-side panels (Editor, Chat) can show a labelled pill on wide/desktop
 * widths and collapse to icon-only on compact widths; bottom panels (Activity) stay icon-only.
 */
export function PanelToggle({
  panel,
  showLabel = false
}: {
  panel: WorkbenchPanel
  showLabel?: boolean
}): ReactElement {
  const { dock, openPanels } = useWorkbench()
  const open = !!openPanels?.includes(panel.id)
  const badge = panel.badge
  const labeled = showLabel && panel.side === 'right'
  const accessibleLabel =
    badge !== undefined && panel.badgeLabel ? `${panel.title}, ${panel.badgeLabel}` : panel.title

  if (labeled) {
    const Icon = panel.icon
    const tipLabel = panel.keys
      ? `${accessibleLabel} (${formatKeys(panel.keys).join(' ')})`
      : accessibleLabel
    return (
      <Tip side="bottom" label={tipLabel}>
        <button
          type="button"
          aria-label={accessibleLabel}
          aria-keyshortcuts={panel.keys?.replaceAll('Ctrl', 'Control')}
          aria-pressed={open}
          onClick={() => dock({ type: 'toggle', id: panel.id })}
          className={cn(
            chromeButton,
            'h-[max(2rem,var(--density-control-sm))] border px-2.5 text-xs font-medium',
            open
              ? 'border-border-default bg-surface-hover text-fg aria-pressed:text-fg'
              : 'border-transparent text-fg-secondary'
          )}
        >
          <Icon
            aria-hidden="true"
            className={cn('size-3.5 shrink-0', open ? 'text-accent-text' : 'text-fg-muted')}
          />
          <span>{panel.title}</span>
          {badge !== undefined && <TabBadge badge={badge} tone={panel.badgeTone} />}
        </button>
      </Tip>
    )
  }

  return (
    <span className="relative inline-flex">
      <IconButton
        size="sm"
        icon={panel.icon}
        label={accessibleLabel}
        keys={panel.keys}
        aria-pressed={open}
        className={cn(
          'border',
          open ? 'border-border-default bg-surface-hover' : 'border-transparent'
        )}
        onClick={() => dock({ type: 'toggle', id: panel.id })}
      />
      {badge !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute flex',
            badge === 'dot' ? 'end-1 top-1' : '-end-0.5 -top-0.5'
          )}
        >
          <TabBadge badge={badge} tone={panel.badgeTone} />
        </span>
      )}
    </span>
  )
}
