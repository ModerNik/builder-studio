// Workspace canvas (G6.1 A): the 3D stage with its parts toolbar and vertical clip control, the states
// that stand in for it, and the Preview sheet.
import { useState, type ReactElement, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Box, FolderX, Image, Play } from 'lucide-react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { Button } from '@/shared/ui/primitives/button'
import { Shortcut } from '@/shared/ui/primitives/kbd'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { ErrorState } from '@/shared/ui/feedback/ErrorState'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
import { ClipHeightControl, PartsToolbar } from '@/entities/viewer/ui/ViewerControls'
import { ViewerErrorCard, ViewerLoadingCard } from '@/entities/viewer/ui/ViewerCards'
import { ViewerStage } from '@/entities/viewer/ui/ViewerOverlay'
import { setFps, type VersionAnalysis } from '@/pages/workspace/model/analysis'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { setPartsProgress, usePartsProgress } from '@/entities/parts/model/parts-progress'
import { PartsProgress } from '@/entities/parts/ui/PartsProgress'
import { BuildViewer, type Cell, type ViewerStats } from '@/entities/viewer/ui/BuildViewer'
import type { ViewName } from '@/entities/viewer/model/look'
import type { Section } from '@/entities/availability/model/setupIssues'
import type { BlockEditor } from '@/widgets/block-editor/model/editor'
import { ToolHud } from '@/widgets/block-editor/ui/ToolHud'
import { ToolRail } from '@/widgets/block-editor/ui/ToolRail'

const settingsLink = (section: Section, label = 'Open Settings'): ReactNode => (
  <Button variant="outline" asChild>
    <Link to="/settings" search={{ section }}>
      {label}
    </Link>
  </Button>
)

/** What stands in for the canvas while the build is loading, missing, failed or has no versions. */
export function CanvasState({
  name,
  error,
  loading,
  missing,
  empty,
  onRetry,
  canDraft,
  onDraft,
  onDraftSettings
}: {
  name: string
  error: unknown
  loading: boolean
  missing: boolean
  empty: boolean
  onRetry: () => void
  canDraft: boolean
  onDraft: () => void
  onDraftSettings: () => void
}): ReactElement | null {
  if (error)
    return (
      <ErrorState
        layout="centered"
        title="Builds could not be loaded"
        error={error}
        onRetry={onRetry}
        action={settingsLink('general')}
      >
        Check your project folder in Settings, then try again.
      </ErrorState>
    )
  if (loading) return <LoadingState label={`Loading ${name}…`} className="m-auto" />
  if (missing)
    return (
      <EmptyState
        icon={FolderX}
        title="This build is no longer in your project folder"
        variant="error"
      >
        It was moved, renamed or deleted outside Builder Studio.
      </EmptyState>
    )
  if (empty)
    return (
      <EmptyState
        icon={Box}
        variant="first-run"
        title="No versions yet"
        action={
          <Button variant="primary" disabled={!canDraft} onClick={onDraft}>
            <Play aria-hidden="true" /> Generate draft <Shortcut keys="Ctrl+Enter" />
          </Button>
        }
        secondary={
          <Button variant="outline" onClick={onDraftSettings}>
            Draft settings…
          </Button>
        }
      >
        A draft builds a first version of {name} from its code.
      </EmptyState>
    )
  return null
}

