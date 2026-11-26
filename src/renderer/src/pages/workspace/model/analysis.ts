// The open version's parts, checks and material list from the bridge, and what the 3D view draws for the
// parts selection (Workspace).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from 'react'
import { useQuery } from '@tanstack/react-query'
import { create } from 'zustand'
import { DEFAULT_LINTER_SETTINGS, type BridgeMethods, type LinterSettings } from '@shared/api'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import type { Cell, Marker, ViewerOverlayFile } from '@/entities/viewer/ui/BuildViewer'
import { partsCall } from '@/entities/parts/model/parts-progress'
import { pickPart } from '@/entities/parts/model/parts'
import { queryClient, studio } from '@/shared/api/studio'
import { buildUrl } from '@/shared/lib/urls'
import { useMinecraftPack } from '@/entities/settings/model/settings'
import { cssColor } from '@/shared/lib/theme'
import { hasEnabledLintRule } from '@/shared/lib/format'
import {
  AUTO_LINT_BYTES,
  CHECK_COLORS,
  locatableChecks,
  type BuildVersion
} from '@/entities/build/model/workspace'

type Bridged<M extends keyof BridgeMethods> = {
  queryKey: unknown[]
  queryFn: () => Promise<BridgeMethods[M]['result']>
}

/** The 3D view's frame rate, read only by Activity: a per-second state would re-render the screen. */
export const useFps = create(() => ({ fps: 0 }))
export const setFps = (fps: number): void => useFps.setState({ fps })

