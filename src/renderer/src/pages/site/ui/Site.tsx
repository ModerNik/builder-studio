// Build location (Variant B — Slim Inspector Rail): interactive BlueMap-style 3D world map with
// auto-adaptive Scout Terrain (before a draft exists) and Place Build (once a .litematic exists).
import { useEffect, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  ArrowDownToLine,
  Compass,
  FolderOpen,
  Globe,
  MapPin,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sun,
  User
} from 'lucide-react'
import type { WorldDimension } from '@shared/api'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { useBuild } from '@/entities/build/model/builds'
import { errorText, versionName } from '@/entities/build/model/workspace'
import { useMinecraftPack, useSettings } from '@/entities/settings/model/settings'
import { ViewerToolbar, ViewerToolbarSeparator } from '@/entities/viewer/ui/ViewerOverlay'
import { boxDimensions, formatOriginLine, normalizeBox } from '@/entities/world-map/model/placement'
import type { Box2D, CameraMode, PlacementMode, Vec3 } from '@/entities/world-map/model/types'
import { WorldMapViewport } from '@/entities/world-map/ui/WorldMapViewport'
import { buildUrl } from '@/shared/lib/urls'
import { CopyButton } from '@/shared/ui/common/CopyButton'
import { Tip } from '@/shared/ui/common/Tip'
import { ConfirmDestructive } from '@/shared/ui/feedback/ConfirmDestructive'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { Button } from '@/shared/ui/primitives/button'
import { Field } from '@/shared/ui/primitives/field'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import { Shortcut } from '@/shared/ui/primitives/kbd'
import { NumberField } from '@/shared/ui/primitives/number-field'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import { Toggle } from '@/shared/ui/primitives/toggle'
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/primitives/toggle-group'
import { clearScreenPanels, setScreenPanels } from '@/widgets/workbench-shell/model/screenPanels'
import type { WorkbenchPanel } from '@/widgets/workbench-shell/ui/Dock'
import { useSiteLocation } from '../model/location'

const DIM_LABELS: Record<WorldDimension, string> = {
  overworld: 'Overworld',
  nether: 'Nether',
  end: 'End'
}

const AXES = [
  ['X', 'text-axis-x'],
  ['Y', 'text-axis-y'],
  ['Z', 'text-axis-z']
] as const

export function Site(): ReactElement {
  const { name } = useParams({ from: '/build/$name/site' })
  return <Location key={name} name={name} />
}

