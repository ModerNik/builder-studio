// The Edit tab and the tool rail: the tool, the block to place, the selection, what clicks and hovers in the
// 3D view do, undo and redo, and saving the hand edits to builds/<b>/data/edits.json.
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { studio } from '@/shared/api/studio'
import { useShortcuts } from '@/shared/lib/shortcuts'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { keyCell } from '@/entities/viewer/model/edits'
import { distanceOf, spanOf, type Measure } from '@/entities/viewer/model/ruler'
import type {
  BlockReader,
  Cell,
  EditBox,
  GhostCell,
  StrokePhase,
  ViewerHit,
  ViewerPick
} from '@/entities/viewer/ui/BuildViewer'
import { useBlockRegistry } from '@/entities/block/model/blocks'
import { useBlockIcons } from '@/entities/block/model/icons'
import { recentIds, useBlockPicks } from '@/entities/block/model/recent'
import { fullState, parseState, type BlockInfo } from '@/entities/block/model/registry'
import { blockColor, useBlockColor, useBlockColors } from '@/entities/build/model/blocks'
import { MAX_CELLS, readOf, type Block, type ToolId } from '@/entities/block-edit/model/edit'
import { along, every } from '@/entities/block-edit/model/geometry'
import {
  decodeLayer,
  encodeLayer,
  viewLayer,
  type History
} from '@/entities/block-edit/model/history'
import { useEdits, type SaveState } from '@/entities/block-edit/model/store'
import { fillAt } from '@/features/block-tools/fill/model/fill'
import {
  STILL,
  flipped,
  landing,
  moved,
  pivotOf,
  sizeOf,
  transformEdit,
  transformSummary,
  transformed,
  type Moves,
  type TransformState
} from '@/features/block-tools/transform/model/transform'
import { STROKES, anchorOf, drawAt, stepOf } from './draw'
import { DEFAULT_OPTIONS, SIZED, resize, summary, type ToolOptions } from './options'
import { TOOLS, toolOf } from './tools'

const SAVE_MS = 500
const AIR = /^minecraft:(?:cave_|void_)?air$/
const HOVERED = new Set<ToolId>(['place', 'erase', 'pick', 'fill', 'ruler', ...STROKES])
const ZERO = [0, 0, 0] as const
const sized = (t: ToolId): t is (typeof SIZED)[number] => (SIZED as readonly ToolId[]).includes(t)

export interface Selection {
  anchor: Cell
  min: Cell
  max: Cell
  state?: string // the first block clicked, as it was then
}
export interface PlaceBlock {
  info: BlockInfo
  props: Record<string, string>
}

const key = (c: readonly number[]): string => c.join(',')
// outside the hook: React Compiler can't compile optional chains inside a logical test
const sameHit = (a: ViewerHit | null, b: ViewerHit | null): boolean =>
  a === b ||
  (!!a && !!b && a.cell.join() === b.cell.join() && a.adjacent.join() === b.adjacent.join())
export const blockName = (state: string): string => parseState(state).id.replace(/^minecraft:/, '')
const boxOf = (a: Cell, b: Cell): { min: Cell; max: Cell } => ({
  min: a.map((v, i) => Math.min(v, b[i])) as Cell,
  max: a.map((v, i) => Math.max(v, b[i])) as Cell
})
const volume = (s: Selection): number => s.max.reduce((n, v, i) => n * (v - s.min[i] + 1), 1)