export function Stage3D({
  a,
  view,
  onViewChange,
  clipY,
  onClip,
  height,
  focus,
  onStats,
  edit
}: {
  a: VersionAnalysis
  view: ViewName
  onViewChange: (view: ViewName) => void
  clipY: number | null
  onClip: (y: number | null) => void
  /** Layers in the build, once loaded; 0 while loading. */
  height: number
  focus: { cell: Cell; t: number } | null
  onStats: (stats: ViewerStats) => void
  edit: BlockEditor
}): ReactElement {
  const top = Math.max(height - 1, 0)
  const minecraftVersion = a.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION
  const hint = a.partsView && !a.selected.length && !a.partsBusy
  return (
    <ViewerStage>
      {a.pack ? (
        <BuildViewer
          src={a.source}
          pack={a.pack}
          view={view}
          onViewChange={onViewChange}
          clipY={clipY}
          markers={a.markers}
          focus={focus}
          overlays={a.overlays}
          hideBuild={a.hideBuild}
          onPick={edit.view.onPick}
          onHover={edit.view.onHover}
          edits={edit.view.edits}
          origin={a.origin}
          editBoxes={edit.view.editBoxes}
          onStroke={edit.view.onStroke}
          ghost={edit.view.ghost}
          measure={edit.view.measure}
          transform={edit.view.transform}
          onReader={edit.view.onReader}
          onStats={onStats}
          onFps={setFps}
          shared
          onOverlayProgress={(key, progress) =>
            setPartsProgress(`view:${a.source}:${key}`, progress)
          }
        />
      ) : a.packLoading ? (
        <ViewerLoadingCard label={`Preparing Minecraft ${minecraftVersion} textures…`} />
      ) : (
        <ViewerErrorCard
          title={`Minecraft ${minecraftVersion} textures could not be prepared`}
          details={String(a.packError ?? '')}
          actions={settingsLink('minecraft')}
        />
      )}
      {a.pack && edit.blocked === null && (
        <ToolRail
          tool={edit.tool}
          onTool={edit.setTool}
          canUndo={edit.history.cursor > 0}
          canRedo={edit.history.cursor < edit.history.edits.length}
          onUndo={edit.undo}
          onRedo={edit.redo}
        />
      )}
      {a.pack && edit.hud && <ToolHud {...edit.hud} />}
      {(!!a.partList?.length || a.parts.isFetching) && (
        // pointer-events-none: clicks between the overlays reach the build
        <div className="pointer-events-none absolute top-(--viewer-inset) right-[calc(var(--viewer-gizmo-size)+2*var(--viewer-inset))] left-[calc(var(--viewer-inset)+var(--viewer-rail-size))] z-floating flex flex-wrap items-center gap-1.5 *:pointer-events-auto">
          <PartsToolbar
            colorBy={a.partsView ? 'parts' : 'blocks'}
            onColorBy={(v) => a.setPartsView(v === 'parts')}
            isolate={a.isolate}
            onIsolate={a.setIsolate}
            selected={a.names.length}
            onClear={() => a.setSelected([])}
          />
          {hint && (
            <span className="viewer-overlay px-2 py-1 text-xs text-fg-secondary">
              Click a part to select it · Shift-click to add
            </span>
          )}
          <PartsStatus a={a} />
          {a.partsFailed && (
            <span role="alert" className="viewer-overlay px-2 py-1 text-xs text-danger-text">
              Parts could not be shown.
            </span>
          )}
        </div>
      )}
      {height > 1 && (
        <div className="absolute top-[calc(var(--viewer-gizmo-size)+2*var(--viewer-inset))] right-(--viewer-inset) bottom-(--viewer-inset) z-floating flex">
          <ClipHeightControl
            orientation="vertical"
            value={clipY ?? top}
            min={0}
            max={top}
            onChange={(y) => onClip(y >= top ? null : y)}
          />
        </div>
      )}
    </ViewerStage>
  )
}

function PartsStatus({ a }: { a: VersionAnalysis }): ReactElement | null {
  const viewKey = `view:${a.source}:${a.overlays.map((o) => o.src).join('\n')}`
  const progress = usePartsProgress(
    (s) => s.entries[viewKey] ?? a.progressKeys.map((key) => s.entries[key]).find(Boolean)
  )
  if (progress) return <PartsProgress progress={progress} />
  return a.partsBusy ? <PartsProgress progress={{ stage: 'waiting', fraction: null }} /> : null
}

/** The preview sheet: every camera angle in one image, panned and zoomed. */
export function SheetView({ src }: { src: string | null }): ReactElement {
  const [failed, setFailed] = useState<string | null>(null)
  if (!src || failed === src)
    return (
      <EmptyState icon={Image} title="No preview images for this version">
        Turn on Create preview images in Draft settings, then generate a draft.
      </EmptyState>
    )
  return (
    <TransformWrapper
      minScale={0.1}
      maxScale={16}
      limitToBounds={false}
      centerOnInit
      wheel={{ step: 0.0015 }}
    >
      <TransformComponent wrapperClass="!h-full !w-full bg-surface-viewer" contentClass="">
        <img
          src={src}
          alt="Build preview from several camera angles"
          onError={() => setFailed(src)}
          style={{ imageRendering: 'pixelated' }}
          draggable={false}
        />
      </TransformComponent>
    </TransformWrapper>
  )
}
