// State and IPC/bridge orchestration for the reworked 3D World Map Location screen.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { SitePlacement, WorldDimension } from '@shared/api'
import { studio } from '@/shared/api/studio'
import { errorText, type BuildVersion } from '@/entities/build/model/workspace'
import {
  buildBoxFromOrigin,
  centeredBox,
  defaultAnchor,
  nextRotation,
  normalizeBox,
  originFromArea
} from '@/entities/world-map/model/placement'
import {
  createWorldUrlSource,
  type Box2D,
  type CameraMode,
  type GroundStats,
  type LightingMode,
  type PlacementMode,
  type RotationDeg,
  type Vec3,
  type WorldDataSource
} from '@/entities/world-map/model/types'
import type { FlyTarget } from '@/entities/world-map/ui/WorldMapViewport'
import { readSiteState, writeSiteState } from './storage'

const DEFAULT_MARGIN = 48
const DEFAULT_AREA_SIDE = 48
const DEFAULT_ORIGIN: Vec3 = [0, 68, 0]
const DEFAULT_BUILD_SIZE: Vec3 = [16, 16, 16]

interface PlacementOverride {
  key: string | null
  origin: Vec3 | null
  areaBox: Box2D | null
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- screen reads full view model
export function useSiteLocation(name: string, target: string, versions: BuildVersion[]) {
  const qc = useQueryClient()
  const [initialStored] = useState(() => readSiteState(name))

  const worlds = useQuery({ queryKey: ['worlds'], queryFn: () => studio.site.worlds() })
  const savedMeta = useQuery({
    queryKey: ['site_meta', name],
    queryFn: () => studio.site.readMeta(name)
  })

  const hasDrafts = versions.length > 0
  const [worldOverride, setWorldOverride] = useState<string | null>(initialStored?.world ?? null)
  const [dimOverride, setDimOverride] = useState<WorldDimension | null>(
    initialStored?.dimension ?? null
  )
  const [modeOverride, setModeOverride] = useState<PlacementMode | null>(
    initialStored?.mode ?? null
  )
  const [versionOverride, setVersionOverride] = useState<string | null>(
    initialStored?.versionPath ?? null
  )
  const [cameraModeOverride, setCameraModeOverride] = useState<CameraMode | null>(
    initialStored?.cameraMode ?? null
  )
  const [lightingOverride, setLightingOverride] = useState<LightingMode | null>(
    initialStored?.lighting ?? null
  )
  const [rotationOverride, setRotationOverride] = useState<RotationDeg | null>(
    initialStored?.rotation ?? null
  )
  const [marginOverride, setMarginOverride] = useState<number | null>(initialStored?.margin ?? null)
  const [clipYOverride, setClipYOverride] = useState<number | null | undefined>(
    initialStored ? initialStored.clipY : undefined
  )
  const [placementOverride, setPlacementOverride] = useState<PlacementOverride>(() =>
    initialStored && (initialStored.origin !== null || initialStored.areaBox !== null)
      ? {
          key: initialStored.dimension
            ? `${initialStored.world}::${initialStored.dimension}`
            : initialStored.world,
          origin: initialStored.origin,
          areaBox: initialStored.areaBox
        }
      : { key: null, origin: null, areaBox: null }
  )
  const [loadedBuildSize, setLoadedBuildSize] = useState<Vec3 | null>(null)
  const [groundStats, setGroundStats] = useState<GroundStats | null>(null)
  const [flyState, setFlyState] = useState<{ key: string | null; target: FlyTarget | null }>({
    key: null,
    target: null
  })
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)

  const heightLookupRef = useRef<(x: number, z: number) => number | null>(() => null)

  // Resolve active world without auto-selecting a default save: user choice / stored state -> saved site.json -> ''
  const world = worldOverride ?? (savedMeta.isPending ? '' : (savedMeta.data?.world ?? ''))

