// Procedural offline 3D Minecraft terrain source for the /kit specimen (no world save needed).
import {
  BIOME_FOREST,
  BIOME_PLAINS,
  BIOME_SNOW,
  encodeHiresChunk,
  encodeLowresTile,
  FLAG_FOLIAGE,
  FLAG_GRASS,
  FLAG_WATER,
  LOWRES_CELLS,
  LOWRES_GRID,
  LOWRES_STEP
} from '@shared/world-tiles'
import type { WorldDataSource } from '../model/types'

function sampleTerrain(
  wx: number,
  wz: number
): { y: number; water: boolean; sand: boolean; stone: boolean; snow: boolean } {
  const riverDist = Math.abs(wz - 14 * Math.sin(wx / 26) - 6)
  const riverCut = Math.exp(-(riverDist * riverDist) / 95) * 11
  const hills =
    Math.sin(wx / 22) * Math.cos(wz / 24) * 10 +
    Math.sin((wx + wz) / 42) * 8 +
    Math.cos(wx / 11) * Math.sin(wz / 13) * 2.5
  const h = Math.round(67 + hills - riverCut)
  const water = h < 63
  return {
    y: h,
    water,
    sand: !water && h <= 64,
    stone: h >= 78,
    snow: h >= 82
  }
}

function hasTreeAt(wx: number, wz: number): boolean {
  const hash = Math.abs(Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453) % 1
  if (hash < 0.988) return false
  const t = sampleTerrain(wx, wz)
  return !t.water && !t.sand && !t.stone && Math.hypot(wx, wz) > 14
}

/** Procedural rolling river-valley terrain for /kit interactive 3D world map specimens. */
export function createSyntheticWorldSource(): WorldDataSource {
  return {
    key: 'kit::synthetic',
    dimension: 'overworld',
    regions: [
      [-1, -1],
      [0, -1],
      [-1, 0],
      [0, 0]
    ],
    async fetchLowres(rx, rz) {
      const surfaceY = new Int16Array(LOWRES_CELLS)
      const oceanFloorY = new Int16Array(LOWRES_CELLS)
      const topBlock = new Uint16Array(LOWRES_CELLS)
      const flags = new Uint8Array(LOWRES_CELLS)
      const palette = [
        'minecraft:air',
        'minecraft:grass_block',
        'minecraft:sand',
        'minecraft:stone',
        'minecraft:snow_block',
        'minecraft:oak_leaves'
      ]
      const ox = rx * 512
      const oz = rz * 512

      for (let gz = 0; gz < LOWRES_GRID; gz++) {
        for (let gx = 0; gx < LOWRES_GRID; gx++) {
          const wx = ox + gx * LOWRES_STEP
          const wz = oz + gz * LOWRES_STEP
          const idx = gz * LOWRES_GRID + gx
          const t = sampleTerrain(wx, wz)
          if (t.water) {
            surfaceY[idx] = 63
            oceanFloorY[idx] = t.y
            topBlock[idx] = 2
            flags[idx] = (BIOME_PLAINS << 4) | FLAG_WATER
          } else if (t.snow) {
            surfaceY[idx] = t.y
            oceanFloorY[idx] = t.y
            topBlock[idx] = 4
            flags[idx] = BIOME_SNOW << 4
          } else if (t.stone) {
            surfaceY[idx] = t.y
            oceanFloorY[idx] = t.y
            topBlock[idx] = 3
            flags[idx] = BIOME_PLAINS << 4
          } else if (t.sand) {
            surfaceY[idx] = t.y
            oceanFloorY[idx] = t.y
            topBlock[idx] = 2
            flags[idx] = BIOME_PLAINS << 4
          } else if (hasTreeAt(wx, wz)) {
            surfaceY[idx] = t.y + 4
            oceanFloorY[idx] = t.y + 4
            topBlock[idx] = 5
            flags[idx] = (BIOME_FOREST << 4) | FLAG_FOLIAGE
          } else {
            surfaceY[idx] = t.y
            oceanFloorY[idx] = t.y
            topBlock[idx] = 1
            flags[idx] = (BIOME_FOREST << 4) | FLAG_GRASS
          }
        }
      }
      const bytes = encodeLowresTile({
        rx,
        rz,
        step: LOWRES_STEP,
        grid: LOWRES_GRID,
        palette,
        surfaceY,
        oceanFloorY,
        topBlock,
        flags
      })
      return new Uint8Array(bytes).buffer
    },
    async fetchHires(cx, cz) {
      const palette = [
        'minecraft:air',
        'minecraft:stone',
        'minecraft:dirt',
        'minecraft:grass_block',
        'minecraft:sand',
        'minecraft:water',
        'minecraft:snow_block',
        'minecraft:oak_log',
        'minecraft:oak_leaves'
      ]
      const minY = 50
      const height = 46
      const surfaceY = new Int16Array(256)
      const blocks = new Uint16Array(16 * height * 16)
      const set = (lx: number, wy: number, lz: number, id: number): void => {
        const ly = wy - minY
        if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || ly < 0 || ly >= height) return
        blocks[(ly << 8) | (lz << 4) | lx] = id
      }
      const ox = cx * 16
      const oz = cz * 16
      for (let lz = 0; lz < 16; lz++) {
        for (let lx = 0; lx < 16; lx++) {
          const wx = ox + lx
          const wz = oz + lz
          const t = sampleTerrain(wx, wz)
          const top = t.water ? 63 : t.y
          surfaceY[lz * 16 + lx] = top
          for (let wy = minY; wy <= t.y; wy++) {
            const id =
              wy === t.y
                ? t.snow
                  ? 6
                  : t.stone
                    ? 1
                    : t.sand || t.water
                      ? 4
                      : 3
                : wy >= t.y - 2 && !t.stone
                  ? 2
                  : 1
            set(lx, wy, lz, id)
          }
          if (t.water) {
            for (let wy = t.y + 1; wy <= 63; wy++) set(lx, wy, lz, 5)
          } else if (hasTreeAt(wx, wz)) {
            for (let ty = 1; ty <= 4; ty++) set(lx, t.y + ty, lz, 7)
            for (let dy = 3; dy <= 5; dy++) {
              const r = dy === 5 ? 1 : 2
              for (let dz = -r; dz <= r; dz++) {
                for (let dx = -r; dx <= r; dx++) {
                  if (Math.abs(dx) === r && Math.abs(dz) === r && dy > 3) continue
                  if (dx === 0 && dz === 0 && dy <= 4) continue
                  set(lx + dx, t.y + dy, lz + dz, 8)
                }
              }
            }
            surfaceY[lz * 16 + lx] = t.y + 5
          }
        }
      }
      const bytes = encodeHiresChunk({ cx, cz, minY, height, palette, surfaceY, blocks })
      return new Uint8Array(bytes).buffer
    }
  }
}
