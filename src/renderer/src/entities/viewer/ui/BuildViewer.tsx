// <BuildViewer>: the one boundary around the 3D renderer (./render, our own on three.js). Everything else in the
// app talks to these props.
import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { createPortal } from 'react-dom'
import {
  Renderer,
  acquireResources,
  loadResources,
  releaseResources,
  type BlockColorMap,
  type Resources
} from '../lib/render'
import {
  applyLook,
  DEFAULT_LOOK,
  viewAngles,
  type Look,
  type Scene,
  type ViewName
} from '../model/look'
import { readBlock, type Cell, type CellBounds } from '../model/inspection'
import type { Orientation } from '../model/axis-gizmo'
import { AIR, cellKey, layerCells, type EditLayer } from '../model/edits'
import { useProjection, type Projection } from '../model/projection'
import { distanceOf, legs, type Measure } from '../model/ruler'
import { drive, type CamState, type ViewSync } from '../model/view-sync'
import { gridSpan, gridStep } from '../model/grid'
import { cssColor, useResolvedTheme } from '@/shared/lib/theme'
import { resourceUrl } from '@/shared/lib/urls'
import { AxisGizmo } from '@/entities/viewer/ui/AxisGizmo'
import { ViewerErrorCard, ViewerLoadingCard } from '@/entities/viewer/ui/ViewerCards'
import { ViewerStage, ViewerStatusToast } from '@/entities/viewer/ui/ViewerOverlay'
import type { BridgeProgress } from '@shared/api'

export type { Cell } from '../model/inspection'
export type { ViewSync } from '../model/view-sync'
export interface Marker {
  cell: Cell
  color: string
  label?: string // drawn above the cell, always facing the camera (review pins)
}
/** A cell the pointer is over: the face it hit points along `normal`; `adjacent` is the cell beyond that face. */
export interface ViewerHit {
  cell: Cell
  normal: Cell
  adjacent: Cell
  state: string | undefined
}
export interface ViewerPick extends ViewerHit {
  add: boolean // shift was held
  alt: boolean
  button: number // the mouse button; -1 when inspectCell picked it, not a click
}
export interface EditBox {
  min: Cell
  max: Cell
  tone: 'hover' | 'place' | 'erase' | 'select'
}
const BOX_TONES = {
  hover: '--fg',
  place: '--accent-solid',
  erase: '--danger-solid',
  select: '--accent-solid'
} as const
/** A drag that draws (DESIGN › Drawing on the view): it starts on the build, moves, then ends or is cancelled. */
export type StrokePhase = 'start' | 'move' | 'end' | 'cancel'
/** A cell a tool is about to change (DESIGN › Edit ghost): tinted with `color`, or removed. */
export interface GhostCell {
  cell: Cell
  color?: string
  erase?: boolean
}
/** The loaded file's own blocks, under the hand edits drawn over it. */
export interface BlockReader {
  /** The file's block at a cell; null outside it. */
  at: (cell: Cell) => string | null
  /** The cells the file and the edits drawn over it span. */
  box: () => { min: Cell; max: Cell } | null
}

export interface ViewerStats {
  dims: Cell | null
  loadMs: number
}

export interface ViewerOverlayFile {
  src: string
  visible: boolean
  selection?: boolean
  maskOnly?: boolean
}

interface Props {
  src: string | null // build:// URL of a .litematic
  pack: string // mcpack:// URL of the jar-built pack
  view: ViewName
  onViewChange?: (view: ViewName) => void
  /** Change it to turn the camera to `view` again, even when `view` did not change. */
  viewRequest?: number
  gizmoTarget?: HTMLElement | null
  look?: Look
  clipY?: number | null // show cells with y <= clipY
  markers?: Marker[]
  focus?: { cell: Cell; t: number } | null // fly the camera to a cell (t: change it to fly again)
  inspectCell?: { cell: Cell; t: number } | null // inspect and focus a coordinate in the current file
  // state: the build's block at cell, also where an overlay was hit; add: shift was held
  onPick?: (p: ViewerPick) => void
  /** The cell under the pointer while it moves over the view without a button held; null off the build. */
  onHover?: (p: ViewerHit | null) => void
  /** Hand edits drawn over the file, cell for cell. */
  edits?: EditLayer
  /** Where the file's (0, 0, 0) sits in build coordinates: the ground axes cross at the build's own origin. */
  origin?: readonly number[]
  /** Boxes over the build: the hovered cell, where a block would go, what is selected. */
  editBoxes?: EditBox[]
  /** Set it and a left-drag that starts on the build draws instead of orbiting. */
  onStroke?: (phase: StrokePhase, hit: ViewerHit | null, shift: boolean) => void
  /** The cells a tool is about to change, drawn through the build. */
  ghost?: GhostCell[]
  /** The Ruler's two cells: axis legs with block counts and the straight distance, drawn through the build. */
  measure?: Measure | null
  /** Transform's handles at cell `at`: arrows move it a block at a time, the Y ring turns `turns` a quarter
   *  turn (clockwise seen from above) at a time. */
  transform?: {
    at: Cell
    turns: number
    onMove: (at: Cell) => void
    onTurn: (turns: number) => void
  } | null
  /** Gets a reader for the loaded file's blocks, and null while there is none. */
  onReader?: (reader: BlockReader | null) => void
  onStats?: (s: ViewerStats) => void
  onFps?: (fps: number) => void // sampled once a second while the viewer is rendering
  shared?: boolean // mesh against one app-wide pack and atlas (several viewers on a screen)
  sync?: ViewSync // viewers holding the same ViewSync follow each other's camera
  // more files drawn over the build, cell for cell from the min corner (the voxel diff's tinted glass)
  overlays?: ViewerOverlayFile[]
  onOverlayProgress?: (key: string, progress: BridgeProgress | null) => void
  /** Incoming schematic, positioned by its destination minimum corner. */
  placement?: {
    src: string
    position: Cell
    onPositionChange: (position: Cell) => void
    enabled?: boolean
  }
  hideBuild?: boolean // show only the overlays (a part on its own); clicks still pick the build's cells
}

const MARKERS = 'studio-markers'
type Box = CellBounds

/** Handles in the axis colours, the hovered one in the focus ring's. */
function axisColors(controls: TransformControls): void {
  const color = (token: string): THREE.Color =>
    new THREE.Color().setStyle(cssColor(token), THREE.LinearSRGBColorSpace)
  controls.setColors(color('--axis-x'), color('--axis-y'), color('--axis-z'), color('--focus-ring'))
}

