// Workspace Compare (G6.1 A): up to four versions side by side under one axis gizmo, or the changes between
// the open version and a baseline.
import { useState, type ReactElement } from 'react'
import { Columns2, Diff as ChangesIcon, Layers } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import { Field } from '@/shared/ui/primitives/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { ViewerStage } from '@/entities/viewer/ui/ViewerOverlay'
import { Tip } from '@/shared/ui/common/Tip'
import {
  toggleComparedVersion,
  type ComparedVersion
} from '@/widgets/version-compare/model/comparison'
import { versionName } from '@/entities/build/model/workspace'
import type { ViewName } from '@/entities/viewer/model/look'
import { VoxelDiff } from './VoxelDiff'
import { ViewerGrid } from './ViewerGrid'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'

export type ComparisonMode = 'side-by-side' | 'changes'

function VersionPicker({
  versions,
  selected,
  onChange
}: {
  versions: ComparedVersion[]
  selected: string[]
  onChange: (paths: string[]) => void
}): ReactElement {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="viewer-overlay border-0">
          <Layers aria-hidden="true" />
          {selected.length} of 4 versions
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label="Versions to compare" className="w-80 p-2">
        <p className="px-2 py-1 text-sm text-fg-secondary">Choose up to four versions.</p>
        <div className="flex max-h-72 flex-col overflow-y-auto px-2">
          {versions.map((item) => (
            <Field
              key={item.path}
              label={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-mono break-all">{versionName(item.path)}</span>
                  <span className="text-xs text-fg-muted">
                    Java {item.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION}
                  </span>
                </span>
              }
              orientation="horizontal"
            >
              <Checkbox
                checked={selected.includes(item.path)}
                disabled={selected.length === 4 && !selected.includes(item.path)}
                onCheckedChange={() => onChange(toggleComparedVersion(selected, item.path))}
              />
            </Field>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function WorkspaceCompare({
  versions,
  version,
  base,
  view,
  clipY,
  mode,
  active = true,
  onViewChange
}: {
  versions: ComparedVersion[]
  version: ComparedVersion | null
  base: ComparedVersion | null
  view: ViewName
  clipY: number | null
  mode: ComparisonMode
  active?: boolean
  onViewChange?: (view: ViewName) => void
}): ReactElement {
  const [chosen, setChosen] = useState<string[] | null>(null)
  const [gizmoTarget, setGizmoTarget] = useState<HTMLDivElement | null>(null)
  const [visited, setVisited] = useState<ComparisonMode[]>([mode])
  if (!visited.includes(mode)) setVisited([...visited, mode])
  const selected = chosen ?? versions.slice(0, 2).map((item) => item.path)
  const files = versions.filter((item) => selected.includes(item.path))
  const picker = <VersionPicker versions={versions} selected={selected} onChange={setChosen} />

  return (
    <ViewerStage className="min-h-0">
      <div ref={setGizmoTarget} className="pointer-events-none absolute inset-0 z-floating" />
      <div className="h-full" hidden={mode !== 'side-by-side'}>
        {(mode === 'side-by-side' || visited.includes('side-by-side')) &&
          (files.length ? (
            <ViewerGrid
              files={files}
              view={view}
              onViewChange={active && mode === 'side-by-side' ? onViewChange : undefined}
              gizmoTarget={gizmoTarget}
              clipY={clipY}
              overlay={(path) => (
                <>
                  {path === files[0].path && picker}
                  <Tip label={versionName(path)}>
                    <span className="viewer-overlay min-w-0 truncate px-2 py-1 font-mono text-xs">
                      {versionName(path)}
                    </span>
                  </Tip>
                </>
              )}
            />
          ) : versions.length ? (
            <EmptyState icon={Columns2} title="Choose versions to compare" action={picker} />
          ) : (
            <EmptyState icon={Columns2} title="No versions to compare yet">
              Generate a draft to start comparing versions.
            </EmptyState>
          ))}
      </div>
      <div className="h-full" hidden={mode !== 'changes'}>
        {(mode === 'changes' || visited.includes('changes')) &&
          (version && base ? (
            <VoxelDiff
              a={base}
              b={version}
              view={view}
              onViewChange={active && mode === 'changes' ? onViewChange : undefined}
              gizmoTarget={gizmoTarget}
              clipY={clipY}
              active={active && mode === 'changes'}
            />
          ) : (
            <EmptyState icon={ChangesIcon} title="Two versions are needed to highlight changes">
              Generate another draft, then compare it with this one.
            </EmptyState>
          ))}
      </div>
    </ViewerStage>
  )
}