function Location({ name }: { name: string }): ReactElement {
  const navigate = useNavigate()
  const build = useBuild(name).data
  const settings = useSettings().data
  const target = build?.minecraftVersion ?? settings?.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION
  const pack = useMinecraftPack(target)
  const versions = build?.versions ?? []

  const loc = useSiteLocation(name, target, versions)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [jumpX, setJumpX] = useState(0)
  const [jumpZ, setJumpZ] = useState(0)

  // Register the Slim Inspector Rail as a native Workbench right dock panel (collapsible, Sheet on phone)
  const [railHost, setRailHost] = useState<HTMLElement | null>(null)
  const [panels] = useState((): WorkbenchPanel[] => [
    {
      id: 'site-inspector',
      side: 'right',
      title: 'Inspector',
      icon: SlidersHorizontal,
      keys: 'Ctrl+I',
      size: '--dock-editor',
      defaultOpen: true,
      content: <div ref={setRailHost} className="flex h-full min-h-0 flex-col" />
    }
  ])
  useEffect(() => {
    setScreenPanels(panels)
    return clearScreenPanels
  }, [panels])

  const listed = loc.worlds.data ?? []
  const worldName =
    loc.worldInfo.data?.name ??
    listed.find((w) => w.path === loc.world)?.name ??
    loc.world.split(/[\\/]/).pop() ??
    ''
  const noWorlds = loc.worlds.isSuccess && !loc.savedMetaPending && !listed.length && !loc.world
  const areaNorm = loc.areaBox ? normalizeBox(loc.areaBox) : null
  const areaDims = areaNorm ? boxDimensions(areaNorm) : null
  const originLine = formatOriginLine(loc.effectiveOrigin)
  const buildSrc =
    loc.mode === 'build' && loc.activeVersionPath ? buildUrl(loc.activeVersionPath) : null

  const groundBadge = loc.groundStats ? `Y ${loc.groundStats.min}–${loc.groundStats.max}` : null

  const updateOriginAxis = (idx: 0 | 1 | 2, val: number | null): void => {
    if (val === null || !Number.isFinite(val)) return
    const next: Vec3 = [...loc.origin]
    next[idx] = Math.round(val)
    loc.setOrigin(next)
  }

  const updateAreaCorner = (idx: 0 | 1 | 2 | 3, val: number | null): void => {
    if (!areaNorm || val === null || !Number.isFinite(val)) return
    const next: Box2D = [...areaNorm]
    next[idx] = Math.round(val)
    loc.setAreaBox(next)
  }

  // ── Slim Inspector Rail (Variant B) ──
  const rail = (
    <div className="flex h-full min-h-0 flex-col bg-surface-panel">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3.5">
        {/* Auto-adaptive mode switch: only shown once a .litematic draft exists */}
        {loc.hasDrafts && (
          <SegmentedControl
            size="sm"
            aria-label="Placement mode"
            value={loc.mode}
            onValueChange={(v) => v && loc.setMode(v as PlacementMode)}
            className="grid w-full grid-cols-2"
          >
            <SegmentedControlItem value="area">Terrain area</SegmentedControlItem>
            <SegmentedControlItem value="build">Place build</SegmentedControlItem>
          </SegmentedControl>
        )}

        {/* Dimension & folder picker */}
        <div className="flex items-center gap-1.5">
          <Select
            value={loc.dimension}
            onValueChange={(v) => loc.setDimension(v as WorldDimension)}
            disabled={loc.availableDimensions.length <= 1}
          >
            <SelectTrigger size="sm" aria-label="Dimension" className="min-w-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {loc.availableDimensions.map((d) => (
                <SelectItem key={d} value={d}>
                  {DIM_LABELS[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <IconButton
            size="icon-sm"
            variant="outline"
            label="Choose world folder…"
            onClick={() => void loc.pickWorldFolder()}
          >
            <FolderOpen />
          </IconButton>
        </div>

        <hr className="border-border-subtle" />

        {loc.mode === 'area' ? (
          /* ── Scout Terrain controls ── */
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-fg-secondary">
                Area{areaDims ? ` · ${areaDims[0]}×${areaDims[1]}` : ''}
              </span>
              {groundBadge && (
                <span className="font-mono text-xs tabular-nums text-fg-muted">{groundBadge}</span>
              )}
            </div>
            {areaNorm && (
              <div className="grid grid-cols-2 gap-2">
                {(['x1', 'z1', 'x2', 'z2'] as const).map((key, i) => (
                  <NumberField
                    key={key}
                    aria-label={`Area ${key}`}
                    className="font-mono"
                    unit={key}
                    value={areaNorm[i]}
                    onValueChange={(v) => updateAreaCorner(i as 0 | 1 | 2 | 3, v)}
                  />
                ))}
              </div>
            )}
            <Field label="Margin">
              <NumberField
                aria-label="Terrain margin in blocks"
                className="font-mono"
                unit="blk"
                min={0}
                value={loc.margin}
                onValueChange={(v) => loc.setMargin(Math.max(0, Math.round(v ?? 0)))}
              />
            </Field>
          </div>
        ) : (
          /* ── Place Build controls ── */
          <div className="flex flex-col gap-3">
            {versions.length > 1 && loc.activeVersionPath && (
              <Select value={loc.activeVersionPath} onValueChange={loc.setActiveVersionPath}>
                <SelectTrigger size="sm" aria-label="Draft version" className="w-full font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.path} value={v.path} className="font-mono">
                      {versionName(v.path)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-fg-secondary">Position</span>
              {groundBadge && (
                <span className="font-mono text-xs tabular-nums text-fg-muted">{groundBadge}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {AXES.map(([axis, tone], i) => (
                <Field key={axis} label={<span className={`font-mono ${tone}`}>{axis}</span>}>
                  <NumberField
                    aria-label={`Build ${axis}`}
                    className="font-mono"
                    value={loc.origin[i]}
                    onValueChange={(v) => updateOriginAxis(i as 0 | 1 | 2, v)}
                  />
                </Field>
              ))}
            </div>

            <div className="flex items-center justify-between gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={loc.snapToGround}
                disabled={!loc.source}
              >
                <ArrowDownToLine /> Ground
              </Button>
              <div className="flex items-center gap-0.5">
                <IconButton
                  size="icon-sm"
                  variant="outline"
                  label="Rotate counter-clockwise"
                  shortcut="Shift+R"
                  onClick={() => loc.rotateBy(-90)}
                >
                  <RotateCcw />
                </IconButton>
                <span className="w-9 text-center font-mono text-xs tabular-nums text-fg-secondary">
                  {loc.rotation}°
                </span>
                <IconButton
                  size="icon-sm"
                  variant="outline"
                  label="Rotate clockwise"
                  shortcut="R"
                  onClick={() => loc.rotateBy(90)}
                >
                  <RotateCw />
                </IconButton>
              </div>
            </div>

            <Field label="Margin">
              <NumberField
                aria-label="Terrain margin in blocks"
                className="font-mono"
                unit="blk"
                min={0}
                value={loc.margin}
                onValueChange={(v) => loc.setMargin(Math.max(0, Math.round(v ?? 0)))}
              />
            </Field>
          </div>
        )}

        {/* Copyable ORIGIN chip */}
        <div className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface-sunken ps-2.5">
          <code className="min-w-0 flex-1 truncate font-mono text-xs tabular-nums text-fg">
            {originLine}
          </code>
          <CopyButton text={originLine} label="Copy ORIGIN" />
        </div>
      </div>

      {/* Pinned Save Footer */}
      <div className="border-t border-border-subtle p-3.5">
        <Button
          className="w-full"
          disabled={!loc.world || !loc.activeBox || loc.save.isPending || !!loc.worldInfo.error}
          onClick={() => loc.save.mutate(false)}
        >
          {loc.save.isPending ? 'Saving…' : 'Save location'}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="relative flex h-full min-w-0 flex-1 bg-surface-viewer">
      <h1 className="sr-only">Location</h1>

      {noWorlds ? (
        <div className="grid size-full place-items-center p-6">
          <EmptyState icon={Globe} size="panel" title="No Minecraft worlds found">
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Button variant="default" onClick={() => void loc.pickWorldFolder()}>
                <FolderOpen /> Choose world folder…
              </Button>
              <Button
                variant="outline"
                onClick={() => void navigate({ to: '/settings', search: { section: 'minecraft' } })}
              >
                Settings
              </Button>
            </div>
          </EmptyState>
        </div>
      ) : loc.worldInfo.error ? (
        <div className="grid size-full place-items-center p-6">
          <EmptyState icon={Globe} size="panel" title="Could not read world">
            <p className="text-sm text-fg-secondary">{errorText(loc.worldInfo.error)}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {listed.length > 0 && (
                <Select value="" onValueChange={loc.setWorld}>
                  <SelectTrigger size="sm" aria-label="Switch world" className="w-48">
                    <SelectValue placeholder="Switch to another save…" />
                  </SelectTrigger>
                  <SelectContent>
                    {listed.map((w) => (
                      <SelectItem key={w.path} value={w.path}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" onClick={() => void loc.pickWorldFolder()}>
                <FolderOpen /> Choose world folder…
              </Button>
            </div>
          </EmptyState>
        </div>
      ) : (
        <WorldMapViewport
          source={loc.source}
          pack={pack.data ?? null}
          cameraMode={loc.cameraMode}
          onCameraModeChange={loc.setCameraMode}
          lighting={loc.lighting}
          mode={loc.mode}
          areaBox={loc.areaBox}
          onAreaBoxChange={loc.setAreaBox}
          origin={loc.origin}
          onOriginChange={loc.setOrigin}
          rotation={loc.rotation}
          onRotate={loc.rotateBy}
          margin={loc.margin}
          buildSrc={buildSrc}
          onBuildSize={loc.setBuildSize}
          flyTo={loc.flyTo}
          onGroundStats={loc.setGroundStats}
          onHeightLookup={loc.setHeightLookup}
        >
          {/* Floating Top Map Bar (Variant B) */}
          <ViewerToolbar label="World map controls">
            {loc.worlds.isPending ? (
              <Skeleton className="h-7 w-36" />
            ) : (
              <Select
                value={loc.world}
                onValueChange={loc.setWorld}
                disabled={!listed.length && !loc.world}
              >
                <SelectTrigger
                  size="sm"
                  aria-label="World"
                  className="h-7 w-40 border-0 bg-transparent shadow-none"
                >
                  <SelectValue placeholder="Choose world…" />
                </SelectTrigger>
                <SelectContent>
                  {loc.world && !listed.some((w) => w.path === loc.world) && (
                    <SelectItem value={loc.world}>{worldName}</SelectItem>
                  )}
                  {listed.map((w) => (
                    <SelectItem key={w.path} value={w.path}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <ViewerToolbarSeparator />

            <SegmentedControl
              size="sm"
              aria-label="Camera mode"
              value={loc.cameraMode}
              onValueChange={(v) => v && loc.setCameraMode(v as CameraMode)}
            >
              <Tip
                side="bottom"
                label={
                  <>
                    3D perspective <Shortcut keys="1" />
                  </>
                }
              >
                <SegmentedControlItem value="3d">3D</SegmentedControlItem>
              </Tip>
              <Tip
                side="bottom"
                label={
                  <>
                    Isometric <Shortcut keys="2" />
                  </>
                }
              >
                <SegmentedControlItem value="iso">Iso</SegmentedControlItem>
              </Tip>
              <Tip
                side="bottom"
                label={
                  <>
                    Top-down 2D <Shortcut keys="3" />
                  </>
                }
              >
                <SegmentedControlItem value="top">2D</SegmentedControlItem>
              </Tip>
            </SegmentedControl>

            <ViewerToolbarSeparator />

            {loc.worldInfo.data?.spawn && loc.dimension === 'overworld' && (
              <IconButton
                size="icon-sm"
                variant="ghost"
                label="Jump to world spawn"
                onClick={loc.jumpToSpawn}
              >
                <Compass />
              </IconButton>
            )}
            {loc.worldInfo.data?.player &&
              (!loc.worldInfo.data.playerDimension ||
                loc.worldInfo.data.playerDimension === loc.dimension) && (
                <IconButton
                  size="icon-sm"
                  variant="ghost"
                  label="Jump to player position"
                  onClick={loc.jumpToPlayer}
                >
                  <User />
                </IconButton>
              )}

            <Popover
              open={jumpOpen}
              onOpenChange={(open) => {
                if (open) {
                  setJumpX(loc.effectiveOrigin[0])
                  setJumpZ(loc.effectiveOrigin[2])
                }
                setJumpOpen(open)
              }}
            >
              <PopoverTrigger asChild>
                <IconButton size="icon-sm" variant="ghost" label="Jump to coordinates">
                  <MapPin />
                </IconButton>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-60 p-3">
                <form
                  className="flex flex-col gap-2.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    loc.jumpToCoords(jumpX, jumpZ)
                    setJumpOpen(false)
                  }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField
                      aria-label="Jump X"
                      unit="X"
                      className="font-mono"
                      value={jumpX}
                      onValueChange={(v) => setJumpX(Math.round(v ?? 0))}
                    />
                    <NumberField
                      aria-label="Jump Z"
                      unit="Z"
                      className="font-mono"
                      value={jumpZ}
                      onValueChange={(v) => setJumpZ(Math.round(v ?? 0))}
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full">
                    Go
                  </Button>
                </form>
              </PopoverContent>
            </Popover>

            <ViewerToolbarSeparator />

            <Tip side="bottom" label={loc.lighting === 'sun' ? 'Sun lighting' : 'Game lighting'}>
              <Toggle
                size="sm"
                aria-label="Sun lighting"
                pressed={loc.lighting === 'sun'}
                onPressedChange={(on) => loc.setLighting(on ? 'sun' : 'game')}
              >
                <Sun />
              </Toggle>
            </Tip>
          </ViewerToolbar>
        </WorldMapViewport>
      )}

      {railHost && createPortal(rail, railHost)}

      <ConfirmDestructive
        open={loc.confirmOverwrite}
        onOpenChange={loc.setConfirmOverwrite}
        title="Overwrite terrain.npz?"
        action="Overwrite"
        onConfirm={() => loc.save.mutate(true)}
      >
        <p>
          Replace builds/{name}/data/terrain.npz with the new selection (
          {loc.activeBox
            ? `${loc.activeBox[0]}, ${loc.activeBox[1]} to ${loc.activeBox[2]}, ${loc.activeBox[3]}`
            : ''}
          , margin {loc.margin})?
        </p>
      </ConfirmDestructive>
    </div>
  )
}