  const worldInfo = useQuery({
    queryKey: ['world_inspect', world],
    queryFn: () => studio.site.inspect(world),
    enabled: !!world
  })

  // Resolve active dimension automatically once a world is chosen
  const availableDimensions: WorldDimension[] = worldInfo.data?.dimensions.length
    ? worldInfo.data.dimensions
    : ['overworld']
  const dimension: WorldDimension =
    dimOverride && availableDimensions.includes(dimOverride)
      ? dimOverride
      : savedMeta.data?.world === world &&
          savedMeta.data.dimension &&
          availableDimensions.includes(savedMeta.data.dimension)
        ? savedMeta.data.dimension
        : worldInfo.data?.playerDimension &&
            availableDimensions.includes(worldInfo.data.playerDimension)
          ? worldInfo.data.playerDimension
          : availableDimensions[0]

  const meta = !initialStored ? savedMeta.data : null
  const cameraMode: CameraMode = cameraModeOverride ?? meta?.cameraMode ?? '3d'
  const lighting: LightingMode = lightingOverride ?? meta?.lighting ?? 'sun'
  const rotation: RotationDeg = rotationOverride ?? meta?.rotation ?? 0
  const margin: number = marginOverride ?? meta?.margin ?? DEFAULT_MARGIN
  const clipY: number | null = clipYOverride !== undefined ? clipYOverride : (meta?.clipY ?? null)

  // Auto-adaptive placement mode: Place Build when a draft exists, Scout Terrain when none exists
  const mode: PlacementMode = hasDrafts ? (modeOverride ?? savedMeta.data?.mode ?? 'build') : 'area'

  const activeVersionPath =
    versions.find((v) => v.path === versionOverride)?.path ??
    versions.find((v) => v.path === savedMeta.data?.versionPath)?.path ??
    versions[0]?.path ??
    null

  const buildSize: Vec3 = loadedBuildSize ?? DEFAULT_BUILD_SIZE
  const buildHeight = loadedBuildSize ? loadedBuildSize[1] : 0

  const currentKey = worldInfo.data ? `${worldInfo.data.path}::${dimension}` : null
  const overrideMatchesKey =
    placementOverride.key !== null &&
    (placementOverride.key === currentKey || (!!world && placementOverride.key === world))
  const metaMatchesKey =
    !!savedMeta.data &&
    !!worldInfo.data &&
    savedMeta.data.world === worldInfo.data.path &&
    savedMeta.data.dimension === dimension

  const origin: Vec3 = useMemo(() => {
    if (overrideMatchesKey && placementOverride.origin) return placementOverride.origin
    if (metaMatchesKey && savedMeta.data) return savedMeta.data.origin
    if (worldInfo.data) return defaultAnchor(worldInfo.data, dimension)
    return DEFAULT_ORIGIN
  }, [
    overrideMatchesKey,
    placementOverride.origin,
    metaMatchesKey,
    savedMeta.data,
    worldInfo.data,
    dimension
  ])

  const areaBox: Box2D | null = useMemo(() => {
    if (overrideMatchesKey && placementOverride.areaBox) return placementOverride.areaBox
    if (metaMatchesKey && savedMeta.data) return savedMeta.data.areaBox ?? savedMeta.data.box
    if (worldInfo.data) {
      return centeredBox(origin[0], origin[2], DEFAULT_AREA_SIDE, DEFAULT_AREA_SIDE)
    }
    return null
  }, [
    overrideMatchesKey,
    placementOverride.areaBox,
    metaMatchesKey,
    savedMeta.data,
    worldInfo.data,
    origin
  ])

