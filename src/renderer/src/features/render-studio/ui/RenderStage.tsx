// Chrome-free live WebGL stage for Render Studio: hosts CinematicRenderer, WYSIWYG aspect frame, guides, and camera bar.
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement
} from 'react'
import { Pyramid, RefreshCw, RotateCcw } from 'lucide-react'
import {
  acquireResources,
  loadResources,
  releaseResources,
  type BlockColorMap,
  type Resources
} from '@/entities/viewer/lib/render'
import { CinematicRenderer } from '@/entities/viewer/lib/cinematic/CinematicRenderer'
import {
  STUDIO_CAMERA_PRESETS,
  type AspectRatio,
  type StudioCameraPreset,
  type StudioSettings
} from '@/entities/viewer/lib/cinematic/presets'
import { composeContactSheet } from '@/entities/viewer/lib/cinematic/compose'
import { resourceUrl } from '@/shared/lib/urls'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/primitives/button'
import { Tip } from '@/shared/ui/common/Tip'
import { ViewerErrorCard, ViewerLoadingCard } from '@/entities/viewer/ui/ViewerCards'
import { ViewerOverlay } from '@/entities/viewer/ui/ViewerOverlay'
import './render-studio.css'

export interface RenderStageHandle {
  captureSingle: (
    width: number,
    height: number,
    ssaa: 1 | 2,
    autoCrop: boolean
  ) => HTMLCanvasElement | null
  captureSheet: (opts: {
    views: StudioCameraPreset[]
    width: number
    ssaa: 1 | 2
    autoCrop: boolean
    labels: boolean
    fov: number
    transparent: boolean
    bgColor: string
  }) => {
    sheet: HTMLCanvasElement
    tiles: { id: StudioCameraPreset; label: string; canvas: HTMLCanvasElement }[]
  } | null
  framePreset: (preset: StudioCameraPreset) => void
  resetCamera: () => void
}

async function fetchBlockColors(): Promise<BlockColorMap | null> {
  try {
    const r = await fetch(resourceUrl('lib/mcb/data/block_colors.json'))
    return r.ok ? ((await r.json()) as { colors: BlockColorMap }).colors : null
  } catch {
    return null
  }
}

const QUICK_VIEWS: StudioCameraPreset[] = ['iso_se', 'iso_ne', 'iso_nw', 'iso_sw', 'top', 'eye_s']
const EMPTY_EDITS: [number, number, number, string][] = []

function aspectNumber(aspect: AspectRatio): number | null {
  if (aspect === 'free') return null
  const [w, h] = aspect.split(':').map(Number)
  return w && h ? w / h : null
}

export const RenderStage = forwardRef<
  RenderStageHandle,
  {
    sourceUrl: string | null
    packUrl: string | null
    packLoading: boolean
    packError: unknown
    minecraftVersion: string
    edits: [number, number, number, string][]
    settings: StudioSettings
    clipY: number | null
    initialView?: StudioCameraPreset
    onFocusPoint: (x: number, y: number) => void
    onProjectionChange: (p: 'isometric' | 'perspective') => void
    onStageInfo: (info: {
      dims: [number, number, number] | null
      emissiveCount: number
      stageAspect: number
    }) => void
  }
