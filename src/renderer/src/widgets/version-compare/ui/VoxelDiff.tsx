// Voxel diff: the bridge's diff(a, b, tint) writes lime (added), red (removed) and yellow (changed) stained glass
// into builds/<name>/out/.diff/<a>__<b>/, drawn over b in the same viewer, each kind toggled on its own.
import { useState, type ReactElement } from 'react'
import { Link } from '@tanstack/react-router'
import { Wrench } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
import { ViewerStage, ViewerToolbar, ViewerToolbarButton } from '@/entities/viewer/ui/ViewerOverlay'
import { ViewerErrorCard, ViewerLoadingCard } from '@/entities/viewer/ui/ViewerCards'
import { cn } from '@/shared/lib/utils'
import { buildUrl } from '@/shared/lib/urls'
import { useAvailability } from '@/entities/availability/model/availability'
import { useMinecraftPack } from '@/entities/settings/model/settings'
import { errorText } from '@/entities/build/model/workspace'
import { BuildViewer } from '@/entities/viewer/ui/BuildViewer'
import type { ViewName } from '@/entities/viewer/model/look'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import type { ComparedVersion } from '@/widgets/version-compare/model/comparison'
import { useVoxelDiff } from '../model/diff'

const KINDS = [
  ['added', 'var(--diff-added-mark)'],
  ['removed', 'var(--diff-removed-mark)'],
  ['changed', 'var(--diff-changed-mark)']
] as const
type Kind = (typeof KINDS)[number][0]
const LABELS: Record<Kind, string> = { added: 'Added', removed: 'Removed', changed: 'Changed' }

export function VoxelDiff({
  a,
  b,
  view,
  onViewChange,
  gizmoTarget,
  clipY = null,
  active = true
}: {
  a: ComparedVersion // the older file
  b: ComparedVersion // the newer one, drawn under the glass
  view: ViewName
  onViewChange?: (view: ViewName) => void
  gizmoTarget?: HTMLElement | null
  clipY?: number | null
  active?: boolean
}): ReactElement {
  const availability = useAvailability()
  const engine = !!availability.data?.features.engine.ok
  const minecraftVersion = b.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION
  const pack = useMinecraftPack(minecraftVersion)
  const diff = useVoxelDiff(a, b, minecraftVersion, active && engine)
  const [shown, setShown] = useState<Record<Kind, boolean>>({
    added: true,
    removed: true,
    changed: true
  })
  const v = diff.dataUpdatedAt // the files are rewritten in place: bust the fetch cache
  const kinds = KINDS.filter(([k]) => diff.data?.paths[k])
  if (!engine)
    return availability.isFetching ? (
      <LoadingState label="Checking build tools…" className="m-auto" />
    ) : (
      <EmptyState
        icon={Wrench}
        title="Highlighting changes needs the build tools"
        action={
          <Button variant="outline" asChild>
            <Link to="/settings" search={{ section: 'tools' }}>
              Open Settings
            </Link>
          </Button>
        }
      />
    )
  if (!pack.data)
    return pack.isLoading ? (
      <ViewerStage>
        <ViewerLoadingCard label={`Preparing Minecraft ${minecraftVersion} textures…`} />
      </ViewerStage>
    ) : (
      <ViewerStage>
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
      </ViewerStage>
    )
  return (
    <ViewerStage>
      <BuildViewer
        src={buildUrl(b.path, Math.round(b.mtime))}
        pack={pack.data}
        view={view}
        onViewChange={onViewChange}
        gizmoTarget={gizmoTarget}
        clipY={clipY}
        shared
        overlays={kinds.map(([k]) => ({
          src: buildUrl(diff.data!.paths[k]!, v),
          visible: shown[k]
        }))}
      />
      {diff.data && (
        <ViewerToolbar label="Changes">
          {KINDS.map(([k, color]) => (
            <ViewerToolbarButton
              key={k}
              onClick={() => setShown((s) => ({ ...s, [k]: !s[k] }))}
              disabled={!diff.data.paths[k]}
              aria-pressed={shown[k]}
              className={cn('gap-1.5 px-2 text-xs', !shown[k] && 'text-fg-muted line-through')}
            >
              <span
                aria-hidden="true"
                className="size-3 rounded-xs"
                style={{ background: color }}
              />
              {LABELS[k]}
              <span className="font-mono tabular-nums">{diff.data[k].toLocaleString()}</span>
            </ViewerToolbarButton>
          ))}
        </ViewerToolbar>
      )}
      {diff.isFetching && <ViewerLoadingCard label="Comparing versions…" />}
      {diff.error && (
        <ViewerErrorCard
          title="These versions could not be compared"
          details={errorText(diff.error)}
          actions={
            <Button size="sm" variant="outline" onClick={() => void diff.refetch()}>
              Try again
            </Button>
          }
        />
      )}
    </ViewerStage>
  )
}
