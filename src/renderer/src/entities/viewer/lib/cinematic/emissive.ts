// Classifies Minecraft light-emitting block states for selective HDR emissive bloom and warm block-light fill.
import * as THREE from 'three'
import { Mesher, type BlockColorMap } from '../render/mesher'
import { CUTOUT, OPAQUE, type Resources } from '../render/resources'
import type { Schematic } from '../render/schematic'

export interface EmissiveSpec {
  color: number
  intensity: number
}

const ALWAYS_EMISSIVE: Record<string, EmissiveSpec> = {
  glowstone: { color: 0xffd27d, intensity: 1.55 },
  sea_lantern: { color: 0xbef5ff, intensity: 1.5 },
  shroomlight: { color: 0xffb866, intensity: 1.5 },
  ochre_froglight: { color: 0xffe49e, intensity: 1.55 },
  verdant_froglight: { color: 0xb9ffba, intensity: 1.5 },
  pearlescent_froglight: { color: 0xf7c9ff, intensity: 1.5 },
  lantern: { color: 0xffb357, intensity: 1.8 },
  soul_lantern: { color: 0x62e8ff, intensity: 1.75 },
  torch: { color: 0xffb44f, intensity: 1.8 },
  wall_torch: { color: 0xffb44f, intensity: 1.8 },
  soul_torch: { color: 0x5be6ff, intensity: 1.75 },
  soul_wall_torch: { color: 0x5be6ff, intensity: 1.75 },
  end_rod: { color: 0xfff5e8, intensity: 1.65 },
  lava: { color: 0xff6b1a, intensity: 1.75 },
  magma_block: { color: 0xff6a24, intensity: 1.1 },
  jack_o_lantern: { color: 0xffb347, intensity: 1.45 },
  beacon: { color: 0xaef6ff, intensity: 1.9 },
  conduit: { color: 0x9ceeff, intensity: 1.4 },
  crying_obsidian: { color: 0xa855f7, intensity: 1.15 },
  fire: { color: 0xff8c2b, intensity: 1.85 },
  soul_fire: { color: 0x4de2ff, intensity: 1.85 },
  amethyst_cluster: { color: 0xc084fc, intensity: 1.05 },
  glow_lichen: { color: 0xc2e6cc, intensity: 1.0 },
  sea_pickle: { color: 0xcdf5b8, intensity: 1.2 },
  brewing_stand: { color: 0xffc27a, intensity: 0.9 },
  ender_chest: { color: 0x7dd3fc, intensity: 0.9 },
  enchanting_table: { color: 0x93c5fd, intensity: 0.9 },
  nether_portal: { color: 0xc066ff, intensity: 1.65 },
  end_portal: { color: 0x38bdf8, intensity: 1.5 },
  end_gateway: { color: 0x60a5fa, intensity: 1.5 }
}

const LIT_EMISSIVE: Record<string, EmissiveSpec> = {
  redstone_lamp: { color: 0xffcf7a, intensity: 1.6 },
  furnace: { color: 0xff9436, intensity: 1.4 },
  smoker: { color: 0xff9436, intensity: 1.4 },
  blast_furnace: { color: 0xff9436, intensity: 1.45 },
  campfire: { color: 0xff9130, intensity: 1.75 },
  soul_campfire: { color: 0x52e0ff, intensity: 1.75 },
  redstone_torch: { color: 0xff4033, intensity: 1.4 },
  redstone_wall_torch: { color: 0xff4033, intensity: 1.4 },
  redstone_ore: { color: 0xff3b30, intensity: 1.15 },
  deepslate_redstone_ore: { color: 0xff3b30, intensity: 1.15 },
  copper_bulb: { color: 0xffc66e, intensity: 1.55 },
  exposed_copper_bulb: { color: 0xffbf66, intensity: 1.4 },
  weathered_copper_bulb: { color: 0xeeb868, intensity: 1.25 },
  oxidized_copper_bulb: { color: 0x99d9be, intensity: 1.1 },
  waxed_copper_bulb: { color: 0xffc66e, intensity: 1.55 },
  waxed_exposed_copper_bulb: { color: 0xffbf66, intensity: 1.4 },
  waxed_weathered_copper_bulb: { color: 0xeeb868, intensity: 1.25 },
  waxed_oxidized_copper_bulb: { color: 0x99d9be, intensity: 1.1 }
}

