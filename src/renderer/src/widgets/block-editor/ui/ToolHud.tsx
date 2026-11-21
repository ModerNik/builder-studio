// The tool HUD (DESIGN › Tool HUD): the tool and its settings, or what Select selected, on one line in the
// viewer's bottom-start corner, so they show with the Editor panel closed. Read-only; the Edit tab changes them.
import type { ReactElement } from 'react'
import { Kbd } from '@/shared/ui/primitives/kbd'
import { ViewerOverlay } from '@/entities/viewer/ui/ViewerOverlay'

export function ToolHud({
  label,
  summary,
  keys
}: {
  label: string
  summary: string
  /** Keys that work now, each with what it does: "- = size". */
  keys: { keys: string[]; label: string }[]
}): ReactElement {
  return (
    // viewer-hud: the rail stops above it (viewer.css)
    <ViewerOverlay
      role="status"
      className="viewer-hud pointer-events-none absolute bottom-(--viewer-inset) left-(--viewer-inset) z-floating flex h-7 max-w-[calc(100%-6rem)] items-center gap-2 px-2 text-xs whitespace-nowrap"
    >
      <span className="font-medium">{label}</span>
      <span className="min-w-0 truncate text-fg-secondary">{summary}</span>
      {keys.map((k) => (
        <span key={k.label} className="flex shrink-0 items-center gap-1 text-fg-muted">
          {k.keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
          {k.label}
        </span>
      ))}
    </ViewerOverlay>
  )
}
