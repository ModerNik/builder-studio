// Build location (G6-4-SI, map with a numbered setup panel): World, Map area and Footprint read top to bottom
// as steps with Write at the panel foot, and the map takes the rest of the room. The bridge's site_map reads
// copies of the region files, never the save itself. On phone the map comes first and the setup sits in a
// Sheet behind "Change". Logic: lib/site.ts.
import { type ReactElement, type ReactNode } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { FolderOpen, Globe, Map as MapIcon, ShieldCheck } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Field } from '@/shared/ui/primitives/field'
import { NumberField } from '@/shared/ui/primitives/number-field'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/primitives/sheet'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/shared/ui/primitives/accordion'
import { CopyButton } from '@/shared/ui/common/CopyButton'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { ConfirmDestructive } from '@/shared/ui/feedback/ConfirmDestructive'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { MapSelectionCanvas } from '@/entities/site/ui/MapSelectionCanvas'
import { ViewerOverlay } from '@/entities/viewer/ui/ViewerOverlay'
import { ViewerLoadingCard } from '@/entities/viewer/ui/ViewerCards'
import { useWorkbench } from '@/widgets/workbench-shell/model/context'
import { buildUrl } from '@/shared/lib/urls'
import { useBuild } from '@/entities/build/model/builds'
import { useSettings } from '@/entities/settings/model/settings'
import { errorText } from '@/entities/build/model/workspace'
import { boxStats, norm, originLine, regionsIn, type Box } from '@/entities/site/model/site'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { useSiteLocation } from '../model/location'

export function Site(): ReactElement {
  const { name } = useParams({ from: '/build/$name/site' })
  return <Location key={name} name={name} />
}