  // Snap camera once when opening a world/dimension without overwriting restored coordinates
  if (worldInfo.data && !savedMeta.isPending && currentKey && currentKey !== flyState.key) {
    const [x1, z1, x2, z2] = normalizeBox(
      mode === 'build'
        ? buildBoxFromOrigin(origin, buildSize, rotation)
        : (areaBox ?? centeredBox(origin[0], origin[2], DEFAULT_AREA_SIDE, DEFAULT_AREA_SIDE))
    )
    setFlyState((prev) => ({
      key: currentKey,
      target: {
        x: Math.round((x1 + x2) / 2),
        y: origin[1],
        z: Math.round((z1 + z2) / 2),
        distance: 150,
        snap: true,
        seq: (prev.target?.seq ?? 0) + 1
      }
    }))
  }

  // Persist chosen world and all configured Location settings across tab switches and restarts
  useEffect(() => {
    if (!world) return
    const hasResolvedOrigin = !!worldInfo.data || (overrideMatchesKey && !!placementOverride.origin)
    writeSiteState(name, {
      version: 1,
      world,
      dimension: worldInfo.data ? dimension : dimOverride,
      mode: modeOverride,
      versionPath: versionOverride,
      cameraMode,
      lighting,
      areaBox,
      origin: hasResolvedOrigin ? origin : null,
      rotation,
      margin,
      clipY
    })
  }, [
    name,
    world,
    worldInfo.data,
    dimension,
    dimOverride,
    modeOverride,
    versionOverride,
    cameraMode,
    lighting,
    areaBox,
    overrideMatchesKey,
    placementOverride.origin,
    origin,
    rotation,
    margin,
    clipY
  ])

  const source: WorldDataSource | null = useMemo(() => {
    if (!worldInfo.data) return null
    return createWorldUrlSource(worldInfo.data, dimension)
  }, [worldInfo.data, dimension])

  // Active bounding box & effective ORIGIN across both modes
  const activeBox: Box2D | null = useMemo(() => {
    if (mode === 'build') return buildBoxFromOrigin(origin, buildSize, rotation)
    return areaBox ? normalizeBox(areaBox) : null
  }, [mode, origin, buildSize, rotation, areaBox])

  const effectiveOrigin: Vec3 = useMemo(() => {
    if (mode === 'build') return origin
    if (areaBox) return originFromArea(areaBox, groundStats?.median ?? origin[1] - 1)
    return origin
  }, [mode, origin, areaBox, groundStats])

  const setOrigin = useCallback(
    (next: Vec3) => {
      const key = currentKey ?? (world || null)
      setPlacementOverride((prev) => ({
        key,
        origin: next,
        areaBox: prev.key === key ? prev.areaBox : areaBox
      }))
    },
    [currentKey, world, areaBox]
  )

  const setAreaBox = useCallback(
    (next: Box2D | null) => {
      const key = currentKey ?? (world || null)
      setPlacementOverride((prev) => ({
        key,
        origin: prev.key === key ? prev.origin : origin,
        areaBox: next
      }))
    },
    [currentKey, world, origin]
  )

  const flyToPoint = useCallback((x: number, y: number, z: number, distance?: number) => {
    setFlyState((prev) => ({
      key: prev.key,
      target: { x, y, z, distance, snap: false, seq: (prev.target?.seq ?? 0) + 1 }
    }))
  }, [])

  const jumpToSpawn = useCallback(() => {
    const sp = worldInfo.data?.spawn
    if (!sp) return
    flyToPoint(sp[0], sp[1], sp[2])
  }, [worldInfo.data, flyToPoint])

  const jumpToPlayer = useCallback(() => {
    const pl = worldInfo.data?.player
    if (!pl) return
    flyToPoint(pl[0], pl[1], pl[2])
  }, [worldInfo.data, flyToPoint])

  const jumpToCoords = useCallback(
    (x: number, z: number) => {
      const y = heightLookupRef.current(x, z) ?? origin[1]
      flyToPoint(x, y, z)
    },
    [flyToPoint, origin]
  )

  const snapToGround = useCallback(() => {
    const y = heightLookupRef.current(origin[0], origin[2])
    if (y === null) {
      toast.error('Terrain height not loaded at this position yet')
      return
    }
    setOrigin([origin[0], y + 1, origin[2]])
  }, [origin, setOrigin])

