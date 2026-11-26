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

const DEFAULT_MARGIN = 48
const DEFAULT_AREA_SIDE = 48

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- screen reads full view model
export function useSiteLocation(name: string, target: string, versions: BuildVersion[]) {
  const qc = useQueryClient()
  const storageKey = `site:world:${name}`
  const rememberedWorld = useMemo(() => {
    try {
      return localStorage.getItem(storageKey) ?? ''
    } catch {
      return ''
    }
  }, [storageKey])

  const worlds = useQuery({ queryKey: ['worlds'], queryFn: () => studio.site.worlds() })
  const savedMeta = useQuery({
    queryKey: ['site_meta', name],
    queryFn: () => studio.site.readMeta(name)
  })

  const hasDrafts = versions.length > 0
  const [worldOverride, setWorldOverride] = useState<string | null>(null)
  const [dimOverride, setDimOverride] = useState<WorldDimension | null>(null)
  const [modeOverride, setModeOverride] = useState<PlacementMode | null>(null)
  const [versionOverride, setVersionOverride] = useState<string | null>(null)

  const [cameraMode, setCameraMode] = useState<CameraMode>('3d')
  const [lighting, setLighting] = useState<LightingMode>('sun')
  const [areaBox, setAreaBox] = useState<Box2D | null>(null)
  const [origin, setOrigin] = useState<Vec3>([0, 68, 0])
  const [rotation, setRotation] = useState<RotationDeg>(0)
  const [margin, setMargin] = useState<number>(DEFAULT_MARGIN)
  const [buildSize, setBuildSize] = useState<Vec3>([16, 16, 16])
  const [groundStats, setGroundStats] = useState<GroundStats | null>(null)
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)

  const heightLookupRef = useRef<(x: number, z: number) => number | null>(() => null)
  const seqRef = useRef(1)
  const initializedKeyRef = useRef<string | null>(null)
  const metaHydratedRef = useRef(false)

  // Resolve active world automatically: user choice -> saved site.json -> localStorage -> first detected world
  const world =
    worldOverride ??
    (savedMeta.isPending
      ? ''
      : (savedMeta.data?.world ?? (rememberedWorld || worlds.data?.[0]?.path || '')))

  // Persist last selected world
  useEffect(() => {
    if (!world) return
    try {
      localStorage.setItem(storageKey, world)
    } catch {
      // ignore private storage errors
    }
  }, [storageKey, world])

  const worldInfo = useQuery({
    queryKey: ['world_inspect', world],
    queryFn: () => studio.site.inspect(world),
    enabled: !!world
  })

  // Resolve active dimension automatically
  const availableDimensions: WorldDimension[] = worldInfo.data?.dimensions.length
    ? worldInfo.data.dimensions
    : ['overworld']
  const dimension: WorldDimension =
    dimOverride && availableDimensions.includes(dimOverride)
      ? dimOverride
      : savedMeta.data?.dimension && availableDimensions.includes(savedMeta.data.dimension)
        ? savedMeta.data.dimension
        : worldInfo.data?.playerDimension &&
            availableDimensions.includes(worldInfo.data.playerDimension)
          ? worldInfo.data.playerDimension
          : availableDimensions[0]

  // Auto-adaptive placement mode: Place Build when a draft exists, Scout Terrain when none exists
  const mode: PlacementMode = hasDrafts ? (modeOverride ?? savedMeta.data?.mode ?? 'build') : 'area'

  const activeVersionPath =
    versions.find((v) => v.path === versionOverride)?.path ??
    versions.find((v) => v.path === savedMeta.data?.versionPath)?.path ??
    versions[0]?.path ??
    null

  // Hydrate saved placement values once when savedMeta resolves
  useEffect(() => {
    const meta = savedMeta.data
    if (!meta || metaHydratedRef.current) return
    metaHydratedRef.current = true
    setAreaBox(meta.box)
    setOrigin(meta.origin)
    setRotation(meta.rotation)
    setMargin(meta.margin)
  }, [savedMeta.data])

  // Snap camera and seed default placement when opening a world/dimension
  useEffect(() => {
    const info = worldInfo.data
    if (!info || savedMeta.isPending) return
    const key = `${info.path}::${dimension}`
    if (initializedKeyRef.current === key) return
    initializedKeyRef.current = key

    const meta = savedMeta.data
    const matchesSaved = meta && meta.world === info.path && meta.dimension === dimension
    if (matchesSaved) {
      const [x1, z1, x2, z2] = normalizeBox(meta.box)
      const cx = Math.round((x1 + x2) / 2)
      const cz = Math.round((z1 + z2) / 2)
      setFlyTo({
        x: cx,
        y: meta.origin[1],
        z: cz,
        distance: 150,
        snap: true,
        seq: seqRef.current++
      })
      return
    }

    const anchor = defaultAnchor(info, dimension)
    setOrigin(anchor)
    setAreaBox(centeredBox(anchor[0], anchor[2], DEFAULT_AREA_SIDE, DEFAULT_AREA_SIDE))
    setFlyTo({
      x: anchor[0],
      y: anchor[1],
      z: anchor[2],
      distance: 150,
      snap: true,
      seq: seqRef.current++
    })
  }, [worldInfo.data, dimension, savedMeta.data, savedMeta.isPending])

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

  const flyToPoint = useCallback((x: number, y: number, z: number, distance?: number) => {
    setFlyTo({ x, y, z, distance, snap: false, seq: seqRef.current++ })
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
  }, [origin])

  const rotateBy = useCallback((delta: 90 | -90) => {
    setRotation((r) => nextRotation(r, delta))
  }, [])

  const pickWorldFolder = useCallback(async () => {
    const p = await studio.site.pick()
    if (p) {
      setWorldOverride(p)
      setDimOverride(null)
    }
  }, [])

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
        origin: effectiveOrigin,
        rotation,
        margin,
        versionPath: mode === 'build' ? (activeVersionPath ?? undefined) : undefined,
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
    setWorld: (w: string) => {
      setWorldOverride(w)
      setDimOverride(null)
    },
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
    setCameraMode,
    lighting,
    setLighting,
    source,
    areaBox,
    setAreaBox,
    origin,
    setOrigin,
    rotation,
    rotateBy,
    margin,
    setMargin,
    buildSize,
    setBuildSize,
    groundStats,
    setGroundStats,
    activeBox,
    effectiveOrigin,
    flyTo,
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