export interface BlockEditor {
  /** Why editing is off, or null when it is on. */
  blocked: null | 'no-version' | 'older' | 'loading' | 'no-tools' | 'unreadable'
  tool: ToolId
  setTool: (tool: ToolId) => void
  blocks: BlockInfo[]
  place: PlaceBlock | null
  setPlace: (block: PlaceBlock) => void
  selection: Selection | null
  history: History
  undo: () => void
  redo: () => void
  jumpTo: (cursor: number) => void
  discard: () => void
  save: SaveState
  icon: (state: string) => string | undefined
  color: (id: string) => string | null
  recent: string[]
  favourites: string[]
  toggleFavourite: (id: string) => void
  /** The Ruler's two cells in build coordinates, the second following the pointer until it is clicked. */
  ruler: Measure | null
  clearRuler: () => void
  options: ToolOptions
  setOptions: <T extends keyof ToolOptions>(tool: T, patch: Partial<ToolOptions[T]>) => void
  transform: TransformState
  /** The viewer's tool HUD (DESIGN › Tool HUD), or null when it has nothing to say. */
  hud: { label: string; summary: string; keys: { keys: string[]; label: string }[] } | null
  /** BuildViewer props. */
  view: {
    edits?: Map<string, string | null>
    onPick: (p: ViewerPick) => void
    onHover?: (p: ViewerHit | null) => void
    editBoxes: EditBox[]
    onStroke?: (phase: StrokePhase, hit: ViewerHit | null, shift: boolean) => void
    ghost?: GhostCell[]
    measure?: Measure | null
    transform?: {
      at: Cell
      turns: number
      onMove: (at: Cell) => void
      onTurn: (turns: number) => void
    } | null
    onReader: (reader: BlockReader | null) => void
  }
}