/** The cells' extent in world units: cell centres sit on integer coordinates. */
const cellBox = (b: Box): THREE.Box3 =>
  new THREE.Box3(
    new THREE.Vector3(...b.min).subScalar(0.5),
    new THREE.Vector3(...b.max).addScalar(0.5)
  )

/** The direction from the build to a camera at pitch/yaw degrees (yaw 0 = +z, 90 = +x). */
function viewDir(angles: { pitch: number; yaw: number }): THREE.Vector3 {
  const [p, y] = [angles.pitch, angles.yaw].map((d) => THREE.MathUtils.degToRad(d))
  return new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p))
}
const ORBIT = { pitch: 30, yaw: 45 } // the free view's first framing

/** Fly a perspective camera to 24 blocks from a cell, along the current view direction. */
function focusCell(renderer: Renderer, cell: Cell): void {
  const cm = renderer.cameras
  const target = new THREE.Vector3(...cell)
  const dir = cm.active.getWorldDirection(new THREE.Vector3()).negate()
  cm.setProjection('perspective')
  cm.lookAt(target.clone().addScaledVector(dir, 24), target)
}

/** Block colours for the colour-only fallback (no texture pack), from the engine's measured colours. */
async function blockColors(): Promise<BlockColorMap | null> {
  try {
    const r = await fetch(resourceUrl('lib/mcb/data/block_colors.json'))
    return r.ok ? ((await r.json()) as { colors: BlockColorMap }).colors : null
  } catch {
    return null
  }
}

/** Light-gray lines `step` blocks apart under the build, through the corner of cell `origin`. */
function gridUnder(box: Box, origin: Cell, step: number): THREE.LineSegments {
  const [x0, x1] = gridSpan(box.min[0], box.max[0], origin[0], step)
  const [z0, z1] = gridSpan(box.min[2], box.max[2], origin[2], step)
  const pts: number[] = []
  for (let x = x0; x <= x1; x += step) pts.push(x, 0, z0, x, 0, z1)
  for (let z = z0; z <= z1; z += step) pts.push(x0, 0, z, x1, 0, z)
  const geo = new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute(pts, 3)
  )
  const grid = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: 0xa1a1aa, transparent: true, opacity: 0.45 })
  )
  grid.position.y = box.min[1] - 0.5
  return grid
}

/** X and Z lines on the floor through the corner of cell `origin`: solid toward plus, faint toward minus. */
function groundAxes(box: Box, origin: Cell, margin = 8): THREE.Group {
  const group = new THREE.Group()
  const y = box.min[1] - 0.5
  for (const [axis, i] of [
    ['x', 0],
    ['z', 2]
  ] as const) {
    const color = cssColor(`--axis-${axis}`)
    const o = origin[i] - 0.5
    const [lo, hi] = [box.min[i] - margin - 0.5, box.max[i] + margin + 0.5]
    const at = (v: number): [number, number, number] =>
      i === 0 ? [v, y, origin[2] - 0.5] : [origin[0] - 0.5, y, v]
    const end = Math.max(hi, o + 4)
    for (const [from, to, opacity] of [
      [o, end, 1],
      [Math.min(lo, o - 4), o, 0.35]
    ]) {
      const geo = new THREE.BufferGeometry().setFromPoints(
        [at(from), at(to)].map((p) => new THREE.Vector3(...p))
      )
      group.add(
        new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }))
      )
    }
  }
  return group
}