/** Parse a block state string (`minecraft:lantern[hanging=true]`) and return its emissive spec if it glows. */
export function emissiveInfo(state: string): EmissiveSpec | null {
  const bracket = state.indexOf('[')
  const rawId = bracket >= 0 ? state.slice(0, bracket) : state
  const id = rawId.startsWith('minecraft:') ? rawId.slice(10) : rawId
  const props = bracket >= 0 ? state.slice(bracket + 1, state.endsWith(']') ? -1 : undefined) : ''

  if (id in ALWAYS_EMISSIVE) return ALWAYS_EMISSIVE[id]
  if (id in LIT_EMISSIVE) {
    if (/(?:^|,)lit=true(?:,|$)/.test(props)) return LIT_EMISSIVE[id]
    return null
  }
  if (
    (id === 'candle' || id.endsWith('_candle') || id.endsWith('_candle_cake')) &&
    /(?:^|,)lit=true(?:,|$)/.test(props)
  )
    return { color: 0xffb85c, intensity: 1.6 }
  if (
    (id === 'cave_vines' || id === 'cave_vines_plant') &&
    /(?:^|,)berries=true(?:,|$)/.test(props)
  )
    return { color: 0xffcc66, intensity: 1.4 }
  if (id === 'respawn_anchor' && /(?:^|,)charges=[1-4](?:,|$)/.test(props))
    return { color: 0xb966ff, intensity: 1.45 }
  if (id === 'end_portal_frame' && /(?:^|,)eye=true(?:,|$)/.test(props))
    return { color: 0x7df7c8, intensity: 1.3 }
  return null
}

export interface EmissiveLightCluster {
  position: THREE.Vector3
  color: number
  intensity: number
  count: number
}

export interface EmissiveLayer {
  group: THREE.Group
  materials: THREE.MeshBasicMaterial[]
  clusters: EmissiveLightCluster[]
  blockCount: number
  dispose: () => void
}

/** Build a lightweight HDR emissive overlay mesh + spatial light clusters from a loaded schematic. */
export async function buildEmissiveLayer(
  schematic: Schematic,
  resources: Resources | null,
  colors: BlockColorMap | null,
  maxClusters = 6
): Promise<EmissiveLayer> {
  const paletteSpecs = schematic.palette.map((state) => emissiveInfo(state))
  const hasAny = paletteSpecs.some(Boolean)
  const group = new THREE.Group()
  group.name = 'cinematic-emissive'

  const map = resources?.texture ?? null
  const makeMat = (cutout: boolean): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({
      map,
      vertexColors: true,
      alphaTest: cutout ? 0.5 : 0,
      transparent: false,
      depthWrite: true,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    })
  const materials = [makeMat(false), makeMat(true), makeMat(false), makeMat(false)]

  if (!hasAny) {
    return {
      group,
      materials,
      clusters: [],
      blockCount: 0,
      dispose: () => materials.forEach((m) => m.dispose())
    }
  }

  const [sx, sy, sz] = schematic.size
  const [mx, my, mz] = schematic.min
  const filtered = new Uint16Array(schematic.data.length)
  // Cluster light sources into coarse 8-block cells so we pick representative warm/cool bounce lights
  const bucketMap = new Map<
    string,
    {
      x: number
      y: number
      z: number
      r: number
      g: number
      b: number
      weight: number
      count: number
    }
  >()
  let blockCount = 0

  for (let y = 0; y < sy; y++) {
    for (let z = 0; z < sz; z++) {
      const row = (y * sz + z) * sx
      for (let x = 0; x < sx; x++) {
        const idx = row + x
        const p = schematic.data[idx]
        const spec = p > 0 ? paletteSpecs[p] : null
        if (!spec) continue
        filtered[idx] = p
        blockCount++
        const bx = Math.floor(x / 8)
        const by = Math.floor(y / 8)
        const bz = Math.floor(z / 8)
        const key = `${bx}:${by}:${bz}`
        const existing = bucketMap.get(key) ?? {
          x: 0,
          y: 0,
          z: 0,
          r: 0,
          g: 0,
          b: 0,
          weight: 0,
          count: 0
        }
        const c = new THREE.Color(spec.color)
        existing.x += x + mx
        existing.y += y + my
        existing.z += z + mz
        existing.r += c.r * spec.intensity
        existing.g += c.g * spec.intensity
        existing.b += c.b * spec.intensity
        existing.weight += spec.intensity
        existing.count += 1
        bucketMap.set(key, existing)
      }
    }
  }

  if (blockCount > 0) {
    const subSchematic: Schematic = {
      size: [...schematic.size],
      min: [...schematic.min],
      palette: schematic.palette,
      data: filtered
    }
    const mesher = new Mesher(subSchematic, resources, colors)
    await mesher.build(group, materials)
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = false
        o.receiveShadow = false
      }
    })
  }

  const clusters: EmissiveLightCluster[] = [...bucketMap.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxClusters)
    .map((b) => {
      const avgColor = new THREE.Color(b.r / b.weight, b.g / b.weight, b.b / b.weight)
      return {
        position: new THREE.Vector3(b.x / b.count, b.y / b.count, b.z / b.count),
        color: avgColor.getHex(),
        intensity: Math.min(2.2, 0.8 + Math.log2(1 + b.count) * 0.45),
        count: b.count
      }
    })

  // Keep only opaque & cutout materials active; dispose helper cleans up all
  void OPAQUE
  void CUTOUT

  return {
    group,
    materials,
    clusters,
    blockCount,
    dispose: () => {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose()
      })
      group.removeFromParent()
      materials.forEach((m) => m.dispose())
    }
  }
}