export function useBlockEditor({
  build,
  source,
  active,
  origin = ZERO,
  hasVersion,
  newest,
  minecraftVersion,
  pack,
  onSelect,
  selectParts = false
}: {
  build: string
  /** The shown file: the selection is cleared when it changes. */
  source: string | null | undefined
  /** The 3D view is showing: its keys are on. */
  active: boolean
  /** Where the shown file's (0, 0, 0) sits in build coordinates. */
  origin?: readonly number[]
  hasVersion: boolean
  /** The shown version is the newest: hand edits draw over it and can be made. */
  newest: boolean
  minecraftVersion: string
  pack: string | null | undefined
  /** A click the Select tool passes on (inspecting a block, picking parts). */
  onSelect?: (p: ViewerPick) => void
  /** Coloured by parts: Select clicks only pick parts and leave no block or box selected. */
  selectParts?: boolean
}): BlockEditor {
  const registry = useBlockRegistry(minecraftVersion)
  const icon = useBlockIcons(pack)
  const color = useBlockColor()
  const colors = useBlockColors().data
  const picks = useBlockPicks()
  const history = useEdits((s) => s.history)
  const save = useEdits((s) => s.save)
  const loaded = useEdits((s) => s.build === build)
  const changed = useEdits((s) => s.changed)
  const [unreadable, setUnreadable] = useState<string | null>(null) // the build whose file failed
  const [tool, setTool] = useState<ToolId>('select')
  const [place, setPlace] = useState<PlaceBlock | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [hover, setHover] = useState<ViewerHit | null>(null)
  const [options, setAllOptions] = useState<ToolOptions>(DEFAULT_OPTIONS)
  const [reader, setReader] = useState<BlockReader | null>(null)
  // the Ruler's clicks, in file cells: its second end follows the pointer until it is set
  const [ends, setEnds] = useState<{ from: Cell; to: Cell | null } | null>(null)
  // the drag being drawn: handlers keep it here, and `pending` mirrors its cells for the ghost
  const stroke = useRef<{
    tool: ToolId
    at: Cell
    from: Cell
    /** The options it started with: Shift turns Terrain's Raise into Lower and back. */
    opts: ToolOptions
    pending: Map<string, string | null>
    full: boolean
  } | null>(null)
  const [pending, setPending] = useState<ReadonlyMap<string, string | null> | null>(null)
  const [selectedIn, setSelectedIn] = useState(source)
  if (selectedIn !== source) {
    setSelectedIn(source)
    setSelection(null)
    setHover(null)
    setEnds(null)
  }
  if (selectParts && selection) setSelection(null)
  // Transform's moves, turns and flips, waiting for Apply; a new selection starts them afresh
  const [moves, setMoves] = useState<Moves>(STILL)
  const [movesFor, setMovesFor] = useState(selection)
  if (movesFor !== selection) {
    setMovesFor(selection)
    setMoves(STILL)
  }
  const blocks = useMemo(() => registry.data ?? [], [registry.data])
  const byId = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks])

  // load the build's hand edits once a session; a file that cannot be read is never overwritten
  useEffect(() => {
    if (useEdits.getState().build === build) return
    let live = true
    studio.edits.read(build).then(
      (file) => live && useEdits.getState().load(build, decodeLayer(file)),
      (e) => {
        if (!live) return
        setUnreadable(build)
        toast.error('Hand edits could not be read', { description: errorMessage(e) })
      }
    )
    return () => {
      live = false
    }
  }, [build])

  // save half a second after the last change, and at once when the Workspace closes
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const saveNow = useRef<(() => void) | null>(null)
  useEffect(() => {
    const { build: b, history: h, setSave } = useEdits.getState()
    if (!changed || !b) return
    clearTimeout(timer.current)
    saveNow.current = () => {
      clearTimeout(timer.current)
      saveNow.current = null
      setSave('saving')
      studio.edits.save(b, encodeLayer(h.layer)).then(
        () => useEdits.getState().build === b && setSave('saved'),
        (e) => {
          if (useEdits.getState().build === b) setSave('failed')
          toast.error('Hand edits were not saved', { description: errorMessage(e) })
        }
      )
    }
    timer.current = setTimeout(() => saveNow.current?.(), SAVE_MS)
  }, [changed])
  useEffect(() => () => saveNow.current?.(), [])

  const blocked: BlockEditor['blocked'] = !hasVersion
    ? 'no-version'
    : !newest
      ? 'older'
      : unreadable === build
        ? 'unreadable'
        : registry.isLoading || !loaded
          ? 'loading'
          : !registry.data
            ? 'no-tools'
            : null
  const editable = blocked === null
  const toBuild = (c: Cell): string => key(c.map((v, i) => v + origin[i]))
  const commit = (label: string, t: ToolId, cells: [Cell, string | null | undefined][]): void =>
    useEdits.getState().commit(
      label,
      t,
      cells.map(([c, s]) => [toBuild(c), s])
    )

  const infoOf = (state: string): PlaceBlock | null => {
    const { id, props } = parseState(state)
    const info = byId.get(id)
    return info ? { info, props } : null
  }
  // Select's HUD line: where the selection is, and the one block as it is now (hand edits included)
  const selected = ((): string => {
    if (!selection) return 'Click a block; Shift-click another for a box'
    const { min, max } = selection
    if (volume(selection) > 1)
      return `${min.join(' ')} – ${max.join(' ')} · ${sizeOf(selection).join('×')} · ${volume(selection).toLocaleString()} blocks`
    const entry = editable ? history.layer.get(toBuild(min)) : undefined
    const state = entry === undefined ? selection.state : entry
    return `${min.join(' ')} · ${state ? state.replace(/^minecraft:/, '') : 'air'}`
  })()

  const undo = (): void => useEdits.getState().moveTo(useEdits.getState().history.cursor - 1)
  const redo = (): void => useEdits.getState().moveTo(useEdits.getState().history.cursor + 1)
  const eraseSelection = (): void => {
    if (!selection) return
    const n = volume(selection)
    if (n > MAX_CELLS) {
      toast.error(`The selection is too big to erase (${n} blocks)`, {
        description: `Erase up to ${MAX_CELLS} blocks at a time.`
      })
      return
    }
    const cells: [Cell, null][] = []
    const { min, max } = selection
    for (let y = min[1]; y <= max[1]; y++)
      for (let z = min[2]; z <= max[2]; z++)
        for (let x = min[0]; x <= max[0]; x++) cells.push([[x, y, z], null])
    commit(
      n === 1 && selection.state ? `Erase ${blockName(selection.state)}` : `Erase ${n} blocks`,
      'select',
      cells
    )
  }

  // the block to place, and how it replaces another (Paint, Fill)
  const block = useMemo(
    (): Block | null =>
      place && {
        state: fullState(place.info, place.props),
        // the old block's states win where the new block has them (fullState drops the rest)
        swap: (from) => fullState(place.info, { ...place.props, ...parseState(from).props })
      },
    [place]
  )
  const onPick = (p: ViewerPick): void => {
    if (p.button === -1) return onSelect?.(p) // inspectCell, not a click
    if (p.button !== 0) return
    if (editable && (p.alt || tool === 'pick')) {
      const picked = p.state && !AIR.test(p.state) ? infoOf(p.state) : null
      if (picked) setPlace(picked)
      if (tool === 'pick') setTool('place')
      return
    }
    if (!editable || tool === 'select') {
      onSelect?.(p)
      if (selectParts) return
      setSelection((s) =>
        p.add && s
          ? { ...s, ...boxOf(s.anchor, p.cell) }
          : { anchor: p.cell, min: p.cell, max: p.cell, state: p.state }
      )
      return
    }
    if (tool === 'place' && place) {
      const state = fullState(place.info, place.props)
      commit(`Place ${blockName(state)}`, 'place', [[p.adjacent, state]])
      picks.use(place.info.id)
    }
    if (tool === 'erase' && p.state && !AIR.test(p.state))
      commit(`Erase ${blockName(p.state)}`, 'erase', [[p.cell, null]])
    if (tool === 'fill') fill(p)
    if (tool === 'ruler')
      setEnds((m) => (m && !m.to ? { ...m, to: p.cell } : { from: p.cell, to: null }))
  }
  const fill = (p: ViewerPick): void => {
    const o = options.fill
    // without a selection, Selection means the build; Layer is the clicked height inside that box
    const area = o.limit === 'build' || !selection ? reader?.box() : selection
    if (!area || !block || !place) return
    const at = o.mode === 'air' ? p.adjacent : p.cell
    const limit =
      o.limit === 'layer'
        ? {
            min: [area.min[0], at[1], area.min[2]] as Cell,
            max: [area.max[0], at[1], area.max[2]] as Cell
          }
        : area
    const read = readOf(history.layer, reader, origin)
    const cells = fillAt(o, at, read, block, limit, MAX_CELLS)
    if (!cells) {
      toast.error('The fill is too big', {
        description: `Fill changes up to ${MAX_CELLS.toLocaleString()} blocks at a time. Select a smaller box or use Layer.`
      })
      return
    }
    if (!cells.length) return
    const from = read(at)
    commit(
      o.mode === 'replace' && from
        ? `Replace ${blockName(from)} with ${blockName(block.state)}`
        : `Fill ${blockName(block.state)}`,
      'fill',
      cells
    )
    picks.use(place.info.id)
  }
  const onHover = (p: ViewerHit | null): void => setHover((h) => (sameHit(h, p) ? h : p))

  // Transform (DESIGN › Tool options): the selected box moved, turned and flipped, one History entry on Apply
  const transforming = editable && tool === 'transform'
  const tbox = transforming && selection && volume(selection) <= MAX_CELLS ? selection : null
  const copy = options.transform.mode === 'copy'
  const tblocks = useMemo(
    () => (tbox ? transformed(tbox, STILL, readOf(history.layer, reader, origin)).length : null),
    [tbox, history.layer, reader, origin]
  )
  const tchanges = useMemo(
    () =>
      tbox && moved(moves)
        ? transformEdit(tbox, moves, readOf(history.layer, reader, origin), copy)
        : null,
    [tbox, moves, history.layer, reader, origin, copy]
  )
  const applyTransform = (): void => {
    if (!tbox || !tchanges) return
    const n = tchanges.filter(([, s]) => s !== null).length
    if (n)
      commit(`${copy ? 'Copy' : 'Move'} ${n} block${n === 1 ? '' : 's'}`, 'transform', tchanges)
    // the selection follows the blocks, ready for the next move
    const to = landing(tbox, moves)
    setSelection({ anchor: to.min, ...to })
  }
  const transform: TransformState = {
    size: transforming && selection ? sizeOf(selection) : null,
    blocks: tblocks,
    moves,
    onTurn: (by) => setMoves((m) => ({ ...m, turns: m.turns + by })),
    onFlip: (axis) => setMoves((m) => flipped(m, axis)),
    onCancel: () => setMoves(STILL),
    onApply: applyTransform
  }

  // drawing (DESIGN › Drawing on the view): a drag is one History entry, made on release
  const placeState = block?.state ?? null
  const strokeLabel = (t: ToolId, o: ToolOptions): string => {
    if (t === 'brush' && o.brush.mode === 'erase') return 'Brush erase'
    if (t === 'terrain') return `Terrain ${o.terrain.mode}`
    const k = o.shape.kind
    const name = t === 'shape' ? k[0].toUpperCase() + k.slice(1) : toolOf(t).label
    return `${name} ${placeState ? blockName(placeState) : ''}`.trim()
  }
  // each frame draws into a copy of the stroke's cells, so the ghost sees the change
  const drawPoints = (points: Cell[]): void => {
    const s = stroke.current
    if (!s) return
    const cells = new Map(s.pending)
    // Terrain reads the ground as the drag found it, so one drag is one pass however often it crosses a column
    const read = readOf(history.layer, reader, origin, s.tool === 'terrain' ? undefined : cells)
    for (const p of points)
      for (const [c, v] of drawAt(s.tool, s.opts, p, read, block, s.from)) {
        const k = key(c)
        if (!cells.has(k) && cells.size >= MAX_CELLS) s.full = true
        else cells.set(k, v)
      }
    s.pending = cells
    setPending(cells)
  }
  const onStroke = (phase: StrokePhase, hit: ViewerHit | null, shift: boolean): void => {
    const s = stroke.current
    if (phase === 'start') {
      if (!hit || !STROKES.has(tool)) return
      const m = options.terrain.mode
      const opts: ToolOptions =
        shift && (m === 'raise' || m === 'lower')
          ? { ...options, terrain: { ...options.terrain, mode: m === 'raise' ? 'lower' : 'raise' } }
          : options
      const at = anchorOf(tool, opts, hit)
      stroke.current = { tool, at, from: at, opts, pending: new Map(), full: false }
      return drawPoints([at])
    }
    if (!s) return // cancelled with Esc
    if (phase === 'move') {
      if (!hit) return
      const at = anchorOf(s.tool, s.opts, hit)
      if (s.tool === 'shape' && s.opts.shape.kind === 'line') {
        // a line runs from where the drag started to the pointer, drawn afresh each move
        s.pending = new Map()
        s.full = false
        return drawPoints([s.from, ...along(s.from, at, 1)])
      }
      const points =
        s.tool === 'shape'
          ? every(s.at, at, s.opts.shape.spacing)
          : along(s.at, at, stepOf(s.tool, s.opts))
      if (!points.length) return
      s.at = points[points.length - 1]
      return drawPoints(points)
    }
    stroke.current = null
    setPending(null)
    if (phase === 'cancel' || !s.pending.size) return
    commit(
      strokeLabel(s.tool, s.opts),
      s.tool,
      [...s.pending].map(([k, v]) => [keyCell(k), v])
    )
    if (place && [...s.pending.values()].some(Boolean)) picks.use(place.info.id)
    if (s.full)
      toast.warning(`The stroke stopped at ${MAX_CELLS.toLocaleString()} blocks`, {
        description: 'Release and drag again to draw more.'
      })
  }
  const cancelStroke = (): void => {
    stroke.current = null
    setPending(null)
  }
  const stroking = pending !== null

  const hovering = editable && HOVERED.has(tool)
  // what the tool would change: the stroke being drawn, or one application where the pointer is
  const preview = useMemo(() => {
    if (pending) return pending
    if (tchanges) return new Map(tchanges.map(([c, v]) => [key(c), v]))
    if (!hovering || !hover || !STROKES.has(tool)) return null
    const read = readOf(history.layer, reader, origin)
    const at = anchorOf(tool, options, hover)
    const cells = drawAt(tool, options, at, read, block).slice(0, MAX_CELLS)
    return new Map(cells.map(([c, v]) => [key(c), v]))
  }, [pending, tchanges, hovering, hover, tool, options, history.layer, reader, origin, block])
  const ghost = useMemo(() => {
    if (!preview?.size) return undefined
    const tint = new Map<string, string | undefined>()
    return [...preview].map(([k, s]): GhostCell => {
      if (s === null) return { cell: keyCell(k), erase: true }
      if (!tint.has(s)) tint.set(s, blockColor(colors, s) ?? undefined)
      return { cell: keyCell(k), color: tint.get(s) }
    })
  }, [preview, colors])
  const editBoxes = useMemo(() => {
    const boxes: EditBox[] = []
    if (selection) boxes.push({ min: selection.min, max: selection.max, tone: 'select' })
    if (tbox && moved(moves)) boxes.push({ ...landing(tbox, moves), tone: 'place' })
    if (hovering && hover && !STROKES.has(tool)) {
      if ((tool === 'place' && place) || (tool === 'fill' && options.fill.mode === 'air'))
        boxes.push({ min: hover.adjacent, max: hover.adjacent, tone: 'place' })
      else if (tool === 'erase') boxes.push({ min: hover.cell, max: hover.cell, tone: 'erase' })
      else boxes.push({ min: hover.cell, max: hover.cell, tone: 'hover' })
    }
    return boxes
  }, [selection, tbox, moves, hovering, hover, tool, place, options.fill.mode])
  const rulerTo = ends?.to ?? (tool === 'ruler' && hover ? hover.cell : null)
  const measure = useMemo(
    () => (ends && rulerTo ? { from: ends.from, to: rulerTo } : null),
    [ends, rulerTo]
  )
  const edits = useMemo(
    () => (newest && loaded ? viewLayer(history.layer, origin) : undefined),
    [newest, loaded, history.layer, origin]
  )

  const keysOn = editable && active
  useShortcuts([
    keysOn && {
      keys: 'Ctrl+Z',
      label: 'Undo hand edit',
      group: 'Editor',
      run: undo,
      inFields: false
    },
    keysOn && {
      keys: 'Ctrl+Y',
      label: 'Redo hand edit',
      group: 'Editor',
      run: redo,
      inFields: false
    },
    keysOn && {
      keys: 'Ctrl+Shift+Z',
      label: 'Redo hand edit',
      group: 'Editor',
      run: redo,
      inFields: false,
      hidden: true
    },
    ...TOOLS.map(
      (t) =>
        keysOn &&
        !!t.keys && {
          keys: t.keys,
          label: `${t.label} tool`,
          group: 'Editor',
          run: () => setTool(t.id)
        }
    ),
    keysOn &&
      tool === 'select' &&
      !!selection && {
        keys: 'Delete',
        label: 'Erase the selection',
        group: 'Editor',
        run: eraseSelection
      },
    keysOn &&
      sized(tool) && {
        keys: '-',
        label: 'Smaller brush',
        group: 'Editor',
        run: () => setAllOptions((o) => resize(o, tool, -1))
      },
    keysOn &&
      sized(tool) && {
        keys: '=',
        label: 'Bigger brush',
        group: 'Editor',
        run: () => setAllOptions((o) => resize(o, tool, 1))
      },
    keysOn &&
      !!tbox && {
        keys: 'Q',
        label: 'Turn the selection anticlockwise',
        group: 'Editor',
        run: () => transform.onTurn(-1)
      },
    keysOn &&
      !!tbox && {
        keys: 'R',
        label: 'Turn the selection clockwise',
        group: 'Editor',
        run: () => transform.onTurn(1)
      },
    keysOn &&
      !!tchanges && {
        keys: 'Enter',
        label: 'Apply the transform',
        group: 'Editor',
        run: (e) => {
          // Enter on a focused button presses that button
          const b = e.target instanceof HTMLElement ? e.target.closest('button, a') : null
          if (b instanceof HTMLElement) return b.click()
          applyTransform()
        }
      },
    keysOn &&
      !!tchanges && {
        keys: 'Escape',
        label: 'Cancel the transform',
        group: 'Editor',
        run: () => setMoves(STILL)
      },
    keysOn &&
      stroking && {
        keys: 'Escape',
        label: 'Cancel the stroke',
        group: 'Editor',
        run: cancelStroke
      }
  ])

  const said = !editable
    ? selection && selected // read-only: clicks still select
    : tool === 'select'
      ? !selectParts && selected // the parts toolbar has its own hint
      : tool === 'ruler'
        ? measure
          ? `${spanOf(measure).join('×')} · ${distanceOf(measure).toFixed(1)}`
          : 'Click two blocks'
        : tool === 'transform'
          ? transformSummary(options.transform.mode, transform.size, moves)
          : summary(tool, options)
  const hud: BlockEditor['hud'] = !said
    ? null
    : !editable
      ? { label: toolOf('select').label, summary: said, keys: [] }
      : {
          label: toolOf(tool).label,
          summary: said,
          keys: [
            ...(tool === 'select' && selection ? [{ keys: ['Del'], label: 'erase' }] : []),
            ...(sized(tool) ? [{ keys: ['-', '='], label: 'size' }] : []),
            ...(tool === 'terrain' && ['raise', 'lower'].includes(options.terrain.mode)
              ? [{ keys: ['Shift'], label: 'invert' }]
              : []),
            ...(tbox ? [{ keys: ['Q', 'R'], label: 'turn' }] : []),
            ...(tchanges
              ? [
                  { keys: ['Enter'], label: 'apply' },
                  { keys: ['Esc'], label: 'cancel' }
                ]
              : []),
            ...(stroking ? [{ keys: ['Esc'], label: 'cancel' }] : [])
          ]
        }

  return {
    blocked,
    tool,
    setTool: (t) => {
      setTool(t)
      setHover(null)
    },
    blocks,
    place,
    setPlace,
    selection,
    history,
    undo,
    redo,
    jumpTo: (cursor) => useEdits.getState().moveTo(cursor),
    discard: () =>
      useEdits.getState().commit(
        'Discard hand edits',
        'erase',
        [...useEdits.getState().history.layer.keys()].map((k) => [k, undefined])
      ),
    save,
    icon,
    color,
    recent: recentIds(picks),
    favourites: picks.favourites,
    toggleFavourite: picks.toggleFavourite,
    ruler: measure && {
      from: measure.from.map((v, i) => v + origin[i]) as Cell,
      to: measure.to.map((v, i) => v + origin[i]) as Cell
    },
    clearRuler: () => setEnds(null),
    options,
    setOptions: (t, patch) => setAllOptions((o) => ({ ...o, [t]: { ...o[t], ...patch } })),
    transform,
    hud,
    view: {
      edits,
      onPick,
      onHover: hovering ? onHover : undefined,
      editBoxes,
      onStroke: editable && STROKES.has(tool) ? onStroke : undefined,
      ghost,
      measure: editable && tool === 'ruler' ? measure : null,
      transform: tbox && {
        at: pivotOf(tbox).map((v, i) => v + moves.offset[i]) as Cell,
        turns: moves.turns,
        onMove: (at) =>
          setMoves((m) => ({ ...m, offset: at.map((v, i) => v - pivotOf(tbox)[i]) as Cell })),
        onTurn: (turns) => setMoves((m) => ({ ...m, turns }))
      },
      onReader: setReader
    }
  }
}
