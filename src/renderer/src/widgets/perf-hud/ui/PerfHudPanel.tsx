import type { ReactElement } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import type { PerfGroup } from '../model/perf'

/** The dev performance HUD: grouped label/value rows in a small floating card. Renders from props only. */
export function PerfHudPanel({
  groups,
  onClose,
  className
}: {
  groups: PerfGroup[]
  onClose?: () => void
  className?: string
}): ReactElement {
  return (
    <section
      aria-label="Performance"
      className={cn(
        'w-72 rounded-lg border border-border-default bg-surface-overlay p-3 text-fg shadow-md',
        className
      )}
    >
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Performance</h2>
        {onClose && (
          <IconButton label="Close" shortcut="Ctrl+Shift+P" size="icon-xs" onClick={onClose}>
            <X />
          </IconButton>
        )}
      </header>
      {groups.length === 0 && <p className="text-sm text-fg-secondary">Sampling…</p>}
      {groups.map((g) => (
        <dl key={g.title} className="mb-2 last:mb-0">
          <dt className="mb-1 text-xs font-medium tracking-wide text-fg-secondary uppercase">
            {g.title}
          </dt>
          {g.rows.map((r) => (
            <dd key={r.label} className="flex justify-between gap-3 font-mono text-xs tabular-nums">
              <span className="shrink-0 text-fg-secondary">{r.label}</span>
              <span
                className={cn(
                  'truncate text-right',
                  r.tone === 'bad' && 'text-danger-text',
                  r.tone === 'warn' && 'text-warning-text'
                )}
              >
                {r.value}
              </span>
            </dd>
          ))}
        </dl>
      ))}
    </section>
  )
}
