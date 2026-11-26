// Block color loader and lightweight texture-atlas UV table builder for Web Worker chunk meshing.
import { Identifier } from 'deepslate'
import {
  CUTOUT,
  LIQUID,
  OPAQUE,
  TRANSLUCENT,
  type Resources
} from '@/entities/viewer/lib/render/resources'
import { resourceUrl } from '@/shared/lib/urls'
import { FALLBACK_COLORS, type BlockAtlasMap, type Rgb } from '../model/colors'

export {
  BIOME_TINTS,
  FALLBACK_COLORS,
  type BlockAtlasMap,
  type BlockUvEntry,
  type Rgb
} from '../model/colors'

let cachedColors: Promise<Record<string, Rgb>> | null = null

/** Load engine-measured top block colors once and merge with fallback colors. */
export function loadWorldColors(): Promise<Record<string, Rgb>> {
  if (!cachedColors) {
    cachedColors = (async () => {
      const merged: Record<string, Rgb> = { ...FALLBACK_COLORS }
      try {
        const r = await fetch(resourceUrl('lib/mcb/data/block_colors.json'))
        if (r.ok) {
          const json = (await r.json()) as {
            colors?: Record<string, number[]>
            blocks?: Record<string, { top?: number[] }>
          }
          if (json.colors) {
            for (const [k, v] of Object.entries(json.colors)) {
              const short = k.replace(/^minecraft:/, '').split('[')[0]
              if (Array.isArray(v) && v.length >= 3 && !merged[short]) {
                merged[short] = [v[0], v[1], v[2]]
              }
            }
          }
          if (json.blocks) {
            for (const [k, v] of Object.entries(json.blocks)) {
              const short = k.replace(/^minecraft:/, '').split('[')[0]
              if (v?.top && v.top.length >= 3 && !merged[short]) {
                merged[short] = [v.top[0], v.top[1], v.top[2]]
              }
            }
          }
        }
      } catch {
        // Offline / kit fallback
      }
      return merged
    })()
  }
  return cachedColors
}

// Explicit texture overrides for multi-face natural blocks so 3D world chunks look authentic like BlueMap
const FACE_SPRITES: Record<
  string,
  { top: string; side: string; bottom: string; tintTop?: Rgb; tintSide?: Rgb }
> = {
  grass_block: {
    top: 'grass_block_top',
    side: 'grass_block_side',
    bottom: 'dirt',
    tintTop: [0.56, 0.74, 0.35]
  },
  podzol: { top: 'podzol_top', side: 'podzol_side', bottom: 'dirt' },
  mycelium: { top: 'mycelium_top', side: 'mycelium_side', bottom: 'dirt' },
  dirt_path: { top: 'dirt_path_top', side: 'dirt_path_side', bottom: 'dirt' },
  sandstone: { top: 'sandstone_top', side: 'sandstone', bottom: 'sandstone_bottom' },
  red_sandstone: {
    top: 'red_sandstone_top',
    side: 'red_sandstone',
    bottom: 'red_sandstone_bottom'
  },
  crimson_nylium: { top: 'crimson_nylium', side: 'crimson_nylium_side', bottom: 'netherrack' },
  warped_nylium: { top: 'warped_nylium', side: 'warped_nylium_side', bottom: 'netherrack' },
  basalt: { top: 'basalt_top', side: 'basalt_side', bottom: 'basalt_top' },
  polished_basalt: {
    top: 'polished_basalt_top',
    side: 'polished_basalt_side',
    bottom: 'polished_basalt_top'
  },
  deepslate: { top: 'deepslate_top', side: 'deepslate', bottom: 'deepslate_top' },
  water: {
    top: 'water_still',
    side: 'water_still',
    bottom: 'water_still',
    tintTop: [0.24, 0.5, 0.9],
    tintSide: [0.24, 0.5, 0.9]
  },
  lava: { top: 'lava_still', side: 'lava_still', bottom: 'lava_still' },
  snow: { top: 'snow', side: 'snow', bottom: 'snow' },
  snow_block: { top: 'snow', side: 'snow', bottom: 'snow' },
  cactus: { top: 'cactus_top', side: 'cactus_side', bottom: 'cactus_bottom' },
  pumpkin: { top: 'pumpkin_top', side: 'pumpkin_side', bottom: 'pumpkin_top' },
  melon: { top: 'melon_top', side: 'melon_side', bottom: 'melon_top' },
  hay_block: { top: 'hay_block_top', side: 'hay_block_side', bottom: 'hay_block_top' },
  tnt: { top: 'tnt_top', side: 'tnt_side', bottom: 'tnt_bottom' },
  crafting_table: { top: 'crafting_table_top', side: 'crafting_table_side', bottom: 'oak_planks' },
  furnace: { top: 'furnace_top', side: 'furnace_side', bottom: 'furnace_top' },
  quartz_block: {
    top: 'quartz_block_top',
    side: 'quartz_block_side',
    bottom: 'quartz_block_bottom'
  }
}