export function BuildViewer({
  src,
  pack,
  view,
  onViewChange,
  viewRequest,
  gizmoTarget,
  look = 'game',
  clipY = null,
  markers = [],
  focus,
  inspectCell,
  onPick,
  onHover,
  edits,
  origin,
  editBoxes,
  onStroke,
  ghost,
  measure,
  transform,
  onReader,
  onStats,
  onFps,
  shared = false,
  sync,
  overlays = [],
  onOverlayProgress,
  placement,
  hideBuild = false
}: Props): ReactElement {
  const theme = useResolvedTheme()
  const [ox = 0, oy = 0, oz = 0] = origin ?? []
  const holder = useRef<HTMLDivElement>(null)
  const canvasEl = useRef<HTMLCanvasElement | null>(null)
  const r = useRef<Renderer | null>(null)
  const scene = useRef<Scene | null>(null)
  const t0 = useRef(0) // load start, for the time to first meshed frame
  const latest = useRef({
    src,
    view,
    look,
    clipY,
    onPick,
    onHover,
    onStroke,
    onReader,
    edits,
    onStats,
    onFps
  })
  useLayoutEffect(() => {
    latest.current = {
      src,
      view,
      look,
      clipY,
      onPick,
      onHover,
      onStroke,
      onReader,
      edits,
      onStats,
      onFps
    }
  }, [src, view, look, clipY, onPick, onHover, onStroke, onReader, edits, onStats, onFps])
  // Unique ids keep a late load from reporting an older file as the current build.
  const mainId = useRef('build-0')
  const loadSequence = useRef(0)
  const loadedSource = useRef<string | null>(null)
  const inspection = useRef<{
    request: NonNullable<Props['inspectCell']>
    src: string | null
  } | null>(null)
  const inspected = useRef<Props['inspectCell']>(null)
  const [ready, setReady] = useState(false) // renderer and pack loaded
  const [orientation, setOrientation] = useState<Orientation>([0, 0, 0, 1])
  const [said, setSaid] = useState({ text: null as string | null, at: 0 }) // the gizmo's last choice
  const projection = useProjection((s) => s.projection)
  const [requestedView, setRequestedView] = useState<{ view: ViewName } | null>(null)
  const appliedView = useRef<typeof requestedView>(null)
  const showGizmo = !!onViewChange
  const syncOwner = useRef<object>({})
  const refreshGizmo = useRef<() => void>(() => {})
  const [loaded, setLoaded] = useState(0) // bumps after each schematic is meshed
  const [overlaid, setOverlaid] = useState(0) // bumps after each overlay is meshed
  const overlayIds = useRef<string[]>([])
  const overlayFiles = useRef(new Map<string, string>())
  const committedOverlayKey = useRef('')
  const overlayLatest = useRef({ overlays, hideBuild, onOverlayProgress })
  useLayoutEffect(() => {
    overlayLatest.current = { overlays, hideBuild, onOverlayProgress }
  })
  const placementSrc = placement?.src
  const latestPlacement = useRef(placement)
  const placementDrag = useRef<{
    controls: TransformControls
    setEnabled: (enabled: boolean) => void
    target: THREE.Object3D
    box: THREE.Box3
  } | null>(null)
  const [placementLoaded, setPlacementLoaded] = useState(0)
  const [placementLoading, setPlacementLoading] = useState(false)
  const [placementError, setPlacementError] = useState('')
  useLayoutEffect(() => {
    latestPlacement.current = placement
  }, [placement])
  const [shown, setShown] = useState(0) // bumps when a hidden viewer (Sheet tab) with a pending framing is shown
  const unframed = useRef(false)
  const [status, setStatus] = useState('') // a load failure
  const [progress, setProgress] = useState<{ label: string; frac?: number } | null>(null)
  const box = useRef<Box | null>(null)
  const originals = useRef(new Map<string, string>()) // the file's blocks under the hand edits
  const editing = useRef(Promise.resolve()) // one apply at a time
  const main = (): ReturnType<Renderer['getSchematic']> => r.current?.getSchematic(mainId.current)
  // under a hand edit, the file's block is the one the edit replaced
  const reader = useRef<BlockReader>({
    at: (c) => originals.current.get(cellKey(c)) ?? main()?.blockAt(...c) ?? null,
    box: () => main()?.box ?? null
  })
  const frameBounds = (): THREE.Box3 | null => {
    const b = box.current && cellBox(box.current)
    const incoming = placementDrag.current
    if (!incoming) return b
    const preview = incoming.box.clone().translate(incoming.target.position)
    return b ? b.union(preview) : preview
  }

  // one renderer per mounted viewer, on its own canvas: dispose() loses the WebGL context, so a renderer
  // remounted on the same canvas (React StrictMode mounts twice) would draw nothing
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.className = 'block h-full w-full'
    holder.current!.appendChild(canvas)
    canvasEl.current = canvas
    let disposed = false
    let cleanup = (): void => {}
    const load = async (): Promise<Resources> => {
      const res = await fetch(pack)
      if (!res.ok) throw new Error(`texture pack: ${res.status}`)
      return loadResources(await res.arrayBuffer())
    }
    // the pack is parsed and the atlas built once for every shared viewer
    const resources = shared ? acquireResources(`pack:${pack}`, load) : load()
    void resources
      .catch((e) => {
        console.warn('viewer: no texture pack, drawing block colours', e)
        return null
      })
      .then(async (res) => {
        const colors = res ? null : await blockColors()
        if (!disposed) cleanup = create(res, colors)
      })
    const create = (resources: Resources | null, colors: BlockColorMap | null): (() => void) => {
      const renderer = new Renderer(canvas, { resources, colors })
      r.current = renderer
      setReady(true)
      // dev-only handles for measuring frame cost from DevTools
      const dev = window as unknown as { __viewer?: Renderer; __viewers?: Set<Renderer> }
      if (import.meta.env.DEV) (dev.__viewers ??= new Set()).add((dev.__viewer = renderer))
      const ro = new ResizeObserver(() => {
        if (!canvas.parentElement!.clientWidth) return // hidden: a 0x0 size would make the camera NaN
        renderer.resize()
        if (unframed.current) setShown((n) => n + 1)
      })
      ro.observe(canvas.parentElement!)
      // a hidden tab (forceMount) or window would keep the render loop polling: pause it until shown
      let onScreen = true
      const showing = (): void =>
        onScreen && !document.hidden ? renderer.resume() : renderer.suspend()
      const io = new IntersectionObserver(([e]) => {
        onScreen = e.isIntersecting
        showing()
      })
      io.observe(canvas)
      document.addEventListener('visibilitychange', showing)
      return () => {
        io.disconnect()
        document.removeEventListener('visibilitychange', showing)
        ro.disconnect()
        r.current = null
        dev.__viewers?.delete(renderer)
        renderer.dispose()
      }
    }
    return () => {
      disposed = true
      cleanup()
      // kept warm at zero references: the next build opens without parsing the pack again
      if (shared) releaseResources(`pack:${pack}`)
      canvas.remove()
    }
  }, [pack, shared])

  // (re)load the file
  useEffect(() => {
    const renderer = r.current
    mainId.current = `build-${++loadSequence.current}`
    const id = mainId.current
    loadedSource.current = null
    box.current = null
    originals.current = new Map()
    latest.current.onReader?.(null)
    if (!ready || !renderer) return
    let stale = false
    t0.current = performance.now()
    setStatus('')
    renderer.removeAll()
    renderer.setSelection([], 0)
    overlayFiles.current.clear()
    overlayIds.current = []
    committedOverlayKey.current = ''
    setProgress(
      src ? { label: 'Reading ' + decodeURIComponent(src.split('/').pop()!.split('?')[0]) } : null
    )
    ;(async () => {
      if (!src) return
      const buf = await (await fetch(src)).arrayBuffer()
      if (stale) return
      const obj = await renderer.loadSchematic(id, buf, {
        onProgress: (frac) => !stale && setProgress({ label: 'Preparing preview…', frac }),
        stale: () => stale
      })
      if (!obj || stale) return
      loadedSource.current = src
      // the file's own size, for the slider and Activity stats
      box.current = obj.box
      setProgress(null)
      latest.current.onStats?.({
        dims: obj.schematic.size,
        loadMs: Math.round(performance.now() - t0.current)
      })
      latest.current.onReader?.(reader.current)
      setLoaded((n) => n + 1)
    })().catch((e) => {
      if (stale) return
      setProgress(null)
      setStatus(`failed: ${e}`)
    })
    return () => {
      stale = true
    }
  }, [ready, src])

  useEffect(() => {
    const renderer = r.current
    const canvas = canvasEl.current
    if (!ready || !renderer || !canvas || !placementSrc) return
    let stale = false
    let dispose = (): void => {}
    const id = 'placement-' + mainId.current
    setPlacementLoading(true)
    setPlacementError('')
    void (async () => {
      const res = await fetch(placementSrc)
      if (!res.ok) throw new Error(`incoming schematic: ${res.status}`)
      const data = await res.arrayBuffer()
      if (stale) return
      const obj = await renderer.loadSchematic(id, data, { stale: () => stale })
      if (!obj || stale || !latestPlacement.current) return

      const target = new THREE.Group()
      const min = new THREE.Vector3(...obj.box.min)
      target.position.set(...latestPlacement.current.position)
      obj.group.position.copy(min).negate()
      obj.opacity = 0.55
      renderer.scene.add(target)
      target.add(obj.group)

      const cameras = renderer.cameras
      const controls = new TransformControls(cameras.active, canvas)
      controls.setTranslationSnap(1)
      controls.showXY = controls.showYZ = controls.showXZ = false
      controls.setSize(1.2)
      const helper = controls.getHelper()
      renderer.scene.add(helper)
      controls.attach(target)

      const syncCamera = (): void => {
        controls.camera = cameras.active
      }
      const cancelDrag = (): void => controls.pointerUp(null)
      controls.addEventListener('change', () => renderer.invalidate())
      controls.addEventListener('dragging-changed', () => {
        cameras.controls.enabled = !controls.dragging
      })
      controls.addEventListener('objectChange', () => {
        const next = target.position.toArray()
        if (next.some((value, axis) => value !== latestPlacement.current?.position[axis]))
          latestPlacement.current?.onPositionChange(next)
      })
      cameras.addEventListener('change', syncCamera)
      canvas.addEventListener('pointercancel', cancelDrag)
      placementDrag.current = {
        controls,
        setEnabled: (enabled) => {
          if (!enabled) cancelDrag()
          controls.enabled = enabled
        },
        target,
        box: cellBox(obj.box).translate(min.negate())
      }
      dispose = () => {
        canvas.removeEventListener('pointercancel', cancelDrag)
        cameras.removeEventListener('change', syncCamera)
        cancelDrag()
        controls.dispose()
        canvas.style.touchAction = 'none' // OrbitControls still owns the canvas
        helper.removeFromParent()
        target.removeFromParent()
        placementDrag.current = null
      }
      setPlacementLoading(false)
      setPlacementLoaded((n) => n + 1)
    })().catch((e) => {
      if (stale) return
      setPlacementLoading(false)
      setPlacementError(String(e))
    })
    return () => {
      stale = true
      dispose()
      renderer.removeSchematic(id)
    }
  }, [ready, placementSrc, src])

  const [placementX, placementY, placementZ] = placement?.position ?? []
  const placementEnabled = placement?.enabled
  useEffect(() => {
    placementDrag.current?.setEnabled(placementEnabled !== false)
  }, [placementEnabled, placementLoaded])
  useEffect(() => {
    const incoming = placementDrag.current
    if (
      incoming &&
      placementX !== undefined &&
      placementY !== undefined &&
      placementZ !== undefined
    ) {
      incoming.target.position.set(placementX, placementY, placementZ)
      r.current?.invalidate()
    }
  }, [placementX, placementY, placementZ])

  useEffect(() => {
    const controls = placementDrag.current?.controls
    if (!controls) return
    axisColors(controls)
    r.current?.invalidate()
  }, [theme, placementLoaded])

  // Transform's handles (DESIGN › Transform handles) on an empty target at the moved selection's cell
  const latestTransform = useRef(transform)
  useLayoutEffect(() => {
    latestTransform.current = transform
  })
  const handles = useRef<TransformControls[]>([])
  const handleTarget = useRef<THREE.Object3D | null>(null)
  const [handlesMade, setHandlesMade] = useState(0)
  const transforming = !!transform
  useEffect(() => {
    const renderer = r.current
    const canvas = canvasEl.current
    const first = latestTransform.current
    if (!ready || !renderer || !canvas || !first) return
    const cameras = renderer.cameras
    const target = new THREE.Object3D()
    target.position.set(...first.at)
    renderer.scene.add(target)
    const controls: TransformControls[] = []
    const make = (mode: 'translate' | 'rotate', size: number): TransformControls => {
      const c = new TransformControls(cameras.active, canvas)
      controls.push(c)
      c.setMode(mode)
      c.setSize(size)
      c.addEventListener('change', () => renderer.invalidate())
      c.addEventListener('dragging-changed', () => {
        cameras.controls.enabled = !controls.some((d) => d.dragging)
      })
      renderer.scene.add(c.getHelper())
      c.attach(target)
      return c
    }
    const move = make('translate', 1.2)
    move.setTranslationSnap(1)
    move.showXY = move.showYZ = move.showXZ = false
    move.addEventListener('objectChange', () => {
      const at = target.position.toArray().map(Math.round) as Cell
      const t = latestTransform.current
      if (t && at.some((v, i) => v !== t.at[i])) t.onMove(at)
    })
    // the ring sits outside the arrows' heads
    const turn = make('rotate', 1.8)
    turn.showX = turn.showZ = false
    // the ring's own angle shrinks with the camera's distance (too little to snap in the isometric view), so
    // the turn is the pointer's sweep round the target on its level, a quarter turn per 90°
    const level = new THREE.Plane(new THREE.Vector3(0, 1, 0))
    const ray = new THREE.Raycaster()
    const angleAt = (e: PointerEvent): number | null => {
      const rect = canvas.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      ray.setFromCamera(ndc, cameras.active)
      level.constant = -target.position.y
      const p = ray.ray.intersectPlane(level, new THREE.Vector3())
      // from +Z towards +X: a clockwise turn seen from above makes it smaller
      return p && Math.atan2(p.x - target.position.x, p.z - target.position.z)
    }
    let pressed: PointerEvent | null = null
    let sweep: { from: number; last: number; swept: number } | null = null
    const onPress = (e: PointerEvent): void => void (pressed = e)
    turn.addEventListener('mouseDown', () => {
      // where the ring crosses the down arrow, the arrow has it
      if (move.dragging) return turn.pointerUp(null)
      const a = pressed && angleAt(pressed)
      sweep = a === null ? null : { from: latestTransform.current?.turns ?? 0, last: a, swept: 0 }
    })
    const onSweep = (e: PointerEvent): void => {
      const a = sweep && turn.dragging ? angleAt(e) : null
      if (!sweep || a === null) return
      sweep.swept += Math.atan2(Math.sin(a - sweep.last), Math.cos(a - sweep.last))
      sweep.last = a
      const turns = sweep.from - Math.round(sweep.swept / (Math.PI / 2))
      const t = latestTransform.current
      if (t && turns !== t.turns) t.onTurn(turns)
    }
    turn.addEventListener('mouseUp', () => {
      sweep = null
      target.quaternion.identity()
      renderer.invalidate()
    })
    canvas.addEventListener('pointerdown', onPress, true)
    canvas.addEventListener('pointermove', onSweep)
    const syncCamera = (): void => controls.forEach((c) => (c.camera = cameras.active))
    const cancelDrag = (): void => controls.forEach((c) => c.pointerUp(null))
    cameras.addEventListener('change', syncCamera)
    canvas.addEventListener('pointercancel', cancelDrag)
    handles.current = controls
    handleTarget.current = target
    setHandlesMade((n) => n + 1)
    renderer.invalidate()
    return () => {
      canvas.removeEventListener('pointerdown', onPress, true)
      canvas.removeEventListener('pointermove', onSweep)
      canvas.removeEventListener('pointercancel', cancelDrag)
      cameras.removeEventListener('change', syncCamera)
      for (const c of controls) {
        c.pointerUp(null)
        c.getHelper().removeFromParent()
        c.dispose()
      }
      cameras.controls.enabled = true
      canvas.style.touchAction = 'none' // OrbitControls still owns the canvas
      target.removeFromParent()
      handles.current = []
      handleTarget.current = null
      renderer.invalidate()
    }
  }, [ready, transforming, src])
  const [tx, ty, tz] = transform?.at ?? []
  useEffect(() => {
    if (tx === undefined || ty === undefined || tz === undefined) return
    handleTarget.current?.position.set(tx, ty, tz)
    r.current?.invalidate()
  }, [tx, ty, tz, handlesMade])
  useEffect(() => {
    handles.current.forEach(axisColors)
    r.current?.invalidate()
  }, [theme, handlesMade])

  // the look: lights, background, SSAO
  useEffect(() => {
    const renderer = r.current
    if (!renderer || (!box.current && !placementDrag.current)) return
    scene.current = applyLook(renderer, { ...DEFAULT_LOOK, look })
  }, [look, loaded, overlaid, placementLoaded])

  // camera preset
  useEffect(() => {
    const renderer = r.current
    const b = frameBounds()
    if (!renderer || !b) return
    // framing a hidden canvas gives the ortho camera a NaN frustum; frame it once it's shown
    unframed.current = !holder.current!.clientWidth
    if (unframed.current) return
    const nextView =
      requestedView && requestedView !== appliedView.current ? requestedView.view : view
    appliedView.current = requestedView
    if (nextView === 'orbit') {
      // the free view is a perspective one; the store says so, so the Perspective toggle shows it
      useProjection.setState({ projection: 'perspective' })
      renderer.cameras.frame(b, viewDir(ORBIT), 'perspective')
    } else
      renderer.cameras.frame(b, viewDir(viewAngles(nextView)), useProjection.getState().projection)
    renderer.scene.fog = null
  }, [view, viewRequest, requestedView, loaded, shown, placementLoaded])

  // a projection switch keeps the direction the camera looks from
  const reproject = (next: Projection): void => {
    const renderer = r.current
    const b = frameBounds()
    if (!renderer || unframed.current || !b) return
    const cm = renderer.cameras
    if (cm.projection === next) return
    const dir = cm.active.getWorldDirection(new THREE.Vector3()).negate()
    cm.frame(b, dir, next)
  }
  useEffect(() => reproject(projection), [projection, loaded, placementLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const renderer = r.current
    if (!renderer || !ready || !showGizmo) return
    const cm = renderer.cameras
    let frame: number | null = null
    const update = (): void => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        const next = cm.active.getWorldQuaternion(new THREE.Quaternion()).toArray()
        setOrientation((old) => (old.every((n, i) => Math.abs(n - next[i]) < 0.00001) ? old : next))
      })
    }
    cm.addEventListener('change', update)
    refreshGizmo.current = update
    update()
    return () => {
      refreshGizmo.current = () => {}
      if (frame !== null) cancelAnimationFrame(frame)
      cm.removeEventListener('change', update)
    }
  }, [ready, showGizmo])

  // the floor grid's step: lines stay 8px apart on screen as the view zooms (DESIGN › Floor grid)
  const [step, setStep] = useState(1)
  useEffect(() => {
    const cm = r.current?.cameras
    if (!ready || !cm) return
    const update = (): void => {
      const cam = cm.active
      const h = holder.current?.clientHeight
      if (!h) return
      const span =
        cam instanceof THREE.OrthographicCamera
          ? (cam.top - cam.bottom) / cam.zoom
          : 2 * cam.position.distanceTo(cm.target) * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
      setStep(gridStep(h / span))
    }
    update()
    cm.addEventListener('change', update)
    return () => cm.removeEventListener('change', update)
  }, [ready])

  // the floor grid and the ground axes
  useEffect(() => {
    const renderer = r.current
    const obj = main()
    if (!renderer || !obj || !loaded || !box.current) return
    const origin: Cell = [-ox, -oy, -oz]
    const axes = groundAxes(box.current, origin, 8 * step)
    const floor = new THREE.Group().add(gridUnder(box.current, origin, step), axes)
    obj.group.add(floor)
    renderer.invalidate()
    return () => {
      obj.group.remove(floor)
      floor.traverse((o) => {
        if (!(o instanceof THREE.Line || o instanceof THREE.Sprite)) return
        o.geometry.dispose()
        const m = o.material as THREE.Material & { map?: THREE.Texture | null }
        m.map?.dispose()
        m.dispose()
      })
    }
  }, [loaded, theme, ox, oy, oz, step])

  // Y-clip: a clipping plane on every material, so no remesh
  useEffect(() => {
    const renderer = r.current
    if (!renderer || !main() || !loaded) return
    // cells are centred on integer coordinates: cell y spans [y - 0.5, y + 0.5]; the plane sits a hair above
    // the top faces it keeps, or depth precision clips them in streaks
    const planes =
      clipY !== null ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY + 0.501)] : []
    for (const s of renderer.getAllSchematics()) s.clippingPlanes = planes
    renderer.invalidate()
  }, [clipY, loaded, overlaid])

  // overlays: extra schematics in the build's coordinates, so their cells line up with its cells
  const overlayKey = overlays.map((o) => o.src).join('\n')
  useEffect(() => {
    const renderer = r.current
    if (!renderer || !main() || !loaded) return
    let stale = false
    const run = loadSequence.current + '-' + Math.random().toString(36).slice(2)
    const next = new Map<string, string>()
    const created: string[] = []
    const urls = overlayKey ? overlayKey.split('\n') : []
    const report = overlayLatest.current.onOverlayProgress
    const notify = (progress: BridgeProgress | null): void => report?.(overlayKey, progress)
    if (urls.length) notify({ stage: 'loading', fraction: null })
    ;(async () => {
      for (const [i, url] of urls.entries()) {
        const existing = overlayFiles.current.get(url)
        if (existing && renderer.getSchematic(existing)) {
          next.set(url, existing)
          continue
        }
        const response = await fetch(url)
        if (!response.ok) throw new Error(`parts: ${response.status}`)
        const buf = await response.arrayBuffer()
        if (stale) return
        const id = `overlay-${run}-${i}`
        created.push(id)
        const o = await renderer.loadSchematic(id, buf, {
          stale: () => stale,
          onProgress: (fraction) => {
            if (!stale) notify({ stage: 'meshing', fraction })
          }
        })
        if (!o || stale) return
        o.visible = false
        next.set(url, id)
      }
      if (stale) return
      renderer.setSelection([], 0)
      for (const [url, id] of overlayFiles.current) if (!next.has(url)) renderer.removeSchematic(id)
      overlayFiles.current = next
      overlayIds.current = [...next.values()]
      committedOverlayKey.current = overlayKey
      setStatus('')
      setOverlaid((n) => n + 1)
      notify(null)
    })().catch((e) => {
      for (const id of created) renderer.removeSchematic(id)
      if (!stale) {
        notify(null)
        setStatus(`overlay failed: ${e}`)
      }
    })
    return () => {
      stale = true
      notify(null)
      for (const id of created)
        if (![...overlayFiles.current.values()].includes(id)) renderer.removeSchematic(id)
    }
  }, [overlayKey, loaded])
  const visibleKey = JSON.stringify(
    overlays.map(({ visible, selection, maskOnly }) => [visible, selection, maskOnly])
  )
  useEffect(() => {
    const renderer = r.current
    if (!renderer || committedOverlayKey.current !== overlayKey) return
    const selected: string[] = []
    for (const file of overlayLatest.current.overlays) {
      const id = overlayFiles.current.get(file.src)
      const o = id && renderer.getSchematic(id)
      if (!o) continue
      o.visible = file.visible
      o.maskOnly = !!file.maskOnly
      if (file.selection && file.visible) selected.push(id)
    }
    const planes =
      clipY !== null ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY + 0.501)] : []
    renderer.setSelection(selected, cssColor('--accent-solid'), planes)
    const obj = main()
    if (obj) obj.visible = !overlayLatest.current.hideBuild
    renderer.invalidate()
  }, [visibleKey, overlaid, overlayKey, hideBuild, loaded, clipY, look, theme])

  // markers (lint cells): small coloured cubes in the schematic group
  // keyed by content: callers rebuild the array every render, and each rebuild makes new GPU objects
  const markerKey = JSON.stringify(markers)
  useEffect(() => {
    const renderer = r.current
    const obj = main()
    const list = JSON.parse(markerKey) as Marker[]
    if (!renderer || !obj || !loaded || !list.length) return
    const group = new THREE.Group()
    group.name = MARKERS
    const geo = new THREE.BoxGeometry(1.08, 1.08, 1.08)
    const edges = new THREE.EdgesGeometry(geo)
    const mats = new Map<string, THREE.Material>()
    const lines = new Map<string, THREE.Material>()
    for (const { cell, color, label } of list) {
      if (!mats.has(color))
        mats.set(
          color,
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthTest: false })
        )
      const m = new THREE.Mesh(geo, mats.get(color))
      m.position.set(...cell)
      m.renderOrder = 10
      group.add(m)
      if (!lines.has(color))
        lines.set(color, new THREE.LineBasicMaterial({ color, depthTest: false }))
      const e = new THREE.LineSegments(edges, lines.get(color))
      e.position.set(...cell)
      e.renderOrder = 11
      group.add(e)
      if (label) group.add(labelSprite(label, color, cell))
    }
    obj.group.add(group)
    renderer.invalidate()
    return () => {
      obj.group.remove(group)
      geo.dispose()
      edges.dispose()
      mats.forEach((m) => m.dispose())
      lines.forEach((m) => m.dispose())
      group.traverse((o) => {
        if (o instanceof THREE.Sprite) {
          o.material.map?.dispose()
          o.material.dispose()
        }
      })
      renderer.invalidate()
    }
  }, [markerKey, loaded])

  // fly to a cell: perspective camera 24 blocks out along the current view direction
  useEffect(() => {
    const renderer = r.current
    if (!renderer || !main() || !loaded || !focus) return
    focusCell(renderer, focus.cell)
    useProjection.setState({ projection: 'perspective' }) // the camera flew in perspective
  }, [focus, loaded])

  useEffect(() => {
    if (!inspectCell) inspection.current = null
    else if (inspection.current?.request !== inspectCell)
      inspection.current = { request: inspectCell, src }
  }, [inspectCell, src])

  useEffect(() => {
    const pending = inspection.current
    const renderer = r.current
    const obj = main()
    if (
      !pending ||
      pending.request === inspected.current ||
      pending.src !== src ||
      loadedSource.current !== src ||
      !src ||
      !renderer ||
      !obj ||
      !box.current
    )
      return
    inspected.current = pending.request
    const picked = readBlock(pending.request.cell, box.current, (...cell) => obj.blockAt(...cell))
    if (!picked) return
    const adjacent = [picked.cell[0], picked.cell[1] + 1, picked.cell[2]] as Cell
    latest.current.onPick?.({
      ...picked,
      normal: [0, 1, 0],
      adjacent,
      add: false,
      alt: false,
      button: -1
    })
    focusCell(renderer, picked.cell)
  }, [inspectCell, src, loaded])

  // camera sync: the viewer the user last touched publishes its camera, the others copy it
  // (schematic coordinates are world coordinates: every file's cells sit at their own coordinates)
  useEffect(() => {
    const renderer = r.current
    if (!sync || !renderer || !ready) return
    const el = holder.current!
    const me = syncOwner.current
    const take = (): void => drive(sync, me)
    const cm = renderer.cameras
    const follow = (s: CamState): void => {
      const cam = cm.active
      if (!main() || (cm.projection === 'isometric') !== s.ortho) return
      cam.zoom = s.zoom
      cam.updateProjectionMatrix()
      cm.lookAt(new THREE.Vector3(...s.pos), new THREE.Vector3(...s.target))
      refreshGizmo.current()
    }
    const publish = (): void => {
      if (sync.driver !== me || !main()) return
      const cam = cm.active
      const s = {
        ortho: cm.projection === 'isometric',
        pos: cam.position.toArray(),
        target: cm.target.toArray(),
        zoom: cam.zoom
      }
      sync.followers.forEach((f) => f !== follow && f(s))
    }
    el.addEventListener('pointerdown', take)
    el.addEventListener('wheel', take, { passive: true })
    sync.followers.add(follow)
    cm.addEventListener('change', publish)
    return () => {
      el.removeEventListener('pointerdown', take)
      el.removeEventListener('wheel', take)
      sync.followers.delete(follow)
      cm.removeEventListener('change', publish)
      if (sync.driver === me) sync.driver = null
    }
  }, [sync, ready])

  // pick: a click (not a drag) raycasts the schematic meshes; half a block against the face normal, rounded.
  // Hover does the same while the pointer moves with no button held, once a frame.
  useEffect(() => {
    const el = holder.current! // clicks bubble up from the canvas the renderer effect creates
    let down: { x: number; y: number } | null = null
    let frame: number | null = null
    const hitAt = (e: PointerEvent): ViewerHit | null => {
      const renderer = r.current
      const obj = main()
      if (!renderer || !obj) return null
      const rect = canvasEl.current!.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      const ray = new THREE.Raycaster()
      ray.setFromCamera(ndc, renderer.cameras.active)
      // the build and the overlays share one coordinate space, so a hit on either is a cell of the build
      const meshes: THREE.Object3D[] = []
      for (const s of [obj, ...overlayIds.current.map((id) => renderer.getSchematic(id))])
        if (s?.visible)
          s.group.traverse(
            (o) =>
              (o as THREE.Mesh).isMesh && o.visible && o.parent?.name !== MARKERS && meshes.push(o)
          )
      const clip = latest.current.clipY
      const hit = ray
        .intersectObjects(meshes, false)
        .find((h) => clip === null || h.point.y <= clip + 0.5 + 1e-3)
      if (!hit?.face) return null
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      const p = hit.point.clone().addScaledVector(n, -0.5)
      const cell = [Math.round(p.x), Math.round(p.y), Math.round(p.z)] as Cell
      // the face's axis: block models have slanted faces too (stairs, rails), so take the largest component
      const axis = [n.x, n.y, n.z].map(Math.abs).reduce((a, v, i, all) => (v > all[a] ? i : a), 0)
      const normal = [0, 0, 0] as Cell
      normal[axis] = Math.sign([n.x, n.y, n.z][axis])
      const adjacent = cell.map((c, i) => c + normal[i]) as Cell
      return { cell, normal, adjacent, state: obj.blockAt(...cell) ?? undefined }
    }
    // a drawing drag: the pointer that started it on the build; orbit waits until it ends
    let stroke: number | null = null
    // the newest move not drawn yet: a slow frame draws from the last point to it in one go
    let moved: PointerEvent | null = null
    const strokeMove = (): void => {
      frame = null
      const e = moved
      moved = null
      const hit = e && hitAt(e)
      if (hit) latest.current.onStroke?.('move', hit, e.shiftKey)
    }
    const endStroke = (phase: 'end' | 'cancel'): void => {
      if (stroke === null) return
      if (el.hasPointerCapture(stroke)) el.releasePointerCapture(stroke)
      stroke = null
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
      if (phase === 'end') strokeMove()
      moved = null
      if (r.current) r.current.cameras.controls.enabled = true
      latest.current.onStroke?.(phase, null, false)
    }
    // capture phase: the orbit controls on the canvas must see `enabled = false` before they take the drag
    const onDown = (e: PointerEvent): void => {
      down = { x: e.clientX, y: e.clientY }
      if (e.button !== 0 || e.altKey || stroke !== null || !latest.current.onStroke) return
      const hit = hitAt(e)
      if (!hit || !r.current) return // empty space: orbit
      stroke = e.pointerId
      r.current.cameras.controls.enabled = false
      el.setPointerCapture(e.pointerId)
      latest.current.onStroke('start', hit, e.shiftKey)
    }
    const onUp = (e: PointerEvent): void => {
      if (stroke === e.pointerId) return endStroke('end')
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return
      const hit = hitAt(e)
      if (hit) latest.current.onPick?.({ ...hit, add: e.shiftKey, alt: e.altKey, button: e.button })
    }
    const onMove = (e: PointerEvent): void => {
      if (stroke !== null) {
        if (e.pointerId !== stroke) return
        moved = e
        frame ??= requestAnimationFrame(strokeMove)
        return
      }
      if (!latest.current.onHover || frame !== null) return
      if (e.buttons) return void latest.current.onHover(null) // orbiting
      frame = requestAnimationFrame(() => {
        frame = null
        latest.current.onHover?.(hitAt(e))
      })
    }
    const onLeave = (): void => latest.current.onHover?.(null)
    const onCancel = (): void => endStroke('cancel')
    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('pointercancel', onCancel)
    return () => {
      endStroke('cancel')
      if (frame !== null) cancelAnimationFrame(frame)
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  // hand edits: set the layer's cells over the file; each apply works from the latest layer
  useEffect(() => {
    const obj = main()
    if (!obj || !loaded || !edits) return
    editing.current = editing.current.then(async () => {
      const layer = latest.current.edits
      if (main() !== obj || !layer) return
      const cells = layerCells(layer, originals.current, (c) => obj.blockAt(...c) ?? AIR)
      if (!cells.length) return
      await obj.apply(cells)
      if (main() !== obj) return
      box.current = obj.box
      r.current?.invalidate()
    })
  }, [edits, loaded])

  // the editor's boxes, outside the build's group so picking and the look's bounds skip them
  useEffect(() => {
    const renderer = r.current
    if (!renderer || !editBoxes?.length) return
    const group = new THREE.Group()
    for (const { min, max, tone } of editBoxes) {
      const color = cssColor(BOX_TONES[tone])
      const size = max.map((m, i) => m - min[i] + 1.02) // a hair outside the cells, against z-fighting
      const cube = new THREE.BoxGeometry(...(size as Cell))
      const at = min.map((m, i) => (m + max[i]) / 2) as Cell
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(cube),
        new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true })
      )
      edges.renderOrder = 20
      edges.position.set(...at)
      group.add(edges)
      if (tone === 'place' || tone === 'erase') {
        const fill = new THREE.Mesh(
          cube,
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.25,
            depthWrite: false
          })
        )
        fill.renderOrder = 19
        fill.position.set(...at)
        group.add(fill)
      } else cube.dispose()
    }
    renderer.scene.add(group)
    renderer.invalidate()
    return () => {
      group.removeFromParent()
      group.traverse((o) => {
        if (!(o instanceof THREE.Mesh || o instanceof THREE.LineSegments)) return
        o.geometry.dispose()
        ;(o.material as THREE.Material).dispose()
      })
      renderer.invalidate()
    }
  }, [editBoxes, theme])

  // the cells a tool is about to change: one instanced cube each, drawn through the build
  useEffect(() => {
    const renderer = r.current
    if (!renderer || !ghost?.length) return
    const geo = new THREE.BoxGeometry(1.04, 1.04, 1.04)
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.45,
      depthTest: false,
      depthWrite: false
    })
    const mesh = new THREE.InstancedMesh(geo, mat, ghost.length)
    const [accent, danger] = [cssColor('--accent-solid'), cssColor('--danger-solid')]
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    ghost.forEach((g, i) => {
      mesh.setMatrixAt(i, m.makeTranslation(...g.cell))
      mesh.setColorAt(i, c.set(g.erase ? danger : (g.color ?? accent)))
    })
    mesh.renderOrder = 18
    renderer.scene.add(mesh)
    renderer.invalidate()
    return () => {
      mesh.removeFromParent()
      mesh.dispose()
      geo.dispose()
      mat.dispose()
      renderer.invalidate()
    }
  }, [ghost, theme])

  // the Ruler (DESIGN › Ruler legs): X, Z and Y legs in their axis colours, then a dashed straight line
  const measureKey = measure ? JSON.stringify(measure) : null
  useEffect(() => {
    const renderer = r.current
    if (!renderer || !measureKey) return
    const m = JSON.parse(measureKey) as Measure
    const group = new THREE.Group()
    const line = (a: Cell, b: Cell, mat: THREE.LineBasicMaterial): THREE.Line => {
      const l = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(...a),
          new THREE.Vector3(...b)
        ]),
        mat
      )
      l.renderOrder = 19
      group.add(l)
      return l
    }
    const mid = (a: Cell, b: Cell): Cell => a.map((v, i) => (v + b[i]) / 2) as Cell
    // labelSprite lifts its badge 1.5 blocks above the cell it is given; these sit on their line
    const badge = (text: string, color: string, at: Cell, ink: string): void =>
      void group.add(labelSprite(text, color, [at[0], at[1] - 1.5, at[2]], ink))
    const ink = cssColor('--fg-inverse')
    for (const leg of legs(m)) {
      const color = cssColor(`--axis-${leg.axis}`)
      line(leg.from, leg.to, new THREE.LineBasicMaterial({ color, depthTest: false }))
      badge(String(leg.blocks), color, mid(leg.from, leg.to), ink)
    }
    if (legs(m).length > 1) {
      const dashed = new THREE.LineDashedMaterial({
        color: cssColor('--fg-secondary'),
        dashSize: 0.4,
        gapSize: 0.3,
        depthTest: false
      })
      line(m.from, m.to, dashed).computeLineDistances()
      badge(distanceOf(m).toFixed(1), cssColor('--fg'), mid(m.from, m.to), ink)
    }
    const dot = new THREE.BoxGeometry(0.3, 0.3, 0.3)
    const dotMat = new THREE.MeshBasicMaterial({ color: cssColor('--fg'), depthTest: false })
    for (const c of [m.from, m.to]) {
      const p = new THREE.Mesh(dot, dotMat)
      p.position.set(...c)
      p.renderOrder = 20
      group.add(p)
    }
    renderer.scene.add(group)
    renderer.invalidate()
    return () => {
      group.removeFromParent()
      group.traverse((o) => {
        if (o instanceof THREE.Sprite) {
          o.material.map?.dispose()
          o.material.dispose()
        } else if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose()
          ;(o.material as THREE.Material).dispose()
        }
      })
      renderer.invalidate()
    }
  }, [measureKey, theme])

  useEffect(() => {
    if (!onFps) return
    const id = setInterval(() => {
      const renderer = r.current
      if (renderer && !renderer.suspended) latest.current.onFps?.(renderer.fps)
    }, 1000)
    return () => clearInterval(id)
  }, [onFps])

  const gizmo =
    onViewChange && ready && (loaded > 0 || placementLoaded > 0) && !progress ? (
      <>
        <AxisGizmo
          orientation={orientation}
          onAnnounce={(text) => setSaid({ text, at: performance.now() })}
          onViewChange={(next) => {
            if (sync) drive(sync, syncOwner.current)
            setRequestedView({ view: next })
            onViewChange(next)
          }}
          onOrbit={(yaw, pitch) => {
            if (sync) drive(sync, syncOwner.current)
            r.current?.cameras.orbitBy(yaw, pitch)
          }}
        />
        <ViewerStatusToast message={said.text} at={said.at} />
      </>
    ) : null
  return (
    <ViewerStage aria-busy={!ready || !!progress || (!!placementSrc && placementLoading)}>
      <div ref={holder} className="h-full w-full" role="img" aria-label="3D build preview" />
      {gizmo &&
        (gizmoTarget === undefined ? gizmo : gizmoTarget && createPortal(gizmo, gizmoTarget))}
      {(!ready || progress) && (
        <ViewerLoadingCard
          label={!ready ? 'Loading texture pack…' : progress!.label}
          value={ready ? progress?.frac : undefined}
        />
      )}
      {ready && !progress && placementSrc && placementLoading && (
        <ViewerLoadingCard label="Preparing placement preview…" />
      )}
      {(status || (placementSrc && placementError)) && (
        <ViewerErrorCard
          title="The preview couldn’t be completed"
          details={status || placementError}
        />
      )}
    </ViewerStage>
  )
}

