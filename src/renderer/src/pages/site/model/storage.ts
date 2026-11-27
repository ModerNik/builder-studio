// Per-project Location screen state persistence in localStorage (survives tab switches and restarts).
import { z } from 'zod'
import { WorldDimensionSchema } from '@shared/api'

const Box2DSchema = z.tuple([z.int32(), z.int32(), z.int32(), z.int32()])
const Vec3Schema = z.tuple([z.int32(), z.int32(), z.int32()])

export const SiteStoredStateSchema = z.object({
  version: z.literal(1),
  world: z.string().min(1),
  dimension: WorldDimensionSchema.nullable().default(null),
  mode: z.enum(['area', 'build']).nullable().default(null),
  versionPath: z.string().nullable().default(null),
  cameraMode: z.enum(['3d', 'iso', 'top']).default('3d'),
  lighting: z.enum(['sun', 'game']).default('sun'),
  areaBox: Box2DSchema.nullable().default(null),
  origin: Vec3Schema.nullable().default(null),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  margin: z.int32().min(0).default(48),
  clipY: z.int32().min(0).nullable().default(null)
})

export type SiteStoredState = z.infer<typeof SiteStoredStateSchema>

export const siteStateStorageKey = (build: string): string => `site:state:${build}`
export const legacySiteWorldKey = (build: string): string => `site:world:${build}`

export function readSiteState(build: string): SiteStoredState | null {
  try {
    const raw = localStorage.getItem(siteStateStorageKey(build))
    if (!raw) return null
    const parsed = SiteStoredStateSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function writeSiteState(build: string, state: SiteStoredState): void {
  try {
    localStorage.setItem(siteStateStorageKey(build), JSON.stringify(state))
    localStorage.removeItem(legacySiteWorldKey(build))
  } catch {
    // ignore private/full storage errors
  }
}
