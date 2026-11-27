// Interactive BlueMap-style 3D World Map viewport: dual-LOD streaming, smooth 3D/Iso/2D camera,
// isolated AxisGizmo & stream status overlays (0 parent re-renders while moving), Scout Terrain
// area selection, and Place Build live 3D schematic placement.
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode
} from 'react'
import {
  acquireResources,
  loadResources,
  releaseResources,
  type Resources
} from '@/entities/viewer/lib/render'
import { AxisGizmo } from '@/entities/viewer/ui/AxisGizmo'
import { ViewerOverlay, ViewerStage, ViewerStatusToast } from '@/entities/viewer/ui/ViewerOverlay'
import { viewAngles, type ViewName } from '@/entities/viewer/model/look'
import type { Orientation } from '@/entities/viewer/model/axis-gizmo'
import { useResolvedTheme } from '@/shared/lib/theme'
import { cn } from '@/shared/lib/utils'
import { loadWorldColors } from '../lib/color-table'
import { PlacementOverlay } from '../lib/PlacementOverlay'
import { WorldScene } from '../lib/WorldScene'
import { WorldStreamer } from '../lib/WorldStreamer'
import {
  boxDimensions,
  buildBoxFromOrigin,
  centeredBox,
  computeGroundStats,
  normalizeBox,
  nudgeBox,
  nudgeOrigin
} from '../model/placement'
import type {
  Box2D,
  CameraMode,
  GroundStats,
  LightingMode,
  PlacementMode,
  RotationDeg,
  StreamStats,
  Vec3,
  WorldCursor,
  WorldDataSource
} from '../model/types'

export interface FlyTarget {
  x: number
  y: number
  z: number
  distance?: number
  snap?: boolean
  seq: number
}

const DEFAULT_ORIENTATION: Orientation = [0, 0, 0, 1]

interface MiniEmitter<T> {
  current: T
  listeners: Set<(val: T) => void>
  emit(val: T): void
  subscribe(fn: (val: T) => void): () => void
}

function createEmitter<T>(initial: T): MiniEmitter<T> {
  const listeners = new Set<(val: T) => void>()
  const emitter: MiniEmitter<T> = {
    current: initial,
    listeners,
    emit(val: T) {
      emitter.current = val
      for (const fn of listeners) fn(val)
    },
    subscribe(fn: (val: T) => void) {
      listeners.add(fn)
      fn(emitter.current)
      return () => {
        listeners.delete(fn)
      }
    }
  }
  return emitter
}

interface StreamBadgeState {
  loading: boolean
  error: string | null
}

/** Isolated AxisGizmo leaf: orbiting the camera only re-renders this tiny 96x96 SVG, never the viewport or toolbar. */
const WorldAxisGizmo = memo(function WorldAxisGizmo({
  emitter,
  onViewChange,
  onOrbit,
  onAnnounce
}: {
  emitter: MiniEmitter<Orientation>
  onViewChange: (view: ViewName) => void
  onOrbit: (yaw: number, pitch: number) => void
  onAnnounce: (msg: string) => void
}): ReactElement {
  const [orientation, setOrientation] = useState<Orientation>(emitter.current)
  useEffect(() => emitter.subscribe(setOrientation), [emitter])
  return (
    <AxisGizmo
      orientation={orientation}
      onViewChange={onViewChange}
      onOrbit={onOrbit}
      onAnnounce={onAnnounce}
      className="absolute top-(--viewer-inset) right-(--viewer-inset) z-floating"
    />
  )
})

/** Isolated stream status indicator: tile fetches/mounts never trigger parent WorldMapViewport re-renders. */
const StreamStatusBadge = memo(function StreamStatusBadge({
  emitter
}: {
  emitter: MiniEmitter<StreamBadgeState>
}): ReactElement | null {
  const [status, setStatus] = useState<StreamBadgeState>(emitter.current)
  useEffect(() => emitter.subscribe(setStatus), [emitter])
  if (status.loading) {
    return (
      <span className="text-fg-muted" aria-live="polite">
        Loading…
      </span>
    )
  }
  if (status.error) {
    return (
      <span className="text-danger" role="alert">
        {status.error}
      </span>
    )
  }
  return null
})