function Location({ name }: { name: string }): ReactElement {
  const { tier } = useWorkbench()
  const phone = tier === 'phone'
  const navigate = useNavigate()
  const build = useBuild(name).data
  const settings = useSettings().data
  const target = build?.minecraftVersion ?? settings?.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION
  const {
    worlds,
    world,
    setWorld,
    center,
    setCenter,
    side,
    setSide,
    map,
    box,
    setBox,
    margin,
    setMargin,
    confirm,
    setConfirm,
    written,
    setupOpen,
    setSetupOpen,
    regions,
    area,
    draw,
    heights,
    write,
    pickOther
  } = useSiteLocation(name, target)

  const yAt = (x: number, z: number): number | null => {
    const h = heights.data
    if (!h || !map) return null
    const y = h[(z - map.origin[1]) * map.size[0] + (x - map.origin[0])]
    return y === undefined || y === -32768 ? null : y
  }
  const stats = map && heights.data && box ? boxStats(map, heights.data, box) : null
  const b = box && norm(box)
  const origin = b && stats ? originLine(b, stats.median) : null
  const listed = worlds.data ?? []
  const worldName = listed.find((w) => w.path === world)?.name ?? world.split(/[\\/]/).pop() ?? ''
  const noWorlds = worlds.isSuccess && !listed.length && !world

  const step = (n: number, title: string, children: ReactNode): ReactNode => (
    <section aria-labelledby={`site-step-${n}`} className="flex flex-col gap-3">
      <h2 id={`site-step-${n}`} className="flex items-center gap-2 font-medium">
        <span className="grid size-6 place-items-center rounded-full bg-surface-hover font-mono text-sm text-fg-secondary">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )

  const worldStep = step(
    1,
    'World',
    <>
      {worlds.isPending ? (
        <div role="status" className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <span className="sr-only">Loading worlds…</span>
        </div>
      ) : (
        <Field
          label="World save"
          className="[&>label]:sr-only"
          hint={world ? <span className="font-mono break-all">{world}</span> : undefined}
          error={
            regions.error
              ? `Can’t read this world: ${errorText(regions.error)}. Pick the save folder that holds level.dat.`
              : undefined
          }
        >
          <Select value={world} onValueChange={setWorld} disabled={!listed.length && !world}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={listed.length ? 'Choose a world…' : 'No worlds found'} />
            </SelectTrigger>
            <SelectContent>
              {world && !listed.some((w) => w.path === world) && (
                <SelectItem value={world}>{worldName}</SelectItem>
              )}
              {listed.map((w) => (
                <SelectItem key={w.path} value={w.path}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {regions.data?.blocks && (
        <p className="font-mono text-sm text-fg-secondary">
          {regions.data.regions.length} regions · x {regions.data.blocks[0]}..
          {regions.data.blocks[2]} · z {regions.data.blocks[1]}..{regions.data.blocks[3]}
        </p>
      )}
      {noWorlds ? (
        <>
          <InlineNotice>
            No worlds folder is set, so there is nothing to list. Choose any world folder, or set
            the worlds folder in Settings › Minecraft.
          </InlineNotice>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void pickOther()}>
              <FolderOpen /> Choose folder…
            </Button>
            <Button
              variant="ghost"
              onClick={() => void navigate({ to: '/settings', search: { section: 'minecraft' } })}
            >
              Open Settings
            </Button>
          </div>
        </>
      ) : (
        <Button variant="outline" className="self-start" onClick={() => void pickOther()}>
          <FolderOpen /> Other folder…
        </Button>
      )}
    </>
  )

  const areaStep = step(
    2,
    'Map area',
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field label="x">
          <NumberField
            aria-label="Map center x"
            className="font-mono"
            value={center[0]}
            onValueChange={(v) => setCenter([Math.round(v ?? 0), center[1]])}
          />
        </Field>
        <Field label="z">
          <NumberField
            aria-label="Map center z"
            className="font-mono"
            value={center[1]}
            onValueChange={(v) => setCenter([center[0], Math.round(v ?? 0)])}
          />
        </Field>
      </div>
      <Field label="side" hint="The side is 16 to 2048 blocks.">
        <NumberField
          aria-label="Map side in blocks, 16 to 2048"
          className="font-mono"
          unit="blocks"
          min={16}
          max={2048}
          step={16}
          value={side}
          onValueChange={(v) => setSide(Math.min(2048, Math.max(16, Math.round(v ?? 16))))}
        />
      </Field>
      <Button
        variant={map ? 'outline' : 'default'}
        disabled={!world || draw.isPending || !!regions.error}
        onClick={() => draw.mutate()}
      >
        <MapIcon /> {draw.isPending ? 'Reading…' : 'Map'}
      </Button>
    </>
  )

  const footprintText = (
    <p className="text-sm text-fg-secondary">
      Drag on the map to mark the build’s footprint, or focus the map and press Enter for a box in
      the middle.
    </p>
  )
  const summary = b && (
    <p className="font-mono text-sm text-fg-secondary">
      {b[2] - b[0] + 1} × {b[3] - b[1] + 1} blocks
      {stats && ` · ground y ${stats.min}..${stats.max}, median ${stats.median}`}
    </p>
  )
  const originSnippet = origin && (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface-sunken ps-3">
        <code className="flex-1 font-mono text-sm">{origin}</code>
        <CopyButton text={origin} label="Copy the ORIGIN line for build.py" />
      </div>
      <p className="text-sm text-fg-muted">
        For build.py: the box’s min corner, one above its median ground.
      </p>
    </div>
  )
  const corners = b && (
    <div className="grid grid-cols-2 gap-2">
      {(['x1', 'z1', 'x2', 'z2'] as const).map((l, i) => (
        <NumberField
          key={l}
          aria-label={`Footprint ${l}`}
          className="font-mono"
          unit={l}
          value={b[i]}
          onValueChange={(v) => setBox(b.map((x, j) => (j === i ? Math.round(v ?? x) : x)) as Box)}
        />
      ))}
    </div>
  )
  const marginField = (
    <Field label="margin">
      <NumberField
        aria-label="Margin around the footprint, in blocks"
        className="font-mono"
        unit="blocks"
        min={0}
        value={margin}
        onValueChange={(v) => setMargin(Math.max(0, Math.round(v ?? 0)))}
      />
    </Field>
  )
  const writeButton = (
    <Button className="w-full" disabled={!b || write.isPending} onClick={() => write.mutate(false)}>
      {write.isPending ? 'Writing…' : 'Write terrain.npz'}
    </Button>
  )
  const safety = (
    <p className="flex items-start gap-1.5 text-sm text-fg-muted">
      <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" /> Reads copies of the region
      files; never writes to the world.
    </p>
  )

  // ── the map ──
  let canvas: ReactNode
  if (draw.isPending)
    canvas = (
      <ViewerLoadingCard
        label={`Reading the map: copies of ${regionsIn(regions.data?.regions ?? [], area)} region files, ${side} × ${side} blocks.`}
        progressLabel="Reading the map"
      />
    )
  else if (map)
    canvas = (
      <div className="relative size-full">
        <MapSelectionCanvas
          map={map}
          src={buildUrl(map.path, draw.submittedAt)}
          box={box}
          onBoxChange={setBox}
          heightAt={yAt}
          margin={margin}
          label="World map, north up. Drag to mark the footprint; Enter starts a box, arrows move it, Alt and arrows resize, Delete clears"
        />
        {!phone && (
          <ViewerOverlay className="pointer-events-none absolute top-(--viewer-inset) right-(--viewer-inset) px-2.5 py-1.5 text-sm">
            {box
              ? 'Enter box · ←↑→↓ move · Alt ←↑→↓ resize · Del clear'
              : 'Drag to mark the footprint'}
          </ViewerOverlay>
        )}
      </div>
    )
  else
    canvas = (
      <div className="grid size-full place-items-center">
        {regions.error ? (
          <EmptyState icon={Globe} size="panel" title="Nothing to map yet">
            Choose a world that has region files.
          </EmptyState>
        ) : world ? (
          <EmptyState icon={MapIcon} size="panel" title="Set the map area and press Map">
            The map reads copies of the region files around the center you set.
          </EmptyState>
        ) : (
          <EmptyState icon={Globe} size="panel" title="Choose a world to map">
            Pick a world save {phone ? 'with Change' : 'on the left'}. Builder Studio reads copies
            of its region files.
          </EmptyState>
        )}
      </div>
    )

  const confirmDialog = (
    <ConfirmDestructive
      open={confirm}
      onOpenChange={setConfirm}
      title="Overwrite terrain.npz?"
      action="Overwrite"
      onConfirm={() => write.mutate(true)}
    >
      <p>
        builds/{name}/data/terrain.npz already exists. Overwriting replaces the heights the build
        reads with this box ({b && `${b[0]}, ${b[1]} to ${b[2]}, ${b[3]}`}, margin {margin}).
      </p>
    </ConfirmDestructive>
  )

  if (phone)
    return (
      <div className="flex h-full min-w-0 flex-col">
        <h1 className="sr-only">Site</h1>
        {/* the setup sits in a sheet here, so its step h2s are not above the map */}
        <h2 className="sr-only">Map</h2>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="flex min-h-11 items-center gap-3 rounded-lg border border-border-subtle bg-surface-raised px-4 py-2 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{worldName || 'No world chosen'}</span>
              <span className="block text-sm text-fg-secondary">
                {side} blocks around {center[0]}, {center[1]}
              </span>
            </span>
            <span className="text-accent-text">Change</span>
          </button>
          <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-lg bg-surface-viewer">
            {canvas}
          </div>
          {map && !b && footprintText}
          {summary}
          {originSnippet}
          {b && (
            <Accordion type="single" collapsible>
              <AccordionItem value="corners">
                <AccordionTrigger>
                  Footprint corners and margin
                  <span className="ms-2 font-mono text-sm text-fg-muted">
                    x {b[0]}..{b[2]}, z {b[1]}..{b[3]} · margin {margin}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="flex flex-col gap-3">
                  {corners}
                  {marginField}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          {written && (
            <p role="status" className="text-sm text-fg-secondary">
              {written}
            </p>
          )}
          {safety}
        </div>
        <div className="border-t border-border-subtle p-3">{writeButton}</div>
        <Sheet open={setupOpen} onOpenChange={setSetupOpen}>
          <SheetContent side="bottom" className="overflow-auto">
            <SheetHeader>
              <SheetTitle>World and map area</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-6 px-4 pb-4">
              {worldStep}
              {areaStep}
            </div>
          </SheetContent>
        </Sheet>
        {confirmDialog}
      </div>
    )

  return (
    <div className="flex h-full min-w-0">
      <h1 className="sr-only">Site</h1>
      <aside
        aria-label="Build location"
        className={`flex shrink-0 flex-col border-r border-border-subtle ${tier === 'tablet' ? 'w-75' : 'w-85'}`}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4">
          {worldStep}
          {areaStep}
          {step(
            3,
            'Footprint',
            map ? (
              b ? (
                <>
                  {corners}
                  {summary}
                  {originSnippet}
                </>
              ) : (
                footprintText
              )
            ) : (
              <p className="text-sm text-fg-muted">Map an area first.</p>
            )
          )}
        </div>
        <section
          aria-label="Terrain file"
          className="flex flex-col gap-3 border-t border-border-subtle p-4"
        >
          {marginField}
          <p className="text-sm text-fg-secondary">
            Saved as <span className="font-mono">data/terrain.npz</span> in this build.
          </p>
          {writeButton}
          {written && (
            <p role="status" className="text-sm text-fg-secondary">
              {written}
            </p>
          )}
          {safety}
        </section>
      </aside>
      <div className="relative min-w-0 flex-1 bg-surface-viewer">{canvas}</div>
      {confirmDialog}
    </div>
  )
}