const LOG_WOODS = [
  'oak',
  'spruce',
  'birch',
  'jungle',
  'acacia',
  'dark_oak',
  'mangrove',
  'cherry',
  'pale_oak'
]
const LEAF_TINTS: Record<string, Rgb> = {
  oak_leaves: [0.45, 0.67, 0.22],
  spruce_leaves: [0.35, 0.56, 0.36],
  birch_leaves: [0.5, 0.68, 0.3],
  jungle_leaves: [0.28, 0.72, 0.16],
  acacia_leaves: [0.55, 0.66, 0.24],
  dark_oak_leaves: [0.34, 0.54, 0.2],
  mangrove_leaves: [0.44, 0.62, 0.23]
}

/** Extract a serializable block->UV lookup table from Builder Studio's loaded jar texture pack. */
export function buildBlockAtlasMap(
  res: Resources | null,
  knownBlocks: string[]
): BlockAtlasMap | null {
  if (!res) return null
  const missingUv = res.getTextureUV(Identifier.parse('minecraft:block/__missing__'))
  const lookup = (
    sprite: string
  ): { uv: [number, number, number, number]; bucket: number } | null => {
    const uv = res.getTextureUV(Identifier.parse(`minecraft:block/${sprite}`))
    if (
      uv[0] === missingUv[0] &&
      uv[1] === missingUv[1] &&
      uv[2] === missingUv[2] &&
      uv[3] === missingUv[3]
    ) {
      return null
    }
    const sp = res.spriteAt((uv[0] + uv[2]) / 2, (uv[1] + uv[3]) / 2)
    return { uv: [uv[0], uv[1], uv[2], uv[3]], bucket: sp.kind }
  }

  const out: BlockAtlasMap = {}
  const allNames = new Set([
    ...knownBlocks,
    ...Object.keys(FACE_SPRITES),
    ...Object.keys(LEAF_TINTS)
  ])
  for (const wood of LOG_WOODS) {
    allNames.add(`${wood}_log`)
    allNames.add(`stripped_${wood}_log`)
    allNames.add(`${wood}_leaves`)
    allNames.add(`${wood}_planks`)
  }

  for (const name of allNames) {
    const ov = FACE_SPRITES[name]
    if (ov) {
      const t = lookup(ov.top)
      const s = lookup(ov.side) ?? t
      const b = lookup(ov.bottom) ?? s
      if (t && s && b) {
        out[name] = {
          top: t.uv,
          side: s.uv,
          bottom: b.uv,
          bucket: name === 'water' ? LIQUID : t.bucket,
          tintTop: ov.tintTop,
          tintSide: ov.tintSide
        }
        continue
      }
    }

    // Logs & stems: <name>_top + <name>
    if (name.endsWith('_log') || name.endsWith('_stem') || name.endsWith('_pillar')) {
      const side = lookup(name)
      const top = lookup(`${name}_top`) ?? side
      if (side && top) {
        out[name] = { top: top.uv, side: side.uv, bottom: top.uv, bucket: OPAQUE }
        continue
      }
    }

    // Leaves: cutout + foliage tint
    if (name.endsWith('_leaves')) {
      const sp = lookup(name)
      if (sp) {
        const tint = LEAF_TINTS[name]
        out[name] = {
          top: sp.uv,
          side: sp.uv,
          bottom: sp.uv,
          bucket: CUTOUT,
          tintTop: tint,
          tintSide: tint
        }
        continue
      }
    }

    // Generic lookup: try exact name, then common suffixes (_top, _side, _planks for stairs/slabs/fences)
    const direct = lookup(name)
    if (direct) {
      const isGrassPlant =
        name === 'short_grass' ||
        name === 'tall_grass' ||
        name === 'fern' ||
        name === 'large_fern' ||
        name === 'vine' ||
        name === 'lily_pad'
      const tint: Rgb | undefined = isGrassPlant ? [0.52, 0.72, 0.32] : undefined
      out[name] = {
        top: direct.uv,
        side: direct.uv,
        bottom: direct.uv,
        bucket:
          name.includes('glass') && name.includes('stained')
            ? TRANSLUCENT
            : name.endsWith('ice')
              ? TRANSLUCENT
              : direct.bucket,
        tintTop: tint,
        tintSide: tint
      }
      continue
    }

    // Map stairs/slabs/walls/fences back to base material texture
    const base = name
      .replace(/_(stairs|slab|wall|fence|fence_gate|pressure_plate|button|trapdoor|door)$/, '')
      .replace(/^waxed_/, '')
    const baseSp =
      lookup(base) ?? lookup(`${base}s`) ?? lookup(`${base}_planks`) ?? lookup(`${base}_block`)
    if (baseSp) {
      out[name] = { top: baseSp.uv, side: baseSp.uv, bottom: baseSp.uv, bucket: baseSp.bucket }
    }
  }
  return out
}