function boxesOverlap(a: Box2D, b: Box2D): boolean {
  const [ax1, az1, ax2, az2] = normalizeBox(a)
  const [bx1, bz1, bx2, bz2] = normalizeBox(b)
  return ax1 <= bx2 && ax2 >= bx1 && az1 <= bz2 && az2 >= bz1
}

function sameGroundStats(a: GroundStats | null, b: GroundStats | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.min === b.min && a.max === b.max && a.median === b.median
}

interface Props {
  source: WorldDataSource | null
  /** Optional mcpack:// URL for textured 3D voxel chunks and build preview. */
  pack?: string | null
  cameraMode: CameraMode
  onCameraModeChange?: (mode: CameraMode) => void
  lighting: LightingMode
  mode: PlacementMode
  /** Scout Terrain area box [x1, z1, x2, z2]. */
  areaBox: Box2D | null
  onAreaBoxChange?: (box: Box2D) => void
  /** Place Build exact origin [x, y, z]. */
  origin: Vec3
  onOriginChange?: (origin: Vec3) => void
  rotation: RotationDeg
  onRotate?: (delta: 90 | -90) => void
  margin: number
  /** Optional build:// URL of the build's .litematic to preview on the 3D terrain. */
  buildSrc?: string | null
  /** Optional local build layer ceiling (0..height-1); null shows every layer. */
  clipY?: number | null
  onBuildSize?: (size: Vec3 | null) => void
  /** Change `seq` to fly/snap the camera to a world point. */
  flyTo?: FlyTarget | null
  /** Reports ground stats over the active footprint as terrain tiles stream in. */
  onGroundStats?: (stats: GroundStats | null) => void
  /** Exposes a live terrain height lookup function to the parent screen (for Snap to ground). */
  onHeightLookup?: (fn: (x: number, z: number) => number | null) => void
  /** Floating overlays (e.g., top map bar) rendered inside the stage. */
  children?: ReactNode
  className?: string
}