  const rotateBy = useCallback(
    (delta: 90 | -90) => {
      setRotationOverride((r) => nextRotation(r ?? meta?.rotation ?? 0, delta))
    },
    [meta?.rotation]
  )

  const selectWorld = useCallback(
    (w: string) => {
      if (!w || w === world) return
      setWorldOverride(w)
      setDimOverride(null)
      setPlacementOverride({ key: null, origin: null, areaBox: null })
      setFlyState((prev) => ({ key: null, target: prev.target }))
      setGroundStats(null)
    },
    [world]
  )

  const pickWorldFolder = useCallback(async () => {
    const p = await studio.site.pick()
    if (p) selectWorld(p)
  }, [selectWorld])

  const setHeightLookup = useCallback((fn: (x: number, z: number) => number | null) => {
    heightLookupRef.current = fn
  }, [])

  const save = useMutation({
    mutationFn: async (overwrite: boolean) => {
      if (!world || !activeBox) throw new Error('Choose a location on the map first')
      const box = normalizeBox(activeBox)

      let terrainWritten = false
      // Overworld supports engine terrain.npz extraction via mcb.savefile
      if (dimension === 'overworld') {
        const terrainRes = await studio.bridge.call(
          'site_terrain',
          { world, box, build: name, margin, overwrite },
          undefined,
          target
        )
        if (terrainRes.exists) {
          return { needsConfirm: true as const, originUpdated: false, terrainWritten: false }
        }
        terrainWritten = true
      }

      const placement: SitePlacement = {
        version: 1,
        world,
        dimension,
        mode,
        box,
        areaBox: areaBox ? normalizeBox(areaBox) : undefined,
        origin: effectiveOrigin,
        rotation,
        margin,
        versionPath: mode === 'build' ? (activeVersionPath ?? undefined) : undefined,
        cameraMode,
        lighting,
        clipY,
        ground: groundStats ?? undefined
      }
      const metaRes = await studio.site.saveMeta(name, placement, true)
      return {
        needsConfirm: false as const,
        originUpdated: metaRes.originUpdated,
        terrainWritten
      }
    },
    onSuccess: (res) => {
      if (res.needsConfirm) {
        setConfirmOverwrite(true)
        return
      }
      void qc.invalidateQueries({ queryKey: ['site_meta', name] })
      const parts = [res.terrainWritten ? 'terrain.npz' : 'site.json']
      if (res.originUpdated) parts.push('ORIGIN updated')
      toast.success(`Saved location (${parts.join(' · ')})`)
    },
    onError: (e) => toast.error(`Could not save location: ${errorText(e)}`)
  })

  return {
    worlds,
    savedMetaPending: savedMeta.isPending,
    world,
    setWorld: selectWorld,
    worldInfo,
    dimension,
    availableDimensions,
    setDimension: setDimOverride,
    hasDrafts,
    mode,
    setMode: setModeOverride,
    activeVersionPath,
    setActiveVersionPath: setVersionOverride,
    cameraMode,
    setCameraMode: setCameraModeOverride,
    lighting,
    setLighting: setLightingOverride,
    source,
    areaBox,
    setAreaBox,
    origin,
    setOrigin,
    rotation,
    rotateBy,
    margin,
    setMargin: setMarginOverride,
    clipY,
    setClipY: setClipYOverride,
    buildSize,
    buildHeight,
    setBuildSize: setLoadedBuildSize,
    groundStats,
    setGroundStats,
    activeBox,
    effectiveOrigin,
    flyTo: flyState.target,
    jumpToSpawn,
    jumpToPlayer,
    jumpToCoords,
    snapToGround,
    pickWorldFolder,
    setHeightLookup,
    confirmOverwrite,
    setConfirmOverwrite,
    save
  }
}
