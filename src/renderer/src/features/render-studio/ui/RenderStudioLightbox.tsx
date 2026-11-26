// Render Studio Lightbox: full-viewport cinematic render & image export dialog + app-level host.
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Camera, Copy, Download, Grid2x2, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/shared/ui/primitives/dialog'
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/primitives/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/primitives/sheet'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { versionName, type BuildVersion } from '@/entities/build/model/workspace'
import {
  resolveExportSize,
  type ShotMode,
  type StudioCameraPreset,
  type StudioSettings
} from '@/entities/viewer/lib/cinematic/presets'
import { RenderStage, type RenderStageHandle } from './RenderStage'
import { StudioRail, type StudioRailTab } from './StudioRail'
import {
  copyCanvasToClipboard,
  saveBatchCanvases,
  saveCanvasAsBuildPreview,
  saveCanvasToFile,
  useRenderStudioControls,
  useRenderTarget
} from '../model/useRenderExport'

export function RenderStudioLightbox({
  open,
  sessionId = 0,
  onOpenChange,
  build,
  displayName,
  versions,
  version,
  onVersionChange,
  sourceUrl,
  packUrl,
  packLoading,
  packError,
  minecraftVersion,
  edits,
  settings,
  onPreset,
  onPatch,
  onReset,
  initialView,
  initialClipY,
  onCopyCanvas,
  onSaveCanvas,
  onSaveBatch,
  onSaveBuildPreview
}: {
  open: boolean
  sessionId?: number
  onOpenChange: (open: boolean) => void
  build: string
  displayName: string
  versions: BuildVersion[]
  version: BuildVersion | null
  onVersionChange: (path: string) => void
  sourceUrl: string | null
  packUrl: string | null
  packLoading: boolean
  packError: unknown
  minecraftVersion: string
  edits: [number, number, number, string][]
  settings: StudioSettings
  onPreset: (preset: Exclude<StudioSettings['preset'], 'custom'>) => void
  onPatch: (partial: Partial<StudioSettings>, markCustom?: boolean) => void
  onReset: () => void
  initialView?: StudioCameraPreset
  initialClipY?: number | null
  onCopyCanvas: (canvas: HTMLCanvasElement) => Promise<void>
  onSaveCanvas: (canvas: HTMLCanvasElement, suffix?: string) => Promise<void>
  onSaveBatch: (
    tiles: { id: string; canvas: HTMLCanvasElement }[],
    sheetCanvas: HTMLCanvasElement | null
  ) => Promise<void>
  onSaveBuildPreview: (canvas: HTMLCanvasElement, kind: 'thumbnail' | 'sheet') => Promise<void>
}): ReactElement {
  const stageRef = useRef<RenderStageHandle>(null)
  const [railTab, setRailTab] = useState<StudioRailTab>('look')
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [clipY, setClipY] = useState<number | null>(initialClipY ?? null)
  const [prevSession, setPrevSession] = useState(sessionId)
  const [prevVersion, setPrevVersion] = useState(version?.path ?? '')
  if (prevSession !== sessionId) {
    setPrevSession(sessionId)
    setPrevVersion(version?.path ?? '')
    if (open) setClipY(initialClipY ?? null)
  } else if (prevVersion !== (version?.path ?? '')) {
    setPrevVersion(version?.path ?? '')
    setClipY(null)
  }
  const [stageInfo, setStageInfo] = useState<{
    dims: [number, number, number] | null
    emissiveCount: number
    stageAspect: number
  }>({ dims: null, emissiveCount: 0, stageAspect: 16 / 9 })
  const [busy, setBusy] = useState(false)

  const renderForExport = (): {
    canvas: HTMLCanvasElement
    tiles?: { id: StudioCameraPreset; label: string; canvas: HTMLCanvasElement }[]
  } | null => {
    const handle = stageRef.current
    if (!handle) return null
    const size = resolveExportSize(settings.resolution, settings.aspect, stageInfo.stageAspect)
    if (settings.shotMode === 'sheet') {
      const result = handle.captureSheet({
        views: settings.sheetViews,
        width: Math.max(size.width, 1600),
        ssaa: settings.ssaa,
        autoCrop: settings.autoCrop,
        labels: settings.sheetLabels,
        fov: settings.fov,
        transparent: settings.backdrop === 'transparent',
        bgColor: settings.bgColor
      })
      if (!result) return null
      return { canvas: result.sheet, tiles: result.tiles }
    }
    const canvas = handle.captureSingle(size.width, size.height, settings.ssaa, settings.autoCrop)
    return canvas ? { canvas } : null
  }

  const runAction = async (fn: () => Promise<void>): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await new Promise((r) => requestAnimationFrame(() => r(undefined)))
      await fn()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = (): void =>
    void runAction(async () => {
      const rendered = renderForExport()
      if (!rendered) throw new Error('Wait for the build to finish loading before copying')
      await onCopyCanvas(rendered.canvas)
    })

  const handleSave = (): void =>
    void runAction(async () => {
      const rendered = renderForExport()
      if (!rendered) throw new Error('Wait for the build to finish loading before exporting')
      await onSaveCanvas(rendered.canvas, settings.shotMode === 'sheet' ? 'sheet' : undefined)
    })

  const handleBatchSave = (): void =>
    void runAction(async () => {
      const handle = stageRef.current
      if (!handle) throw new Error('Renderer is not ready')
      const size = resolveExportSize(settings.resolution, settings.aspect, stageInfo.stageAspect)
      const result = handle.captureSheet({
        views: settings.sheetViews,
        width: Math.max(size.width, 1600),
        ssaa: settings.ssaa,
        autoCrop: settings.autoCrop,
        labels: settings.sheetLabels,
        fov: settings.fov,
        transparent: settings.backdrop === 'transparent',
        bgColor: settings.bgColor
      })
      if (!result) throw new Error('Wait for the build to finish loading before exporting')
      await onSaveBatch(result.tiles, result.sheet)
    })

  const handleSaveThumbnail = (): void =>
    void runAction(async () => {
      const handle = stageRef.current
      if (!handle) throw new Error('Renderer is not ready')
      const canvas = handle.captureSingle(1280, 800, settings.ssaa, settings.autoCrop)
      if (!canvas) throw new Error('Wait for the build to finish loading first')
      await onSaveBuildPreview(canvas, 'thumbnail')
    })

  const handleSaveSheet = (): void =>
    void runAction(async () => {
      const handle = stageRef.current
      if (!handle) throw new Error('Renderer is not ready')
      const result = handle.captureSheet({
        views: settings.sheetViews,
        width: 1600,
        ssaa: settings.ssaa,
        autoCrop: true,
        labels: settings.sheetLabels,
        fov: settings.fov,
        transparent: false,
        bgColor: settings.bgColor
      })
      if (!result) throw new Error('Wait for the build to finish loading first')
      await onSaveBuildPreview(result.sheet, 'sheet')
    })

  const rail = (
    <StudioRail
      tab={railTab}
      onTabChange={setRailTab}
      settings={settings}
      onPreset={onPreset}
      onPatch={onPatch}
      onReset={onReset}
      clipY={clipY}
      height={stageInfo.dims?.[1] ?? 0}
      onClipY={setClipY}
      emissiveCount={stageInfo.emissiveCount}
      hasEdits={edits.length > 0}
      stageAspect={stageInfo.stageAspect}
      busy={busy || !version}
      onCopy={handleCopy}
      onSave={handleSave}
      onBatchSave={handleBatchSave}
      onSaveThumbnail={handleSaveThumbnail}
      onSaveSheet={handleSaveSheet}
      canSaveToBuild={!!version && !!build}
    />
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="full"
        className="h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)]"
      >
        {/* Top bar */}
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle bg-surface-panel px-4 py-2.5 pe-12">
          <div className="flex min-w-0 items-center gap-2">
            <Camera aria-hidden="true" className="size-4 shrink-0 text-accent-text" />
            <DialogTitle className="truncate text-base font-semibold">Render Studio</DialogTitle>
            <DialogDescription className="sr-only">
              Configure cinematic lighting, shaders, framing, and export high-resolution renders of{' '}
              {displayName}.
            </DialogDescription>
            <span aria-hidden="true" className="text-fg-muted">
              ·
            </span>
            <span className="truncate text-sm text-fg-secondary">{displayName}</span>
          </div>

          {versions.length > 0 && (
            <Select value={version?.path ?? ''} onValueChange={onVersionChange}>
              <SelectTrigger size="sm" aria-label="Render version" className="w-40 font-mono">
                <SelectValue placeholder="Version" />
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

          <SegmentedControl
            size="sm"
            aria-label="Shot mode"
            value={settings.shotMode}
            onValueChange={(v) => v && onPatch({ shotMode: v as ShotMode })}
          >
            <SegmentedControlItem value="single" className="gap-1.5">
              <Camera aria-hidden="true" className="size-3.5" />
              Single
            </SegmentedControlItem>
            <SegmentedControlItem value="sheet" className="gap-1.5">
              <Grid2x2 aria-hidden="true" className="size-3.5" />
              Sheet
            </SegmentedControlItem>
          </SegmentedControl>

          <span className="flex-1" />

          <Button
            size="sm"
            variant="outline"
            className="lg:hidden"
            onClick={() => setMobileSheetOpen(true)}
          >
            <SlidersHorizontal aria-hidden="true" />
            Studio controls
          </Button>
          <Button size="sm" variant="outline" disabled={busy || !version} onClick={handleCopy}>
            <Copy aria-hidden="true" />
            Copy PNG
          </Button>
          <Button size="sm" variant="primary" disabled={busy || !version} onClick={handleSave}>
            <Download aria-hidden="true" />
            {busy ? 'Rendering…' : settings.shotMode === 'sheet' ? 'Export sheet…' : 'Export…'}
          </Button>
        </header>

        {/* Main body: live stage + studio inspector rail */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {!version ? (
            <div className="flex flex-1 items-center justify-center bg-surface-viewer p-6">
              <EmptyState icon={Camera} title="No build versions to render">
                Generate a draft in Workspace first, then open Render Studio to export renders.
              </EmptyState>
            </div>
          ) : (
            <RenderStage
              ref={stageRef}
              sourceUrl={sourceUrl}
              packUrl={packUrl}
              packLoading={packLoading}
              packError={packError}
              minecraftVersion={minecraftVersion}
              edits={edits}
              settings={settings}
              clipY={clipY}
              initialView={initialView}
              onFocusPoint={(dofFocusX, dofFocusY) => onPatch({ dofFocusX, dofFocusY }, true)}
              onProjectionChange={(projection) => onPatch({ projection })}
              onStageInfo={setStageInfo}
            />
          )}

          <aside
            aria-label="Render studio controls"
            className="hidden w-80 shrink-0 flex-col border-s border-border-subtle bg-surface-panel lg:flex"
          >
            {rail}
          </aside>
        </div>

        {/* Narrow viewport bottom sheet for studio controls */}
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent side="bottom" className="flex h-[75dvh] flex-col p-0">
            <SheetHeader className="border-b border-border-subtle px-4 py-3">
              <SheetTitle>Studio controls</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1">{rail}</div>
          </SheetContent>
        </Sheet>
      </DialogContent>
    </Dialog>
  )
}

/** Mounted once in Shell so Workspace, Export, Gallery, and Ctrl+K can all launch the Render Studio Lightbox. */
export function RenderStudioHost(): ReactElement | null {
  const target = useRenderTarget()
  const { settings, applyPreset, patch, reset } = useRenderStudioControls()

  useEffect(() => {
    if (target.open && target.launch?.initialProjection) {
      patch({ projection: target.launch.initialProjection })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.sessionId])

  if (!target.launch) return null

  return (
    <RenderStudioLightbox
      open={target.open}
      sessionId={target.sessionId}
      onOpenChange={(next) => !next && target.close()}
      build={target.launch.build}
      displayName={target.displayName}
      versions={target.versions}
      version={target.version}
      onVersionChange={target.setVersionPath}
      sourceUrl={target.sourceUrl}
      packUrl={target.packUrl}
      packLoading={target.packLoading}
      packError={target.packError}
      minecraftVersion={target.minecraftVersion}
      edits={target.edits}
      settings={settings}
      onPreset={applyPreset}
      onPatch={patch}
      onReset={reset}
      initialView={target.launch.initialView}
      initialClipY={target.launch.initialClipY}
      onCopyCanvas={copyCanvasToClipboard}
      onSaveCanvas={async (canvas, suffix) => {
        await saveCanvasToFile(
          canvas,
          target.launch!.build,
          target.version?.path ?? null,
          settings.preset,
          settings.format,
          settings.quality,
          suffix
        )
      }}
      onSaveBatch={async (tiles, sheetCanvas) => {
        await saveBatchCanvases(
          tiles,
          sheetCanvas,
          target.version?.path ?? null,
          target.launch!.build,
          settings.format,
          settings.quality
        )
      }}
      onSaveBuildPreview={async (canvas, kind) => {
        if (!target.version) return
        await saveCanvasAsBuildPreview(canvas, target.launch!.build, target.version.path, kind)
      }}
    />
  )
}
