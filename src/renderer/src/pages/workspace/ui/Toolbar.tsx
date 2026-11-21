// Workspace toolbar (DESIGN › Workspace toolbar): version, view, projection, comparison, export and build actions.
import type { ReactElement, Ref } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Box,
  Columns2,
  Diff as ChangesIcon,
  Image,
  MoreHorizontal,
  Pyramid,
  Rocket
} from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import { Shortcut } from '@/shared/ui/primitives/kbd'
import { Toggle } from '@/shared/ui/primitives/toggle'
import { Tip } from '@/shared/ui/common/Tip'
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/primitives/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/shared/ui/primitives/dropdown-menu'
import { versionName, type BuildVersion } from '@/entities/build/model/workspace'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { useProjection } from '@/entities/viewer/model/projection'
import type { ComparisonMode } from '@/widgets/version-compare/ui/Compare'

export type WorkspaceView = '3d' | 'sheet' | 'compare'

const VIEW_ITEMS = [
  { id: '3d', label: '3D', icon: Box, keys: '1' },
  { id: 'sheet', label: 'Preview', icon: Image, keys: '2' },
  { id: 'compare', label: 'Compare', icon: Columns2, keys: '3' }
] as const
const MODE_ITEMS = [
  { id: 'side-by-side', label: 'Side by side', icon: Columns2, keys: '3' },
  { id: 'changes', label: 'Highlight changes', icon: ChangesIcon, keys: '4' }
] as const
// folds below 1100px of toolbar width
const fold = '@max-[68.75rem]:sr-only'

/** A view or mode segment: the icon alone, its name and key in the tooltip. */
function IconSegment({
  item
}: {
  item: (typeof VIEW_ITEMS)[number] | (typeof MODE_ITEMS)[number]
}): ReactElement {
  return (
    <Tip
      side="bottom"
      label={
        <>
          {item.label}
          <Shortcut keys={item.keys} />
        </>
      }
    >
      <SegmentedControlItem
        value={item.id}
        aria-label={item.label}
        aria-keyshortcuts={item.keys}
        className="flex-none"
      >
        <item.icon aria-hidden="true" />
      </SegmentedControlItem>
    </Tip>
  )
}

function VersionSelect({
  label,
  value,
  versions,
  empty,
  onChange
}: {
  label: string
  value: string
  versions: BuildVersion[]
  empty: string
  onChange: (path: string) => void
}): ReactElement {
  return (
    <Select value={value} onValueChange={onChange} disabled={!versions.length}>
      <SelectTrigger size="sm" aria-label={label} className="w-40 font-mono @max-[30rem]:w-32">
        <SelectValue placeholder={empty} />
      </SelectTrigger>
      <SelectContent>
        {versions.map((v) => (
          <SelectItem
            key={v.path}
            value={v.path}
            className="font-mono"
            description={`Minecraft Java ${v.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION}`}
          >
            {versionName(v.path)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function WorkspaceToolbar({
  name,
  onUpgradeTarget,
  canUpgradeTarget,
  versions,
  version,
  onVersion,
  view,
  onView,
  mode,
  onMode,
  base,
  onBase,
  canDraft,
  onDraft,
  onDraftSettings,
  canImport,
  onImport,
  canDelete,
  onDelete,
  moreRef,
  onMenuCloseFocus
}: {
  name: string
  onUpgradeTarget: () => void
  canUpgradeTarget: boolean
  versions: BuildVersion[]
  version: BuildVersion | null
  onVersion: (path: string) => void
  view: WorkspaceView
  onView: (view: WorkspaceView) => void
  mode: ComparisonMode
  onMode: (mode: ComparisonMode) => void
  base: { path: string } | null
  onBase: (path: string) => void
  canDraft: boolean
  onDraft: () => void
  onDraftSettings: () => void
  canImport: boolean
  onImport: () => void
  canDelete: boolean
  onDelete: () => void
  moreRef: Ref<HTMLButtonElement>
  /** True when a dialog opened from the menu takes focus instead of the More button. */
  onMenuCloseFocus: () => boolean
}): ReactElement {
  const others = versions.filter((v) => v.path !== version?.path)
  const perspective = useProjection((s) => s.projection === 'perspective')
  return (
    <div className="@container shrink-0 border-b border-border-subtle bg-surface-panel">
      <div className="flex min-h-12 flex-wrap items-center gap-2 px-3 py-1.5">
        <h1 className="sr-only">{name}</h1>
        <VersionSelect
          label="Version"
          value={version?.path ?? ''}
          versions={versions}
          empty="No versions yet"
          onChange={onVersion}
        />
        <SegmentedControl
          size="sm"
          aria-label="Build view"
          value={view}
          onValueChange={(v) => onView(v as WorkspaceView)}
        >
          {VIEW_ITEMS.map((item) => (
            <IconSegment key={item.id} item={item} />
          ))}
        </SegmentedControl>
        {view === '3d' && (
          <Tip label="Perspective">
            <Toggle
              size="sm"
              aria-label="Perspective"
              pressed={perspective}
              onPressedChange={(on) =>
                useProjection.setState({ projection: on ? 'perspective' : 'isometric' })
              }
            >
              <Pyramid aria-hidden="true" />
            </Toggle>
          </Tip>
        )}
        {view === 'compare' && (
          <SegmentedControl
            size="sm"
            aria-label="Comparison mode"
            value={mode}
            onValueChange={(v) => onMode(v as ComparisonMode)}
          >
            {MODE_ITEMS.map((item) => (
              <IconSegment key={item.id} item={item} />
            ))}
          </SegmentedControl>
        )}
        {view === 'compare' && mode === 'changes' && (
          <>
            <span className={`text-sm text-fg-secondary ${fold}`} aria-hidden="true">
              Compare with
            </span>
            <VersionSelect
              label="Compare with"
              value={base?.path ?? ''}
              versions={others}
              empty="No other versions"
              onChange={onBase}
            />
          </>
        )}
        <span className="flex-1" />
        <Button size="sm" variant="primary" asChild>
          <Link to="/build/$name/ship" params={{ name }}>
            <Rocket aria-hidden="true" /> Export
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton ref={moreRef} size="icon-sm" label="More build actions">
              <MoreHorizontal aria-hidden="true" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-56"
            onCloseAutoFocus={(event) => {
              if (onMenuCloseFocus()) event.preventDefault()
            }}
          >
            <DropdownMenuItem disabled={!canUpgradeTarget} onSelect={onUpgradeTarget}>
              Upgrade target…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!canDraft} onSelect={onDraft}>
              Generate draft
              <DropdownMenuShortcut>Ctrl Enter</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDraftSettings}>Draft settings…</DropdownMenuItem>
            <DropdownMenuItem disabled={!canImport} onSelect={onImport}>
              Import schematic…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={!canDelete} onSelect={onDelete}>
              Delete selected version…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
