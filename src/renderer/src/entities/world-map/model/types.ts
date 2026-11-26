import type { WorldDimension, WorldInfo } from '@shared/api'

export type CameraMode = '3d' | 'iso' | 'top'
export type LightingMode = 'sun' | 'game'
export type PlacementMode = 'area' | 'build'
export type RotationDeg = 0 | 90 | 180 | 270
export type Box2D = [number, number, number, number] // x1, z1, x2, z2 inclusive
export type Vec3 = [number, number, number]

export interface GroundStats {
  min: number
  max: number
  median: number
}

export interface WorldCursor {
  x: number
  y: number
  z: number
}

export interface StreamStats {
  lowresLoaded: number
  hiresLoaded: number
  pending: number
}

/** Source of binary LOD-1 region tiles and LOD-0 voxel chunks (real world:// protocol or procedural /kit source). */
export interface WorldDataSource {
  key: string
  dimension: WorldDimension
  /** Available region coordinates [rx, rz] in this dimension (null = unbounded procedural source). */
  regions: [number, number][] | null
  fetchLowres(rx: number, rz: number, signal: AbortSignal): Promise<ArrayBuffer | null>
  fetchHires(cx: number, cz: number, signal: AbortSignal): Promise<ArrayBuffer | null>
}

export function createWorldUrlSource(info: WorldInfo, dimension: WorldDimension): WorldDataSource {
  const base = `world://tile`
  const regions = info.regions[dimension] ?? []
  const qs = (kind: 'lowres' | 'hires', a: string, b: string, av: number, bv: number): string =>
    `${base}/${kind}?world=${encodeURIComponent(info.path)}&dim=${dimension}&${a}=${av}&${b}=${bv}`

  return {
    key: `${info.path}::${dimension}`,
    dimension,
    regions,
    async fetchLowres(rx, rz, signal) {
      const res = await fetch(qs('lowres', 'rx', 'rz', rx, rz), { signal })
      if (res.status === 204 || !res.ok) return null
      return res.arrayBuffer()
    },
    async fetchHires(cx, cz, signal) {
      const res = await fetch(qs('hires', 'cx', 'cz', cx, cz), { signal })
      if (res.status === 204 || !res.ok) return null
      return res.arrayBuffer()
    }
  }
}