/**
 * Parts, checks and materials of one version, and what the 3D view draws for the parts selection.
 * The selection is by part name, so it carries over to the next version.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- VersionAnalysis below is this inferred shape
export function useVersionAnalysis({
  version,
  engine,
  jobCounts,
  anchor,
  theme,
  linter = DEFAULT_LINTER_SETTINGS
}: {
  version: BuildVersion | null
  engine: boolean
  /** The writing job's check counts, when this session generated the version. */
  jobCounts?: Record<string, number>
  anchor?: 'edges'
  /** Read the marker colours again when it changes. */
  theme: string
  linter?: LinterSettings
}) {
  const source = version ? buildUrl(version.path, Math.round(version.mtime)) : null
  const minecraftVersion = version
    ? (version.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION)
    : undefined
  const pack = useMinecraftPack(minecraftVersion)
  const [force, setForce] = useState<string | null>(null)
  const [highlightChecks, setHighlightChecks] = useState(false)
  const auto = !!version && (version.size < AUTO_LINT_BYTES || force === source)
  const lintActive = linter.enabled && hasEnabledLintRule(linter.rules)
  const wantDark = linter.rules.dark
  // Parts has its own serial worker so lint cannot delay selection.
  const canParts = !!version?.parts && engine
  const key = [version?.path, version?.mtime, minecraftVersion]
  const progressKey = (kind: string, subset?: string[]): string =>
    JSON.stringify([kind, ...key, subset])
  const parts = useQuery({
    queryKey: ['parts', ...key],
    queryFn: () =>
      partsCall(progressKey('parts'), 'parts', { path: version!.path }, minecraftVersion),
    enabled: canParts
  })
  const lint = useQuery({
    queryKey: ['lint', ...key, anchor, wantDark],
    queryFn: () =>
      studio.bridge.call(
        'lint',
        { path: version!.path, n: 25, anchor, dark: wantDark },
        undefined,
        minecraftVersion
      ),
    enabled: lintActive && auto && engine
  })
  const bill = useQuery({
    queryKey: ['bill', ...key],
    queryFn: () =>
      studio.bridge.call('bill', { path: version!.path, top: 100000 }, undefined, minecraftVersion),
    enabled: auto && engine
  })

  const [selected, selectParts] = useState<string[]>([])
  const selectionRevision = useRef(0)
  const pickQueue = useRef(Promise.resolve())
  const setSelected = (next: SetStateAction<string[]>): void => {
    selectionRevision.current++
    selectParts(next)
  }
  const [partsView, setPartsView] = useState(false)
  const [isolateOn, setIsolate] = useState(false)
  const partList = parts.data?.parts ?? null
  const chosen = useMemo(
    () => (partList ?? []).filter((p) => selected.includes(p.name)),
    [partList, selected]
  )
  const names = useMemo(() => chosen.map((p) => p.name), [chosen])
  if (isolateOn && partList && !names.length) setIsolate(false) // the next pick shouldn't hide the build
  const isolating = isolateOn && names.length > 0
  const selectionKey = JSON.stringify([source, names])
  const [settledSelection, settleSelection] = useState(selectionKey)
  useEffect(() => {
    const timer = setTimeout(() => settleSelection(selectionKey), 100)
    return () => clearTimeout(timer)
  }, [selectionKey])
  const settled = settledSelection === selectionKey
  const partFile = useQuery({
    queryKey: ['part-file', ...key, names],
    queryFn: () =>
      partsCall(
        progressKey('file', names),
        'part_file',
        {
          path: version!.path,
          names,
          output: 'isolated',
          crop: true
        },
        minecraftVersion
      ),
    enabled: canParts && names.length > 0 && !partsView && settled
  })
  const colorQuery = (subset: string[] | null): Bridged<'part_colors'> => ({
    queryKey: ['part-colors', ...key, subset],
    queryFn: () =>
      partsCall(
        progressKey('colors', subset ?? undefined),
        'part_colors',
        {
          path: version!.path,
          names: subset ?? undefined,
          crop: !!subset
        },
        minecraftVersion
      )
  })
  const colors = useQuery({
    ...colorQuery(null),
    enabled: canParts && partsView && !!partList && !isolating
  })
  const isoColors = useQuery({
    ...colorQuery(names),
    enabled: canParts && partsView && names.length > 0 && settled
  })
  const partAtQuery = (cell: Cell): Bridged<'parts'> => ({
    queryKey: ['part-at', ...key, cell],
    queryFn: () =>
      studio.bridge.call('parts', { path: version!.path, cell }, undefined, minecraftVersion)
  })
  const [pick, setPick] = useState<{ cell: Cell; state?: string } | null>(null)
  const [pickedIn, setPickedIn] = useState(source)
  if (pickedIn !== source) {
    setPickedIn(source)
    setPick(null)
  }
  const partAt = useQuery({
    ...partAtQuery(pick?.cell ?? [0, 0, 0]),
    enabled: canParts && !!partList && !!pick?.state
  })

  const shownColors = partsView ? (isolating ? isoColors : colors) : null
  const overlays: ViewerOverlayFile[] = []
  if (shownColors?.data)
    overlays.push({
      src: buildUrl(shownColors.data.path, shownColors.dataUpdatedAt),
      visible: true,
      selection: isolating,
      maskOnly: false
    })
  if (names.length && !partsView && partFile.data)
    overlays.push({
      src: buildUrl(partFile.data.isolated, partFile.dataUpdatedAt),
      visible: true,
      selection: true,
      maskOnly: !isolating
    })
  if (names.length && partsView && !isolating && isoColors.data)
    overlays.push({
      src: buildUrl(isoColors.data.path, isoColors.dataUpdatedAt),
      visible: true,
      selection: true,
      maskOnly: true
    })
  const partsBusy =
    canParts &&
    ((names.length > 0 && (!settled || (partsView ? isoColors.isFetching : partFile.isFetching))) ||
      (partsView && !isolating && colors.isFetching))
  const partsFailed = !!(partsView
    ? isoColors.error || (!isolating && colors.error)
    : partFile.error)
  const complete =
    !partsBusy &&
    !partsFailed &&
    (!names.length || (partsView ? !!isoColors.data : !!partFile.data)) &&
    (!partsView || isolating || !!colors.data)
  const hideBuild = !!(partsView ? shownColors?.data : isolating && partFile.data)
  // Retain a coherent view until every requested overlay is ready, never a different version.
  const displayKey = JSON.stringify([source, overlays, hideBuild])
  const [previous, setPrevious] = useState({ key: displayKey, source, overlays, hideBuild })
  if (complete && previous.key !== displayKey)
    setPrevious({ key: displayKey, source, overlays, hideBuild })
  // After a failure, show what loaded: keeping the old selection's highlight would contradict the toolbar.
  const shown =
    complete || partsFailed || previous.source !== source ? { overlays, hideBuild } : previous
  const progressKeys = [
    progressKey('parts'),
    ...(partsView ? [progressKey('colors', isolating ? names : undefined)] : []),
    ...(names.length ? [progressKey(partsView ? 'colors' : 'file', names)] : [])
  ]

  const onPick = (p: { cell: Cell; state: string | undefined; add: boolean }): void => {
    setPick({ cell: p.cell, state: p.state })
    if (!partsView || !partList || !p.state) return
    const revision = selectionRevision.current
    const result = queryClient.fetchQuery(partAtQuery(p.cell)).catch(() => null)
    // Cached picks can finish before older requests; apply clicks in order, including Shift-clicks.
    pickQueue.current = pickQueue.current.then(async () => {
      const r = await result
      if (pickSource.current === source && selectionRevision.current === revision && r?.at)
        selectParts((s) => pickPart(s, r.at!, p.add))
    })
  }
  const pickSource = useRef(source)
  useLayoutEffect(() => {
    if (pickSource.current !== source) selectionRevision.current++
    pickSource.current = source
  }, [source])

  const where = useMemo(
    () =>
      lintActive && lint.data
        ? locatableChecks(lint.data.where, lint.data.counts, jobCounts, linter.rules)
        : [],
    [lintActive, lint.data, jobCounts, linter.rules]
  )
  const markers = useMemo<Marker[]>(
    () =>
      highlightChecks
        ? where.flatMap(([k, rows]) => {
            const color = cssColor(CHECK_COLORS[k] ?? '--fg')
            return rows.map(([, , cell]) => ({ cell, color }))
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read the colours again when the theme changes
    [highlightChecks, where, theme]
  )

  return {
    source,
    /** Where the file's (0, 0, 0) sits in build coordinates. */
    origin: version?.origin,
    minecraftVersion,
    pack: pack.data,
    packLoading: pack.isLoading,
    packError: pack.error,
    auto,
    analyze: () => setForce(source),
    highlightChecks,
    setHighlightChecks,
    parts,
    lint,
    bill,
    partList,
    chosen,
    names,
    selected,
    setSelected,
    partsView,
    setPartsView,
    isolate: isolateOn,
    setIsolate,
    colors,
    overlays: shown.overlays,
    hideBuild: shown.hideBuild,
    partsBusy,
    partsFailed,
    progressKeys,
    pick,
    setPick,
    onPick,
    /** The part that built the picked block. */
    pickedPart: partList && pick?.state ? partAt.data?.at : null,
    where,
    markers
  }
}
export type VersionAnalysis = ReturnType<typeof useVersionAnalysis>