export function WorldMapViewport({
  source,
  pack,
  cameraMode,
  onCameraModeChange,
  lighting,
  mode,
  areaBox,
  onAreaBoxChange,
  origin,
  onOriginChange,
  rotation,
  onRotate,
  margin,
  buildSrc = null,
  clipY = null,
  onBuildSize,
  flyTo = null,
  onGroundStats,
  onHeightLookup,
  children,
  className
}: Props): ReactElement {
  const theme = useResolvedTheme()
  const dark = theme === 'dark'

  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<WorldScene | null>(null)
  const streamerRef = useRef<WorldStreamer | null>(null)
  const overlayRef = useRef<PlacementOverlay | null>(null)
  const cursorTextRef = useRef<HTMLSpanElement>(null)
  const lastGroundRef = useRef<GroundStats | null>(null)
  const hoverRafRef = useRef(0)
  const hoverPtRef = useRef<{ x: number; y: number } | null>(null)
  const dragBoxRafRef = useRef(0)
  const pendingDragBoxRef = useRef<Box2D | null>(null)
  const groundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [orientationEmitter] = useState(() => createEmitter<Orientation>(DEFAULT_ORIENTATION))
  const [statusEmitter] = useState(() =>
    createEmitter<StreamBadgeState>({ loading: false, error: null })
  )
  const [toast, setToast] = useState<{ msg: string; at: number }>({ msg: '', at: 0 })
  const [buildSize, setBuildSize] = useState<Vec3>([16, 16, 16])

  // Latest prop refs for pointer/worker callbacks without tearing down WebGL context
  const propsRef = useRef({
    cameraMode,
    mode,
    areaBox,
    origin,
    rotation,
    margin,
    buildSize,
    onCameraModeChange,
    onAreaBoxChange,
    onOriginChange,
    onBuildSize,
    onGroundStats
  })
  useEffect(() => {
    propsRef.current = {
      cameraMode,
      mode,
      areaBox,
      origin,
      rotation,
      margin,
      buildSize,
      onCameraModeChange,
      onAreaBoxChange,
      onOriginChange,
      onBuildSize,
      onGroundStats
    }
  })

  // Drag state: corner resize, Shift-drag new area box, or click-to-place detection
  const dragRef = useRef<
    | { kind: 'click'; startX: number; startY: number; travel: number }
    | { kind: 'draw'; anchorX: number; anchorZ: number }
    | { kind: 'corner'; fixedX: number; fixedZ: number }
    | null
  >(null)

  // Mount Three.js scene, streamer, and placement overlay once
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    let scene: WorldScene | null = null
    let statsTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleStats = (bounds?: Box2D): void => {
      const p = propsRef.current
      if (!p.onGroundStats) return
      const box =
        p.mode === 'build' ? buildBoxFromOrigin(p.origin, p.buildSize, p.rotation) : p.areaBox
      if (!box) {
        if (lastGroundRef.current !== null) {
          lastGroundRef.current = null
          p.onGroundStats(null)
        }
        return
      }
      if (bounds && !boxesOverlap(bounds, box)) return
      if (statsTimer !== null) return
      statsTimer = setTimeout(() => {
        statsTimer = null
        recomputeStats()
      }, 150)
    }

    const handleStreamStats = (s: StreamStats): void => {
      const nextLoading = s.pending > 0
      const nextError =
        !nextLoading && s.error && s.lowresLoaded === 0 && s.hiresLoaded === 0 ? s.error : null
      const cur = statusEmitter.current
      if (cur.loading === nextLoading && cur.error === nextError) return
      statusEmitter.emit({ loading: nextLoading, error: nextError })
    }

    const streamer = new WorldStreamer(
      () => {
        scene?.invalidate()
      },
      handleStreamStats,
      {
        onTerrainBounds: (bounds) => scheduleStats(bounds)
      }
    )
    scene = new WorldScene(el, streamer, (ori) => orientationEmitter.emit(ori))
    const overlay = new PlacementOverlay(scene, {
      onOriginDrag: (next) => propsRef.current.onOriginChange?.(next),
      onBuildLoaded: (size) => {
        if (size) setBuildSize(size)
        propsRef.current.onBuildSize?.(size)
      }
    })

    streamerRef.current = streamer
    sceneRef.current = scene
    // Dev-only handle for CDP performance scripts
    if (import.meta.env.DEV) Object.assign(window, { __worldMap: { scene, streamer } })
    overlayRef.current = overlay
    onHeightLookup?.((x, z) => streamer.heightAt(x, z))

    const ro = new ResizeObserver(() => scene?.resize())
    ro.observe(el)

    function recomputeStats(): void {
      const p = propsRef.current
      if (!p.onGroundStats) return
      const box =
        p.mode === 'build' ? buildBoxFromOrigin(p.origin, p.buildSize, p.rotation) : p.areaBox
      const next = box ? computeGroundStats(box, (x, z) => streamer.heightAt(x, z)) : null
      if (sameGroundStats(lastGroundRef.current, next)) return
      lastGroundRef.current = next
      p.onGroundStats(next)
    }

    return () => {
      if (statsTimer !== null) clearTimeout(statsTimer)
      if (groundTimerRef.current !== null) clearTimeout(groundTimerRef.current)
      groundTimerRef.current = null
      if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current)
      hoverRafRef.current = 0
      if (dragBoxRafRef.current) cancelAnimationFrame(dragBoxRafRef.current)
      dragBoxRafRef.current = 0
      onHeightLookup?.(() => null)
      ro.disconnect()
      overlay.dispose()
      scene?.dispose()
      streamer.dispose()
      overlayRef.current = null
      sceneRef.current = null
      streamerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lifecycle bound to mount node
  }, [])

  // Sync world data source
  useEffect(() => {
    streamerRef.current?.setSource(source)
  }, [source])

  // Load Minecraft texture pack resources once per pack URL
  useEffect(() => {
    let active = true
    let acquiredKey: string | null = null
    void (async () => {
      const colors = await loadWorldColors()
      if (!active) return
      let res: Resources | null = null
      if (pack) {
        try {
          // same key as the build viewer, Render Studio and block icons: one parsed pack for all of them
          const loaded = await acquireResources(`pack:${pack}`, async () => {
            const r = await fetch(pack)
            if (!r.ok) throw new Error('pack fetch failed')
            return loadResources(await r.arrayBuffer())
          })
          if (!active) {
            releaseResources(`pack:${pack}`)
            return
          }
          acquiredKey = `pack:${pack}`
          res = loaded
        } catch {
          res = null
        }
      }
      if (!active) return
      streamerRef.current?.setResources(res)
      overlayRef.current?.setResources(res, colors)
    })()
    return () => {
      active = false
      if (acquiredKey) releaseResources(acquiredKey)
    }
  }, [pack])

  // Sync atmosphere & theme colors
  useEffect(() => {
    const dim = source?.dimension ?? 'overworld'
    sceneRef.current?.setAtmosphere(dim, lighting, dark)
    overlayRef.current?.applyAxisColors()
  }, [source?.dimension, lighting, dark])

  // Sync camera mode
  useEffect(() => {
    sceneRef.current?.setCameraMode(cameraMode)
    overlayRef.current?.syncCamera()
  }, [cameraMode])

  // Sync flyTo / snapTo camera commands
  useEffect(() => {
    if (!flyTo || !sceneRef.current) return
    if (flyTo.snap) sceneRef.current.snapTo(flyTo.x, flyTo.y, flyTo.z, flyTo.distance)
    else sceneRef.current.flyTo(flyTo.x, flyTo.y, flyTo.z, flyTo.distance)
  }, [flyTo])

  // Sync build .litematic preview
  useEffect(() => {
    void overlayRef.current?.setBuildSrc(mode === 'build' ? buildSrc : null)
  }, [mode, buildSrc])

  // Sync placement overlay geometry & ground stats (debounce expensive ground sampling during box drags)
  useEffect(() => {
    const streamer = streamerRef.current
    const statsBox = mode === 'build' ? buildBoxFromOrigin(origin, buildSize, rotation) : areaBox
    const draggingBox = dragRef.current?.kind === 'draw' || dragRef.current?.kind === 'corner'

    let ground = lastGroundRef.current
    if (!draggingBox) {
      if (groundTimerRef.current !== null) {
        clearTimeout(groundTimerRef.current)
        groundTimerRef.current = null
      }
      ground =
        statsBox && streamer
          ? computeGroundStats(statsBox, (x, z) => streamer.heightAt(x, z))
          : null
      if (!sameGroundStats(lastGroundRef.current, ground)) {
        lastGroundRef.current = ground
        onGroundStats?.(ground)
      }
    } else if (groundTimerRef.current === null && statsBox && streamer) {
      groundTimerRef.current = setTimeout(() => {
        groundTimerRef.current = null
        const p = propsRef.current
        const box =
          p.mode === 'build' ? buildBoxFromOrigin(p.origin, p.buildSize, p.rotation) : p.areaBox
        const next = box ? computeGroundStats(box, (x, z) => streamer.heightAt(x, z)) : null
        if (!sameGroundStats(lastGroundRef.current, next)) {
          lastGroundRef.current = next
          p.onGroundStats?.(next)
        }
      }, 150)
    }

    overlayRef.current?.update({
      mode,
      box: areaBox,
      origin,
      rotation,
      margin,
      groundY: ground?.median ?? null,
      clipY
    })
  }, [mode, areaBox, origin, rotation, margin, buildSize, clipY, onGroundStats])

  const setCursorReadout = (hit: WorldCursor | null): void => {
    const el = cursorTextRef.current
    if (!el) return
    const next = hit ? `X ${hit.x}  Y ${hit.y}  Z ${hit.z}` : '—'
    if (el.textContent !== next) el.textContent = next
  }

  const announce = useCallback((msg: string): void => setToast({ msg, at: Date.now() }), [])

  const handleGizmoOrbit = useCallback((yaw: number, pitch: number): void => {
    sceneRef.current?.orbitBy(yaw, pitch)
  }, [])

  const handleGizmoView = useCallback((view: ViewName): void => {
    const scene = sceneRef.current
    if (!scene || view === 'orbit') return
    if (view === 'top') {
      propsRef.current.onCameraModeChange?.('top')
      scene.setCameraMode('top')
      overlayRef.current?.syncCamera()
      return
    }
    if (propsRef.current.cameraMode === 'top') propsRef.current.onCameraModeChange?.('3d')
    const { pitch, yaw } = viewAngles(view)
    const p = (pitch * Math.PI) / 180
    const y = (yaw * Math.PI) / 180
    scene.lookFrom([Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)])
  }, [])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 || overlayRef.current?.isDragging) return
    const scene = sceneRef.current
    const overlay = overlayRef.current
    if (!scene || !overlay) return

    // 1. In Area mode, check corner handle resize drag first
    if (mode === 'area' && areaBox) {
      const corner = overlay.pickCornerHandle(e.clientX, e.clientY)
      if (corner >= 0) {
        const [x1, z1, x2, z2] = normalizeBox(areaBox)
        // Opposite fixed corner for corner indices: 0=(x1,z1), 1=(x2,z1), 2=(x2,z2), 3=(x1,z2)
        const fixed: [number, number][] = [
          [x2, z2],
          [x1, z2],
          [x1, z1],
          [x2, z1]
        ]
        dragRef.current = { kind: 'corner', fixedX: fixed[corner][0], fixedZ: fixed[corner][1] }
        scene.controls.enabled = false
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
    }

    // 2. Shift + Left-drag in Area mode draws a new footprint box directly on the 3D terrain
    if (mode === 'area' && e.shiftKey) {
      const hit = scene.pickTerrain(e.clientX, e.clientY, true)
      if (hit) {
        dragRef.current = { kind: 'draw', anchorX: hit.x, anchorZ: hit.z }
        scene.controls.enabled = false
        onAreaBoxChange?.([hit.x, hit.z, hit.x, hit.z])
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
    }

    // 3. Otherwise allow OrbitControls, tracking pointer travel for click-to-place
    dragRef.current = { kind: 'click', startX: e.clientX, startY: e.clientY, travel: 0 }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    const scene = sceneRef.current
    if (!scene) return

    const drag = dragRef.current
    if (drag?.kind === 'click') {
      drag.travel = Math.max(
        drag.travel,
        Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY)
      )
      return
    }
    if (drag?.kind === 'draw' || drag?.kind === 'corner') {
      const hit = scene.pickTerrain(e.clientX, e.clientY, false)
      setCursorReadout(hit)
      if (!hit) return
      pendingDragBoxRef.current =
        drag.kind === 'draw'
          ? normalizeBox([drag.anchorX, drag.anchorZ, hit.x, hit.z])
          : normalizeBox([drag.fixedX, drag.fixedZ, hit.x, hit.z])
      if (!dragBoxRafRef.current) {
        dragBoxRafRef.current = requestAnimationFrame(() => {
          dragBoxRafRef.current = 0
          const next = pendingDragBoxRef.current
          if (next) propsRef.current.onAreaBoxChange?.(next)
        })
      }
      return
    }

    // Skip hover picking while orbiting/panning with mouse buttons held
    if (e.buttons !== 0 || overlayRef.current?.isDragging) return

    // Coalesce hover coordinate updates to one heightfield lookup per animation frame (zero React re-renders)
    hoverPtRef.current = { x: e.clientX, y: e.clientY }
    if (!hoverRafRef.current) {
      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = 0
        const pt = hoverPtRef.current
        const sc = sceneRef.current
        if (!pt || !sc) return
        setCursorReadout(sc.pickTerrain(pt.x, pt.y, false))
      })
    }
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>): void => {
    const scene = sceneRef.current
    const drag = dragRef.current
    dragRef.current = null
    if (scene && !overlayRef.current?.isDragging) scene.controls.enabled = true

    if (drag?.kind === 'draw' || drag?.kind === 'corner') {
      if (dragBoxRafRef.current) {
        cancelAnimationFrame(dragBoxRafRef.current)
        dragBoxRafRef.current = 0
      }
      const pending = pendingDragBoxRef.current
      pendingDragBoxRef.current = null
      if (pending) propsRef.current.onAreaBoxChange?.(pending)
      // Flush final ground stats once drag completes
      const streamer = streamerRef.current
      const box = pending ?? propsRef.current.areaBox
      if (box && streamer) {
        const next = computeGroundStats(box, (x, z) => streamer.heightAt(x, z))
        if (!sameGroundStats(lastGroundRef.current, next)) {
          lastGroundRef.current = next
          propsRef.current.onGroundStats?.(next)
        }
      }
      return
    }

    if (!drag || drag.kind !== 'click' || drag.travel >= 5 || !scene) return
    if (overlayRef.current?.isDragging) return

    const hit = scene.pickTerrain(e.clientX, e.clientY, true)
    if (!hit) return
    setCursorReadout(hit)
    if (mode === 'area') {
      const [w, d] = areaBox ? boxDimensions(areaBox) : [32, 32]
      onAreaBoxChange?.(centeredBox(hit.x, hit.z, w, d))
    } else {
      onOriginChange?.([hit.x, hit.y + 1, hit.z])
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    const scene = sceneRef.current
    if (!scene) return

    if (e.key === 'Shift') {
      scene.setFlyKey('shift', true)
      return
    }
    if (e.key === '1') {
      onCameraModeChange?.('3d')
      return
    }
    if (e.key === '2') {
      onCameraModeChange?.('iso')
      return
    }
    if (e.key === '3') {
      onCameraModeChange?.('top')
      return
    }
    if ((e.key === 'r' || e.key === 'R') && mode === 'build') {
      e.preventDefault()
      onRotate?.(e.shiftKey ? -90 : 90)
      return
    }
    if ('wasdWASD'.includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      scene.setFlyKey(e.key, true)
      scene.setFlyKey('shift', e.shiftKey)
      return
    }

    const step = e.shiftKey ? 16 : 1
    let dx = 0
    let dz = 0
    if (e.key === 'ArrowLeft') dx = -step
    else if (e.key === 'ArrowRight') dx = step
    else if (e.key === 'ArrowUp') dz = -step
    else if (e.key === 'ArrowDown') dz = step
    else return

    e.preventDefault()
    if (mode === 'area' && areaBox) {
      onAreaBoxChange?.(nudgeBox(areaBox, dx, dz))
    } else if (mode === 'build') {
      onOriginChange?.(nudgeOrigin(origin, dx, 0, dz))
    }
  }

  const onKeyUp = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Shift') {
      sceneRef.current?.setFlyKey('shift', false)
      return
    }
    if ('wasdWASD'.includes(e.key)) sceneRef.current?.setFlyKey(e.key, false)
  }

  return (
    <ViewerStage className={cn('select-none', className)}>
      <div
        ref={mountRef}
        role="application"
        aria-label="Interactive 3D world map"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragRef.current = null
          pendingDragBoxRef.current = null
          if (sceneRef.current) sceneRef.current.controls.enabled = true
        }}
        onPointerLeave={() => {
          hoverPtRef.current = null
          setCursorReadout(null)
        }}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => {
          ;['w', 'a', 's', 'd', 'shift'].forEach((k) => sceneRef.current?.setFlyKey(k, false))
        }}
        className="size-full cursor-grab outline-none active:cursor-grabbing"
      />

      {children}

      {/* Top-end Axis Gizmo (isolated leaf component) */}
      <WorldAxisGizmo
        emitter={orientationEmitter}
        onViewChange={handleGizmoView}
        onOrbit={handleGizmoOrbit}
        onAnnounce={announce}
      />

      {/* Bottom-start live coordinate readout */}
      <ViewerOverlay className="pointer-events-none absolute bottom-(--viewer-inset) left-(--viewer-inset) z-floating flex items-center gap-2.5 px-2.5 py-1 font-mono text-xs tabular-nums">
        <span ref={cursorTextRef} className="text-fg-secondary">
          —
        </span>
        <StreamStatusBadge emitter={statusEmitter} />
      </ViewerOverlay>

      <ViewerStatusToast message={toast.msg || null} at={toast.at} />
    </ViewerStage>
  )
}