/** A number badge 1.5 blocks above a cell, a constant size on screen. */
function labelSprite(
  text: string,
  color: string,
  cell: Cell,
  textColor = cssColor('--pin-open-text')
): THREE.Sprite {
  const c = document.createElement('canvas')
  const font = 'bold 34px "JetBrains Mono Variable", monospace'
  let g = c.getContext('2d')!
  g.font = font
  // a circle for one or two characters, a pill for more (the Ruler's distance)
  c.width = Math.max(64, Math.ceil(g.measureText(text).width) + 28)
  c.height = 64
  g = c.getContext('2d')!
  g.fillStyle = color
  g.beginPath()
  g.roundRect(2, 2, c.width - 4, 60, 30)
  g.fill()
  g.fillStyle = textColor
  g.font = font
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, c.width / 2, 34)
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map, depthTest: false, sizeAttenuation: false, toneMapped: false })
  )
  sprite.position.set(cell[0], cell[1] + 1.5, cell[2])
  // sizeAttenuation only holds the size for perspective cameras; an ortho one needs its view height
  sprite.onBeforeRender = (_r, _s, cam) => {
    const o = cam as THREE.OrthographicCamera
    const k = o.isOrthographicCamera ? ((o.top - o.bottom) / o.zoom) * 0.05 : 0.05
    if (sprite.scale.y !== k) {
      sprite.scale.set((k * c.width) / 64, k, 1)
      sprite.updateMatrixWorld()
    }
  }
  sprite.renderOrder = 12
  return sprite
}
