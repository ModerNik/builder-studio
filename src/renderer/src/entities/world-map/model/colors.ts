// Zero-dependency block color defaults, biome tints, and atlas UV types shared by main thread and Web Worker.
import {
  BIOME_BADLANDS,
  BIOME_CHERRY,
  BIOME_DARK_FOREST,
  BIOME_DESERT,
  BIOME_FOREST,
  BIOME_JUNGLE,
  BIOME_PLAINS,
  BIOME_SNOW,
  BIOME_SWAMP,
  BIOME_TAIGA
} from '@shared/world-tiles'

export type Rgb = [number, number, number]

export interface BiomeTint {
  grass: Rgb
  foliage: Rgb
  water: Rgb
}

export interface BlockUvEntry {
  top: [number, number, number, number]
  side: [number, number, number, number]
  bottom: [number, number, number, number]
  bucket: number
  tintTop?: Rgb
  tintSide?: Rgb
}

export type BlockAtlasMap = Record<string, BlockUvEntry>

export const BIOME_TINTS: Record<number, BiomeTint> = {
  [BIOME_PLAINS]: {
    grass: [0.56, 0.74, 0.35],
    foliage: [0.45, 0.67, 0.22],
    water: [0.22, 0.48, 0.85]
  },
  [BIOME_FOREST]: {
    grass: [0.47, 0.75, 0.35],
    foliage: [0.35, 0.68, 0.19],
    water: [0.21, 0.47, 0.84]
  },
  [BIOME_TAIGA]: {
    grass: [0.44, 0.63, 0.45],
    foliage: [0.35, 0.56, 0.36],
    water: [0.18, 0.42, 0.74]
  },
  [BIOME_SWAMP]: {
    grass: [0.42, 0.45, 0.23],
    foliage: [0.38, 0.44, 0.2],
    water: [0.35, 0.48, 0.41]
  },
  [BIOME_DESERT]: {
    grass: [0.75, 0.72, 0.33],
    foliage: [0.68, 0.65, 0.22],
    water: [0.25, 0.56, 0.84]
  },
  [BIOME_JUNGLE]: {
    grass: [0.35, 0.79, 0.24],
    foliage: [0.19, 0.73, 0.11],
    water: [0.18, 0.55, 0.86]
  },
  [BIOME_SNOW]: {
    grass: [0.5, 0.71, 0.59],
    foliage: [0.38, 0.63, 0.48],
    water: [0.22, 0.38, 0.72]
  },
  [BIOME_BADLANDS]: {
    grass: [0.57, 0.51, 0.3],
    foliage: [0.62, 0.5, 0.18],
    water: [0.26, 0.52, 0.8]
  },
  [BIOME_DARK_FOREST]: {
    grass: [0.31, 0.48, 0.2],
    foliage: [0.26, 0.46, 0.16],
    water: [0.2, 0.43, 0.78]
  },
  [BIOME_CHERRY]: {
    grass: [0.66, 0.85, 0.48],
    foliage: [0.95, 0.67, 0.78],
    water: [0.28, 0.56, 0.88]
  }
}

/** Fallback colours for common world blocks (used offline / in /kit or before block_colors.json loads). */
export const FALLBACK_COLORS: Record<string, Rgb> = {
  grass_block: [0.48, 0.69, 0.31],
  dirt: [0.53, 0.38, 0.26],
  coarse_dirt: [0.47, 0.33, 0.23],
  podzol: [0.48, 0.35, 0.22],
  mycelium: [0.44, 0.39, 0.43],
  dirt_path: [0.58, 0.47, 0.26],
  farmland: [0.43, 0.28, 0.17],
  stone: [0.49, 0.49, 0.5],
  cobblestone: [0.48, 0.48, 0.49],
  deepslate: [0.31, 0.31, 0.33],
  andesite: [0.53, 0.53, 0.54],
  diorite: [0.74, 0.74, 0.75],
  granite: [0.58, 0.42, 0.35],
  tuff: [0.42, 0.43, 0.4],
  calcite: [0.87, 0.87, 0.85],
  sand: [0.86, 0.81, 0.63],
  red_sand: [0.75, 0.4, 0.18],
  sandstone: [0.85, 0.79, 0.6],
  gravel: [0.52, 0.51, 0.5],
  clay: [0.62, 0.65, 0.7],
  snow: [0.95, 0.98, 0.99],
  snow_block: [0.95, 0.98, 0.99],
  powder_snow: [0.95, 0.98, 0.99],
  ice: [0.57, 0.72, 0.98],
  packed_ice: [0.55, 0.7, 0.97],
  blue_ice: [0.45, 0.66, 0.99],
  water: [0.22, 0.48, 0.85],
  lava: [0.92, 0.39, 0.11],
  oak_log: [0.42, 0.33, 0.21],
  spruce_log: [0.24, 0.16, 0.09],
  birch_log: [0.83, 0.82, 0.79],
  jungle_log: [0.34, 0.27, 0.15],
  acacia_log: [0.41, 0.38, 0.34],
  dark_oak_log: [0.23, 0.17, 0.1],
  cherry_log: [0.28, 0.16, 0.2],
  oak_planks: [0.64, 0.51, 0.31],
  spruce_planks: [0.45, 0.33, 0.19],
  oak_leaves: [0.32, 0.56, 0.2],
  spruce_leaves: [0.23, 0.39, 0.25],
  birch_leaves: [0.4, 0.6, 0.24],
  jungle_leaves: [0.22, 0.58, 0.14],
  acacia_leaves: [0.45, 0.56, 0.21],
  dark_oak_leaves: [0.24, 0.43, 0.16],
  cherry_leaves: [0.94, 0.66, 0.78],
  azalea_leaves: [0.39, 0.55, 0.21],
  flowering_azalea_leaves: [0.5, 0.53, 0.31],
  short_grass: [0.45, 0.67, 0.28],
  tall_grass: [0.45, 0.67, 0.28],
  fern: [0.4, 0.6, 0.25],
  terracotta: [0.6, 0.37, 0.27],
  red_terracotta: [0.56, 0.24, 0.18],
  orange_terracotta: [0.63, 0.33, 0.15],
  yellow_terracotta: [0.73, 0.52, 0.14],
  white_terracotta: [0.82, 0.7, 0.63],
  netherrack: [0.39, 0.15, 0.15],
  crimson_nylium: [0.52, 0.13, 0.18],
  warped_nylium: [0.17, 0.46, 0.43],
  soul_sand: [0.32, 0.24, 0.2],
  soul_soil: [0.29, 0.22, 0.18],
  basalt: [0.3, 0.3, 0.33],
  blackstone: [0.18, 0.16, 0.19],
  magma_block: [0.62, 0.26, 0.1],
  glowstone: [0.76, 0.63, 0.38],
  nether_bricks: [0.19, 0.1, 0.12],
  end_stone: [0.85, 0.85, 0.64],
  obsidian: [0.09, 0.06, 0.14],
  purpur_block: [0.66, 0.48, 0.66],
  bedrock: [0.33, 0.33, 0.34]
}