>(function RenderStage(
  {
    sourceUrl,
    packUrl,
    packLoading,
    packError,
    minecraftVersion,
    edits,
    settings,
    clipY,
    initialView = 'iso_se',
    onFocusPoint,
    onProjectionChange,
    onStageInfo
  },
  ref
): ReactElement {
  const stageRef = useRef<HTMLDivElement>(null)
  const holderRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<CinematicRenderer | null>(null)
  const sheetRafRef = useRef<number | null>(null)
  const latest = useRef({ settings, clipY, initialView, onStageInfo })
  useLayoutEffect(() => {
    latest.current = { settings, clipY, initialView, onStageInfo }
  })

  const [ready, setReady] = useState(false)
  const [loaded, setLoaded] = useState(0)
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [activePreset, setActivePreset] = useState<StudioCameraPreset>(initialView)
  const [stageSize, setStageSize] = useState({ width: 960, height: 540 })
  const [sheetPreviewUrl, setSheetPreviewUrl] = useState<string | null>(null)
  const [sheetBusy, setSheetBusy] = useState(false)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  // Observe outer stage dimensions to compute the exact WYSIWYG aspect-ratio viewport frame
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const update = (): void => {
      const w = stage.clientWidth
      const h = stage.clientHeight
      if (!w || !h) return
      setStageSize((prev) =>
        prev.width === w && prev.height === h ? prev : { width: w, height: h }
      )
      const renderer = rendererRef.current
      if (renderer) {
        latest.current.onStageInfo({
          dims: renderer.dims,
          emissiveCount: renderer.emissiveCount,
          stageAspect: w / h
        })
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [])

  // Mount one CinematicRenderer per pack
  useEffect(() => {
    if (!packUrl || !holderRef.current) return
    const holder = holderRef.current
    const canvas = document.createElement('canvas')
    canvas.className = 'block h-full w-full'
    holder.appendChild(canvas)
    let disposed = false
    let cleanup = (): void => {}

    const load = async (): Promise<Resources> => {
      const res = await fetch(packUrl)
      if (!res.ok) throw new Error(`texture pack: ${res.status}`)
      return loadResources(await res.arrayBuffer())
    }

    void acquireResources(`pack:${packUrl}`, load)
      .catch(() => null)
      .then(async (res) => {
        const colors = res ? null : await fetchBlockColors()
        if (disposed) return
        const renderer = new CinematicRenderer(canvas, { resources: res, colors })
        rendererRef.current = renderer
        setReady(true)
        const ro = new ResizeObserver(() => {
          if (!holder.clientWidth || !holder.clientHeight) return
          renderer.resize()
        })
        ro.observe(holder)
        cleanup = () => {
          ro.disconnect()
          rendererRef.current = null
          setReady(false)
          setLoaded(0)
          renderer.dispose()
        }
      })

    return () => {
      disposed = true
      if (sheetRafRef.current !== null) {
        cancelAnimationFrame(sheetRafRef.current)
        sheetRafRef.current = null
      }
      cleanup()
      releaseResources(`pack:${packUrl}`)
      canvas.remove()
    }
  }, [packUrl])

  // Load schematic + optional hand edits
  const activeEdits = settings.includeEdits ? edits : EMPTY_EDITS
  useEffect(() => {
    const renderer = rendererRef.current
    if (!ready || !renderer || !sourceUrl) return
    let stale = false
    setLoaded(0)
    setSheetPreviewUrl(null)
    setLoadError('')
    setLoadingLabel('Preparing cinematic scene…')
    void (async () => {
      const res = await fetch(sourceUrl)
      if (!res.ok) throw new Error(`Could not load schematic (${res.status})`)
      const buf = await res.arrayBuffer()
      if (stale) return
      const ok = await renderer.loadSchematic(buf, {
        edits: activeEdits,
        onProgress: (frac) =>
          !stale && setLoadingLabel(`Meshing build… ${Math.round(frac * 100)}%`),
        stale: () => stale
      })
      if (!ok || stale) return
      const cur = latest.current
      renderer.resize()
      renderer.setClipY(cur.clipY)
      renderer.applyLook(cur.settings)
      renderer.framePreset(cur.initialView, cur.settings.projection, cur.settings.fov)
      setActivePreset(cur.initialView)
      setLoadingLabel(null)
      const w = stageRef.current?.clientWidth || 960
      const h = stageRef.current?.clientHeight || 540
      cur.onStageInfo({
        dims: renderer.dims,
        emissiveCount: renderer.emissiveCount,
        stageAspect: w / h
      })
      setLoaded((n) => n + 1)
    })().catch((e) => {
      if (stale) return
      setLoadingLabel(null)
      setLoadError(String(e))
    })
    return () => {
      stale = true
    }
  }, [ready, sourceUrl, activeEdits])

  // Live look updates
  useEffect(() => {
    const renderer = rendererRef.current
    if (!ready || !renderer || !loaded) return
    renderer.applyLook(settings)
  }, [ready, loaded, settings])

  // Live projection & FOV updates
  useEffect(() => {
    const renderer = rendererRef.current
    if (!ready || !renderer || !loaded) return
    renderer.setProjection(settings.projection, settings.fov)
  }, [ready, loaded, settings.projection, settings.fov])

  // Live cutaway updates
  useEffect(() => {
    const renderer = rendererRef.current
    if (!ready || !renderer || !loaded) return
    renderer.setClipY(clipY)
  }, [ready, loaded, clipY])

  // Refresh live contact-sheet preview when switching to Sheet mode or changing angles/look/cutaway
  const refreshSheetPreview = (): void => {
    const renderer = rendererRef.current
    if (!renderer || !loaded || !settings.sheetViews.length) return
    if (sheetRafRef.current !== null) cancelAnimationFrame(sheetRafRef.current)
    setSheetBusy(true)
    sheetRafRef.current = requestAnimationFrame(() => {
      sheetRafRef.current = null
      if (rendererRef.current !== renderer) return
      try {
        const cur = latest.current.settings
        const tiles = renderer.captureAngles(cur.sheetViews, {
          tileWidth: 640,
          tileHeight: 480,
          ssaa: 1,
          autoCrop: cur.autoCrop,
          fov: cur.fov
        })
        const sheet = composeContactSheet(tiles, {
          width: 1440,
          background: cur.backdrop === 'transparent' ? null : cur.bgColor,
          labels: cur.sheetLabels
        })
        setSheetPreviewUrl(sheet.toDataURL('image/png'))
      } finally {
        setSheetBusy(false)
      }
    })
  }

  useEffect(() => {
    if (settings.shotMode !== 'sheet' || !ready || !loaded) return
    const timer = window.setTimeout(refreshSheetPreview, 120)
    return () => {
      window.clearTimeout(timer)
      if (sheetRafRef.current !== null) {
        cancelAnimationFrame(sheetRafRef.current)
        sheetRafRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.shotMode, ready, loaded, settings, clipY])

  useImperativeHandle(
    ref,
    () => ({
      captureSingle: (width, height, ssaa, autoCrop) => {
        const renderer = rendererRef.current
        if (!renderer || !loaded) return null
        return renderer.captureCanvas({ width, height, ssaa, autoCrop })
      },
      captureSheet: (opts) => {
        const renderer = rendererRef.current
        if (!renderer || !loaded || !opts.views.length) return null
        const tileW = Math.max(480, Math.round(opts.width / (opts.views.length <= 4 ? 2 : 3)))
        const tileH = Math.round((tileW * 3) / 4)
        const tiles = renderer.captureAngles(opts.views, {
          tileWidth: tileW,
          tileHeight: tileH,
          ssaa: opts.ssaa,
          autoCrop: opts.autoCrop,
          fov: opts.fov
        })
        const sheet = composeContactSheet(tiles, {
          width: opts.width,
          background: opts.transparent ? null : opts.bgColor,
          labels: opts.labels
        })
        return { sheet, tiles }
      },
      framePreset: (preset) => {
        const renderer = rendererRef.current
        if (!renderer) return
        const spec = STUDIO_CAMERA_PRESETS.find((v) => v.id === preset)
        setActivePreset(preset)
        renderer.framePreset(preset, settings.projection, settings.fov)
        if (spec?.id === 'eye_s' && settings.projection !== 'perspective') {
          onProjectionChange('perspective')
        }
      },
      resetCamera: () => {
        rendererRef.current?.framePreset(activePreset, settings.projection, settings.fov)
      }
    }),
    [loaded, activePreset, settings.projection, settings.fov, onProjectionChange]
  )

  // Compute exact WYSIWYG viewport frame for fixed aspect ratios so live view and export match 1:1
  const targetRatio = aspectNumber(settings.aspect)
  let frameBox: { width: number; height: number } | null = null
  if (targetRatio && settings.shotMode === 'single') {
    const pad = 16
    const availW = Math.max(120, stageSize.width - pad * 2)
    const availH = Math.max(120, stageSize.height - pad * 2)
    if (availW / availH > targetRatio) {
      frameBox = { width: Math.round(availH * targetRatio), height: Math.round(availH) }
    } else {
      frameBox = { width: Math.round(availW), height: Math.round(availW / targetRatio) }
    }
  }

  const onStageMouseDown = (e: MouseEvent<HTMLDivElement>): void => {
    pointerStart.current = { x: e.clientX, y: e.clientY }
  }
  const onStageMouseUp = (e: MouseEvent<HTMLDivElement>): void => {
    if (settings.dofMode === 'off' || settings.shotMode !== 'single' || !pointerStart.current)
      return
    const dist = Math.hypot(e.clientX - pointerStart.current.x, e.clientY - pointerStart.current.y)
    pointerStart.current = null
    if (dist > 4 || e.button !== 0) return
    const rect = holderRef.current?.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height) return
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    onFocusPoint(x, y)
  }

  const transparent = settings.backdrop === 'transparent'

  return (
    <div
      ref={stageRef}
      className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-surface-viewer select-none"
    >
      {/* Live WebGL viewport frame (sized 1:1 to target aspect when locked; stays mounted in Sheet mode) */}
      <div
        style={frameBox ? { width: frameBox.width, height: frameBox.height } : undefined}
        className={cn(
          'relative overflow-hidden',
          frameBox ? 'rounded-xs border border-border-default shadow-md' : 'size-full',
          transparent && 'render-checkerboard',
          settings.shotMode === 'sheet' && 'pointer-events-none opacity-0'
        )}
      >
        <div
          ref={holderRef}
          onMouseDown={onStageMouseDown}
          onMouseUp={onStageMouseUp}
          className={cn('size-full', settings.dofMode !== 'off' && 'cursor-crosshair')}
        />

        {/* Composition guides overlaid 1:1 on the live export frame */}
        {settings.shotMode === 'single' && loaded > 0 && settings.guides !== 'none' && (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full text-fg/25"
            viewBox="0 0 3 3"
            preserveAspectRatio="none"
          >
            {settings.guides === 'thirds' ? (
              <>
                <line x1="1" y1="0" x2="1" y2="3" stroke="currentColor" strokeWidth="0.008" />
                <line x1="2" y1="0" x2="2" y2="3" stroke="currentColor" strokeWidth="0.008" />
                <line x1="0" y1="1" x2="3" y2="1" stroke="currentColor" strokeWidth="0.008" />
                <line x1="0" y1="2" x2="3" y2="2" stroke="currentColor" strokeWidth="0.008" />
              </>
            ) : (
              <>
                <line x1="1.5" y1="0" x2="1.5" y2="3" stroke="currentColor" strokeWidth="0.006" />
                <line x1="0" y1="1.5" x2="3" y2="1.5" stroke="currentColor" strokeWidth="0.006" />
              </>
            )}
          </svg>
        )}
      </div>

      {/* Pack / schematic loading & error states */}
      {!packUrl && packLoading && (
        <ViewerLoadingCard label={`Preparing Minecraft ${minecraftVersion} textures…`} />
      )}
      {!packUrl && !packLoading ? (
        <ViewerErrorCard
          title={`Minecraft ${minecraftVersion} textures could not be prepared`}
          details={packError ? String(packError) : undefined}
        />
      ) : null}
      {loadingLabel && <ViewerLoadingCard label={loadingLabel} />}
      {loadError && <ViewerErrorCard title="Build could not be loaded" details={loadError} />}

      {/* Contact sheet live preview */}
      {settings.shotMode === 'sheet' && (
        <div className="absolute inset-0 z-10 flex size-full flex-col items-center justify-center overflow-auto p-4">
          {sheetPreviewUrl ? (
            <img
              src={sheetPreviewUrl}
              alt="Multi-angle contact sheet preview"
              className="max-h-full max-w-full rounded-md border border-border-subtle object-contain shadow-md"
              draggable={false}
            />
          ) : (
            <ViewerLoadingCard label="Composing contact sheet…" />
          )}
          <div className="absolute end-3 bottom-3">
            <ViewerOverlay className="p-1">
              <Button size="xs" variant="ghost" disabled={sheetBusy} onClick={refreshSheetPreview}>
                <RefreshCw
                  aria-hidden="true"
                  className={cn(sheetBusy && 'motion-safe:animate-spin')}
                />
                {sheetBusy ? 'Updating…' : 'Refresh sheet'}
              </Button>
            </ViewerOverlay>
          </div>
        </div>
      )}

      {/* Floating camera preset pill bar (Single shot only) */}
      {settings.shotMode === 'single' && loaded > 0 && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-floating flex flex-wrap items-center justify-center gap-1.5 *:pointer-events-auto">
          <ViewerOverlay className="flex flex-wrap items-center gap-1 px-1.5 py-1">
            {QUICK_VIEWS.map((id) => {
              const spec = STUDIO_CAMERA_PRESETS.find((v) => v.id === id)!
              const selected = activePreset === id
              return (
                <Button
                  key={id}
                  size="xs"
                  variant={selected ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setActivePreset(id)
                    if (id === 'eye_s') {
                      onProjectionChange('perspective')
                      rendererRef.current?.framePreset(id, 'perspective', settings.fov)
                    } else {
                      rendererRef.current?.framePreset(id, settings.projection, settings.fov)
                    }
                  }}
                >
                  {spec.short}
                </Button>
              )
            })}
            <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border-default" />
            <Tip
              label={
                settings.projection === 'perspective'
                  ? 'Switch to isometric'
                  : 'Switch to perspective'
              }
            >
              <Button
                size="xs"
                variant={settings.projection === 'perspective' ? 'secondary' : 'ghost'}
                aria-pressed={settings.projection === 'perspective'}
                onClick={() =>
                  onProjectionChange(
                    settings.projection === 'perspective' ? 'isometric' : 'perspective'
                  )
                }
              >
                <Pyramid aria-hidden="true" />
                {settings.projection === 'perspective' ? 'Persp' : 'Iso'}
              </Button>
            </Tip>
            <Tip label="Reframe build">
              <Button
                size="xs"
                variant="ghost"
                aria-label="Reframe build"
                onClick={() =>
                  rendererRef.current?.framePreset(activePreset, settings.projection, settings.fov)
                }
              >
                <RotateCcw aria-hidden="true" />
              </Button>
            </Tip>
          </ViewerOverlay>
        </div>
      )}
    </div>
  )
})
