// Two to four <BuildViewer>s on one pack context, cameras synced: side by side for two, 2×2 for three or
// four, one row of four once the grid is wider than 1600px.
import { useMemo, useRef, type ReactElement, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/shared/ui/primitives/button'
import { buildUrl } from '@/shared/lib/urls'
import { useMinecraftPack } from '@/entities/settings/model/settings'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { useContainerWidth } from '@/shared/lib/layout'
import { cn } from '@/shared/lib/utils'
import { ViewerStage } from '@/entities/viewer/ui/ViewerOverlay'
import { ViewerErrorCard, ViewerLoadingCard } from '@/entities/viewer/ui/ViewerCards'
import { BuildViewer, type Cell, type Marker } from '@/entities/viewer/ui/BuildViewer'
import { createViewSync } from '@/entities/viewer/model/view-sync'
import type { ViewName } from '@/entities/viewer/model/look'

export interface GridFile {
  path: string // repo-relative .litematic
  mtime: number
  minecraftVersion?: string
}

function GridCell({
  file,
  view,
  gizmoTarget,
  clipY,
  onViewChange,
  onPick,
  sync,
  markers,
  overlay,
  gizmoCell
}: {
  file: GridFile
  view: ViewName
  gizmoTarget?: HTMLElement | null
  clipY: number | null
  onViewChange?: (view: ViewName) => void
  onPick?: (p: { cell: Cell; state: string | undefined }) => void
  sync: ReturnType<typeof createViewSync>
  markers?: Marker[]
  overlay?: ReactNode
  gizmoCell: boolean
}): ReactElement {
  const minecraftVersion = file.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION
  const pack = useMinecraftPack(minecraftVersion)
  return (
    <ViewerStage key={file.path} className="min-h-0 min-w-0">
      {pack.data ? (
        <BuildViewer
          src={buildUrl(file.path, Math.round(file.mtime))}
          pack={pack.data}
          view={view}
          onViewChange={onViewChange}
          gizmoTarget={gizmoTarget}
          clipY={clipY}
          markers={markers}
          onPick={onPick}
          shared
          sync={sync}
        />
      ) : pack.isLoading ? (
        <ViewerLoadingCard label={`Preparing Minecraft ${minecraftVersion} textures…`} />
      ) : (
        <ViewerErrorCard
          title={`Minecraft ${minecraftVersion} textures could not be prepared`}
          details={String(pack.error ?? '')}
          actions={
            <Button variant="outline" asChild>
              <Link to="/settings" search={{ section: 'minecraft' }}>
                Open Settings
              </Link>
            </Button>
          }
        />
      )}
      <div
        className={cn(
          'pointer-events-none absolute top-(--viewer-inset) right-(--viewer-inset) left-(--viewer-inset) z-floating flex flex-wrap items-start gap-2 *:pointer-events-auto',
          gizmoCell && 'right-[calc(var(--viewer-gizmo-size)+2*var(--viewer-inset))]'
        )}
      >
        {overlay}
      </div>
    </ViewerStage>
  )
}

export function ViewerGrid({
  files,
  view,
  clipY = null,
  markers,
  onPick,
  onViewChange,
  gizmoTarget,
  overlay
}: {
  files: GridFile[]
  view: ViewName
  clipY?: number | null
  markers?: (path: string) => Marker[]
  onPick?: (path: string, p: { cell: Cell; state: string | undefined }) => void
  onViewChange?: (view: ViewName) => void
  /** One axis gizmo for the grid, drawn into this element; without it the last viewer draws its own. */
  gizmoTarget?: HTMLElement | null
  overlay?: (path: string) => ReactNode // label, pick button: drawn over each viewer
}): ReactElement {
  const sync = useMemo(() => createViewSync(), [])
  const box = useRef<HTMLDivElement>(null)
  const width = useContainerWidth(box)
  const n = files.length
  const columns = n <= 2 ? n || 1 : width > 1600 ? n : 2
  // the cell under the axis gizmo keeps its overlay clear of it
  const gizmoCell = !onViewChange ? -1 : gizmoTarget === undefined ? n - 1 : columns - 1
  return (
    <div
      ref={box}
      className="grid h-full auto-rows-fr gap-px bg-border-subtle"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {files.map((f, i) => (
        <GridCell
          key={f.path}
          file={f}
          view={view}
          onViewChange={i === n - 1 ? onViewChange : undefined}
          gizmoTarget={gizmoTarget}
          clipY={clipY}
          markers={markers?.(f.path)}
          onPick={onPick && ((p) => onPick(f.path, p))}
          sync={sync}
          overlay={overlay?.(f.path)}
          gizmoCell={i === gizmoCell}
        />
      ))}
    </div>
  )
}
