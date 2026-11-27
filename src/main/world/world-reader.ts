// Read-only Minecraft Java world inspector and dual-LOD binary tile extractor.
// Never opens live saves for writing: copies region files to <cache>/world-cache/ on mtime/size change.
import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'fs/promises'
import { basename, dirname, join } from 'path'
import type { WorldDimension, WorldInfo } from '@shared/api'
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
  BIOME_TAIGA,
  encodeHiresChunk,
  encodeLowresTile,
  FLAG_FOLIAGE,
  FLAG_GRASS,
  FLAG_LAVA,
  FLAG_WATER,
  LOWRES_CELLS,
  LOWRES_GRID,
  LOWRES_STEP,
  NO_HEIGHT
} from '@shared/world-tiles'
import {
  extractLazySections,
  lazyBlockNameAt,
  parseGzippedNbt,
  readChunkBiome,
  readHeightmap,
  readRegionChunk,
  unpackLazySection,
  type LazySection,
  type NbtCompound,
  type NbtTag
} from './nbt'

const AIR_RE = /^(?:minecraft:)?(?:air|cave_air|void_air)$/
const WATER_RE =
  /^(?:minecraft:)?(?:water|bubble_column|kelp|kelp_plant|seagrass|tall_seagrass)(?:\[|$)/
const LAVA_RE = /^(?:minecraft:)?lava(?:\[|$)/
const LEAVES_RE = /^(?:minecraft:)?[a-z0-9_]*leaves(?:\[|$)/
const GRASS_RE =
  /^(?:minecraft:)?(?:grass_block|short_grass|tall_grass|fern|large_fern|sugar_cane|vine|lily_pad)(?:\[|$)/

const REGION_RE = /^r\.(-?\d+)\.(-?\d+)\.mca$/

function isAir(state: string): boolean {
  return AIR_RE.test(state)
}

function stripProps(state: string): string {
  const i = state.indexOf('[')
  return i >= 0 ? state.slice(0, i) : state
}

function biomePreset(biome: string | null): number {
  if (!biome) return BIOME_PLAINS
  const b = biome.replace(/^minecraft:/, '')
  if (b.includes('cherry')) return BIOME_CHERRY
  if (b.includes('swamp') || b.includes('mangrove')) return BIOME_SWAMP
  if (b.includes('jungle') || b.includes('bamboo')) return BIOME_JUNGLE
  if (b.includes('dark_forest') || b.includes('pale_garden')) return BIOME_DARK_FOREST
  if (b.includes('badlands') || b.includes('eroded')) return BIOME_BADLANDS
  if (b.includes('desert') || b.includes('savanna')) return BIOME_DESERT
  if (b.includes('snow') || b.includes('ice') || b.includes('frozen') || b.includes('peaks'))
    return BIOME_SNOW
  if (b.includes('taiga') || b.includes('grove') || b.includes('spruce') || b.includes('windswept'))
    return BIOME_TAIGA
  if (b.includes('forest') || b.includes('birch')) return BIOME_FOREST
  return BIOME_PLAINS
}

/** Resolve the region directory for a dimension, supporting both pre-26.1 and 26.1+ layouts. */
export function resolveRegionDir(worldPath: string, dim: WorldDimension): string | null {
  const candidates: Record<WorldDimension, string[]> = {
    overworld: [
      join(worldPath, 'dimensions', 'minecraft', 'overworld', 'region'),
      join(worldPath, 'region')
    ],
    nether: [
      join(worldPath, 'dimensions', 'minecraft', 'the_nether', 'region'),
      join(worldPath, 'DIM-1', 'region')
    ],
    end: [
      join(worldPath, 'dimensions', 'minecraft', 'the_end', 'region'),
      join(worldPath, 'DIM1', 'region')
    ]
  }
  for (const dir of candidates[dim]) {
    if (existsSync(dir)) return dir
  }
  return null
}

function parseDimensionTag(tag: NbtTag | undefined): WorldDimension | null {
  if (typeof tag === 'number') {
    if (tag === 0) return 'overworld'
    if (tag === -1) return 'nether'
    if (tag === 1) return 'end'
    return null
  }
  if (typeof tag === 'string') {
    if (tag.includes('nether')) return 'nether'
    if (tag.includes('end')) return 'end'
    if (tag.includes('overworld')) return 'overworld'
  }
  return null
}

function formatUuidInts(ints: Int32Array): string | null {
  if (ints.length !== 4) return null
  const hex = Array.from(ints, (n) => (n >>> 0).toString(16).padStart(8, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function extractPlayerLocation(p: NbtCompound): {
  player: [number, number, number] | null
  playerDimension: WorldDimension | null
} {
  let player: [number, number, number] | null = null
  const pos = p.Pos as NbtTag[] | undefined
  if (Array.isArray(pos) && pos.length >= 3) {
    player = [Math.round(Number(pos[0])), Math.round(Number(pos[1])), Math.round(Number(pos[2]))]
  }
  return { player, playerDimension: parseDimensionTag(p.Dimension) }
}

/** Read level.dat (read-only) and list non-empty region coordinates for every available dimension. */
export async function inspectWorld(worldPath: string): Promise<WorldInfo> {
  const levelPath = join(worldPath, 'level.dat')
  if (!existsSync(levelPath)) {
    throw new Error(`Not a Minecraft world folder (missing level.dat): ${worldPath}`)
  }

  let name = basename(worldPath)
  let dataVersion: number | null = null
  let spawn: [number, number, number] | null = null
  let player: [number, number, number] | null = null
  let playerDimension: WorldDimension | null = null

  try {
    const raw = await readFile(levelPath)
    const root = parseGzippedNbt(raw)
    const data = (root.Data as NbtCompound | undefined) ?? root
    if (typeof data.LevelName === 'string' && data.LevelName.trim()) name = data.LevelName
    if (typeof data.DataVersion === 'number') dataVersion = data.DataVersion

    // Spawn: 1.21.9+ uses Data.spawn.pos; earlier uses SpawnX/SpawnY/SpawnZ
    const modernSpawn = data.spawn as NbtCompound | undefined
    if (modernSpawn?.pos instanceof Int32Array && modernSpawn.pos.length >= 3) {
      spawn = [modernSpawn.pos[0], modernSpawn.pos[1], modernSpawn.pos[2]]
    } else if (
      typeof data.SpawnX === 'number' &&
      typeof data.SpawnY === 'number' &&
      typeof data.SpawnZ === 'number'
    ) {
      spawn = [Math.round(data.SpawnX), Math.round(data.SpawnY), Math.round(data.SpawnZ)]
    }

    const p = data.Player as NbtCompound | undefined
    if (p) {
      const loc = extractPlayerLocation(p)
      player = loc.player
      playerDimension = loc.playerDimension
    } else if (data.singleplayer_uuid instanceof Int32Array) {
      // Minecraft 26.1+ stores singleplayer data under players/data/<uuid>.dat
      const uuid = formatUuidInts(data.singleplayer_uuid)
      if (uuid) {
        const candidates = [
          join(worldPath, 'players', 'data', `${uuid}.dat`),
          join(worldPath, 'playerdata', `${uuid}.dat`)
        ]
        for (const pFile of candidates) {
          if (!existsSync(pFile)) continue
          try {
            const pRoot = parseGzippedNbt(await readFile(pFile))
            const loc = extractPlayerLocation(pRoot)
            player = loc.player
            playerDimension = loc.playerDimension
            break
          } catch {
            // Ignore unreadable player data file
          }
        }
      }
    }
  } catch {
    // Allow worlds with minimal/stub level.dat (such as fixtures) to still map their regions
  }

  const regions: Record<WorldDimension, [number, number][]> = {
    overworld: [],
    nether: [],
    end: []
  }
  const dimensions: WorldDimension[] = []

  for (const dim of ['overworld', 'nether', 'end'] as const) {
    const dir = resolveRegionDir(worldPath, dim)
    if (!dir) continue
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    const coords: [number, number][] = []
    for (const e of entries) {
      if (!e.isFile()) continue
      const m = REGION_RE.exec(e.name)
      if (!m) continue
      const st = await stat(join(dir, e.name)).catch(() => null)
      if (st && st.size > 0) coords.push([parseInt(m[1], 10), parseInt(m[2], 10)])
    }
    if (coords.length > 0) {
      coords.sort((a, b) => a[0] - b[0] || a[1] - b[1])
      regions[dim] = coords
      dimensions.push(dim)
    }
  }

  return { name, path: worldPath, dataVersion, spawn, player, playerDimension, dimensions, regions }
}

function worldCacheKey(worldPath: string): string {
  return createHash('sha1').update(worldPath).digest('hex').slice(0, 16)
}

// In-memory LRU of copied region file bytes for fast hires chunk reads, capped by size (region files vary 1-10 MB)
const REGION_MEM_BYTES = 48 * 1024 * 1024
const regionMem = new Map<string, { stamp: string; bytes: Uint8Array }>()
let regionMemBytes = 0
const copyInflight = new Map<string, Promise<{ stamp: string; path: string } | null>>()
const lowresInflight = new Map<string, Promise<Uint8Array | null>>()

async function writeFileAtomic(dst: string, data: Uint8Array | string): Promise<void> {
  const tmp = `${dst}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`
  try {
    await writeFile(tmp, data)
    await rename(tmp, dst)
  } catch (err) {
    await unlink(tmp).catch(() => {})
    throw err
  }
}

/** Ensure an up-to-date read-only copy of r.<rx>.<rz>.mca exists in cacheRoot and return its path + stamp. */
export async function ensureRegionSnapshot(
  worldPath: string,
  dim: WorldDimension,
  rx: number,
  rz: number,
  cacheRoot: string
): Promise<{ stamp: string; path: string } | null> {
  const rdir = resolveRegionDir(worldPath, dim)
  if (!rdir) return null
  const fileName = `r.${rx}.${rz}.mca`
  const src = join(rdir, fileName)
  const srcStat = await stat(src).catch(() => null)
  if (!srcStat || srcStat.size === 0) return null

  const stamp = `${Math.trunc(srcStat.mtimeMs)}_${srcStat.size}`
  const dir = join(cacheRoot, 'world-cache', worldCacheKey(worldPath), dim)
  const dst = join(dir, fileName)
  const metaPath = `${dst}.stamp`

  const existing = copyInflight.get(dst)
  if (existing) return existing

  const task = (async () => {
    const cachedStamp = await readFile(metaPath, 'utf8').catch(() => '')
    if (cachedStamp === stamp && existsSync(dst)) {
      return { stamp, path: dst }
    }
    await mkdir(dir, { recursive: true })
    const tmp = `${dst}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`
    try {
      await copyFile(src, tmp)
      await rename(tmp, dst)
    } catch (err) {
      await unlink(tmp).catch(() => {})
      throw err
    }
    await writeFileAtomic(metaPath, stamp)
    return { stamp, path: dst }
  })()

  copyInflight.set(dst, task)
  try {
    return await task
  } finally {
    copyInflight.delete(dst)
  }
}

/** `remember` = false for one-shot reads (lowres tile builds are disk-cached), so they don't evict hires regions. */
async function loadRegionBytes(
  worldPath: string,
  dim: WorldDimension,
  rx: number,
  rz: number,
  cacheRoot: string,
  remember = true
): Promise<{ stamp: string; bytes: Uint8Array } | null> {
  const snap = await ensureRegionSnapshot(worldPath, dim, rx, rz, cacheRoot)
  if (!snap) return null
  const cached = regionMem.get(snap.path)
  if (cached && cached.stamp === snap.stamp) {
    // Refresh LRU order
    regionMem.delete(snap.path)
    regionMem.set(snap.path, cached)
    return cached
  }
  const bytes = new Uint8Array(await readFile(snap.path))
  const entry = { stamp: snap.stamp, bytes }
  if (!remember) return entry
  const replaced = regionMem.get(snap.path)
  if (replaced) regionMemBytes -= replaced.bytes.byteLength
  regionMem.delete(snap.path)
  regionMem.set(snap.path, entry)
  regionMemBytes += bytes.byteLength
  for (const [key, old] of regionMem) {
    if (regionMemBytes <= REGION_MEM_BYTES || regionMem.size <= 1) break
    regionMem.delete(key)
    regionMemBytes -= old.bytes.byteLength
  }
  return entry
}

function scanColumnDownLazy(
  bySecY: Map<number, LazySection>,
  lx: number,
  lz: number,
  startY: number,
  minY: number
): { y: number; name: string } | null {
  for (let y = startY; y >= minY; y--) {
    const sec = bySecY.get(y >> 4)
    if (!sec) {
      y = y & ~15 // skip whole missing section
      continue
    }
    const name = lazyBlockNameAt(sec, lx, y & 15, lz)
    if (!isAir(name)) return { y, name }
  }
  return null
}

/** Delete `r.X.Z.mca.<stamp>.wlo` tiles of the same region other than `current` (each region edit leaves one behind). */
async function removeStaleTiles(current: string): Promise<void> {
  const dir = dirname(current)
  const prefix = basename(current).replace(/\.[^.]+\.wlo$/, '.')
  const names = await readdir(dir)
  await Promise.all(
    names
      .filter((n) => n.startsWith(prefix) && n.endsWith('.wlo') && join(dir, n) !== current)
      .map((n) => unlink(join(dir, n)).catch(() => {}))
  )
}

/** Build or read disk-cached LOD-1 binary lowres region tile (256x256 cells covering 512x512 blocks). */
export async function readLowresTile(
  worldPath: string,
  dim: WorldDimension,
  rx: number,
  rz: number,
  cacheRoot: string
): Promise<Uint8Array | null> {
  const snap = await ensureRegionSnapshot(worldPath, dim, rx, rz, cacheRoot)
  if (!snap) return null

  const tilePath = `${snap.path}.${snap.stamp}.wlo`
  if (existsSync(tilePath)) {
    return new Uint8Array(await readFile(tilePath))
  }
  const inflight = lowresInflight.get(tilePath)
  if (inflight) return inflight

  const task = (async (): Promise<Uint8Array | null> => {
    const loaded = await loadRegionBytes(worldPath, dim, rx, rz, cacheRoot, false)
    if (!loaded) return null
    const region = loaded.bytes

    const surfaceY = new Int16Array(LOWRES_CELLS).fill(NO_HEIGHT)
    const oceanFloorY = new Int16Array(LOWRES_CELLS).fill(NO_HEIGHT)
    const topBlock = new Uint16Array(LOWRES_CELLS)
    const flags = new Uint8Array(LOWRES_CELLS)
    const palMap = new Map<string, number>([['minecraft:air', 0]])
    const palette = ['minecraft:air']

    const intern = (raw: string): number => {
      const clean = stripProps(raw)
      let id = palMap.get(clean)
      if (id === undefined) {
        id = palette.length
        palette.push(clean)
        palMap.set(clean, id)
      }
      return id
    }

    const nether = dim === 'nether'

    for (let lcz = 0; lcz < 32; lcz++) {
      for (let lcx = 0; lcx < 32; lcx++) {
        const chunk = readRegionChunk(region, lcx, lcz, true)
        if (!chunk) continue
        const sections = extractLazySections(chunk)
        if (!sections.length) continue

        const bySecY = new Map<number, LazySection>()
        let secMinY = 320
        let secMaxY = -64
        for (const s of sections) {
          bySecY.set(s.sectionY, s)
          secMinY = Math.min(secMinY, s.sectionY * 16)
          secMaxY = Math.max(secMaxY, s.sectionY * 16 + 15)
        }

        const wsHm = nether ? null : readHeightmap(chunk, 'WORLD_SURFACE')
        const ofHm = nether ? null : readHeightmap(chunk, 'OCEAN_FLOOR')
        const bPreset = biomePreset(readChunkBiome(chunk)) << 4

        // Sample 8x8 cells per chunk (step = 2 blocks) using O(1) direct bit-packed reads
        for (let dz = 0; dz < 16; dz += LOWRES_STEP) {
          for (let dx = 0; dx < 16; dx += LOWRES_STEP) {
            const gx = (lcx * 16 + dx) / LOWRES_STEP
            const gz = (lcz * 16 + dz) / LOWRES_STEP
            const cellIdx = gz * LOWRES_GRID + gx

            let y = NO_HEIGHT
            let state = 'minecraft:air'
            let floorY = NO_HEIGHT
            let floorState = 'minecraft:air'

            if (nether) {
              // Slice off Nether bedrock roof: scan down from the first open air pocket below Y=118
              let scanStart = Math.min(118, secMaxY)
              while (scanStart > 28) {
                const sec = bySecY.get(scanStart >> 4)
                if (!sec || isAir(lazyBlockNameAt(sec, dx, scanStart & 15, dz))) break
                scanStart--
              }
              const hit = scanColumnDownLazy(bySecY, dx, dz, scanStart, Math.max(0, secMinY))
              if (hit) {
                y = hit.y
                state = hit.name
                floorY = hit.y
                floorState = hit.name
              }
            } else {
              const hmY = wsHm ? wsHm[dz * 16 + dx] : NO_HEIGHT
              if (wsHm && hmY >= secMinY && hmY <= secMaxY) {
                const sec = bySecY.get(hmY >> 4)
                const st = sec ? lazyBlockNameAt(sec, dx, hmY & 15, dz) : 'minecraft:air'
                if (!isAir(st)) {
                  y = hmY
                  state = st
                }
              }
              if (y === NO_HEIGHT) {
                const hit = scanColumnDownLazy(bySecY, dx, dz, secMaxY, secMinY)
                if (hit) {
                  y = hit.y
                  state = hit.name
                }
              }
              if (y !== NO_HEIGHT) {
                floorY = y
                floorState = state
                if (WATER_RE.test(state)) {
                  const candidate = ofHm ? ofHm[dz * 16 + dx] : NO_HEIGHT
                  if (candidate >= secMinY && candidate < y) {
                    const fSec = bySecY.get(candidate >> 4)
                    const fSt = fSec
                      ? lazyBlockNameAt(fSec, dx, candidate & 15, dz)
                      : 'minecraft:sand'
                    floorY = candidate
                    floorState = !isAir(fSt) && !WATER_RE.test(fSt) ? fSt : 'minecraft:sand'
                  } else {
                    floorY = Math.max(secMinY, y - 4)
                    floorState = 'minecraft:sand'
                  }
                }
              }
            }

            if (y === NO_HEIGHT) continue
            surfaceY[cellIdx] = y
            oceanFloorY[cellIdx] = floorY

            let fl = bPreset
            if (WATER_RE.test(state)) {
              fl |= FLAG_WATER
              topBlock[cellIdx] = intern(floorState)
            } else {
              if (LAVA_RE.test(state)) fl |= FLAG_LAVA
              else if (LEAVES_RE.test(state)) fl |= FLAG_FOLIAGE
              else if (GRASS_RE.test(state)) fl |= FLAG_GRASS
              topBlock[cellIdx] = intern(state)
            }
            flags[cellIdx] = fl
          }
        }
      }
    }

    const encoded = encodeLowresTile({
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
    // Cache atomically without failing the response if disk write errors, then drop tiles of older region stamps
    void writeFileAtomic(tilePath, encoded)
      .then(() => removeStaleTiles(tilePath))
      .catch(() => {})
    return encoded
  })()

  lowresInflight.set(tilePath, task)
  try {
    return await task
  } finally {
    lowresInflight.delete(tilePath)
  }
}

/** Extract a LOD-0 hires 16x16 chunk's exposed vertical block band as a compact binary buffer. */
export async function readHiresChunk(
  worldPath: string,
  dim: WorldDimension,
  cx: number,
  cz: number,
  cacheRoot: string
): Promise<Uint8Array | null> {
  const rx = cx >> 5
  const rz = cz >> 5
  const loaded = await loadRegionBytes(worldPath, dim, rx, rz, cacheRoot)
  if (!loaded) return null

  const chunk = readRegionChunk(loaded.bytes, cx & 31, cz & 31, true)
  if (!chunk) return null
  const lazySections = extractLazySections(chunk)
  if (!lazySections.length) return null

  const bySecY = new Map<number, LazySection>()
  let chunkBot = 320
  let chunkTop = -64
  for (const s of lazySections) {
    bySecY.set(s.sectionY, s)
    chunkBot = Math.min(chunkBot, s.sectionY * 16)
    chunkTop = Math.max(chunkTop, s.sectionY * 16 + 15)
  }

  const nether = dim === 'nether'
  const surfaceY = new Int16Array(256).fill(NO_HEIGHT)
  const roofCut = nether ? new Int16Array(256).fill(NO_HEIGHT) : null
  let minBandY = chunkTop
  let maxBandY = chunkBot

  if (nether) {
    // Open Nether view: slice off bedrock roof above Y=118, include lava sea down to Y=24
    minBandY = Math.max(chunkBot, 24)
    maxBandY = Math.min(chunkTop, 118)
    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        let scanStart = maxBandY
        while (scanStart > minBandY) {
          const sec = bySecY.get(scanStart >> 4)
          if (!sec || isAir(lazyBlockNameAt(sec, lx, scanStart & 15, lz))) break
          scanStart--
        }
        roofCut![lz * 16 + lx] = scanStart
        const hit = scanColumnDownLazy(bySecY, lx, lz, scanStart, minBandY)
        if (hit) surfaceY[lz * 16 + lx] = hit.y
      }
    }
  } else {
    const wsHm = readHeightmap(chunk, 'WORLD_SURFACE')
    const ofHm = readHeightmap(chunk, 'OCEAN_FLOOR')
    let any = false
    for (let i = 0; i < 256; i++) {
      const ws = wsHm ? wsHm[i] : NO_HEIGHT
      const of = ofHm ? ofHm[i] : ws
      if (ws >= chunkBot && ws <= chunkTop) {
        surfaceY[i] = ws
        maxBandY = Math.max(maxBandY, ws)
        const floor = of >= chunkBot && of <= ws ? of : ws
        minBandY = Math.min(minBandY, floor)
        any = true
      }
    }
    if (!any) {
      // Fallback scan for legacy/custom chunks lacking valid heightmaps
      for (let lz = 0; lz < 16; lz++) {
        for (let lx = 0; lx < 16; lx++) {
          const hit = scanColumnDownLazy(bySecY, lx, lz, chunkTop, chunkBot)
          if (hit) {
            surfaceY[lz * 16 + lx] = hit.y
            minBandY = Math.min(minBandY, hit.y)
            maxBandY = Math.max(maxBandY, hit.y)
            any = true
          }
        }
      }
    }
    if (!any) return null
    // Include skirt below lowest surface/seabed for cliffs & overhangs, trimmed to reduce underground quads
    minBandY = Math.max(chunkBot, minBandY - 6)
    maxBandY = Math.min(chunkTop, maxBandY + 1)
  }

  if (maxBandY < minBandY) return null
  const height = Math.min(192, maxBandY - minBandY + 1)
  const minY = maxBandY - height + 1

  const palMap = new Map<string, number>([['minecraft:air', 0]])
  const palette = ['minecraft:air']
  const blocks = new Uint16Array(16 * height * 16)

  for (const lazySec of lazySections) {
    const sy0 = lazySec.sectionY * 16
    const sy1 = sy0 + 15
    if (sy1 < minY || sy0 > maxBandY) continue

    // Only unpack sections that actually overlap the visible vertical band
    const sec = unpackLazySection(lazySec)

    // Map this section's local palette into the chunk's unified palette
    const lut = new Uint16Array(sec.palette.length)
    for (let p = 0; p < sec.palette.length; p++) {
      const st = sec.palette[p]
      if (isAir(st)) {
        lut[p] = 0
        continue
      }
      let id = palMap.get(st)
      if (id === undefined) {
        id = palette.length
        palette.push(st)
        palMap.set(st, id)
      }
      lut[p] = id
    }

    const yStart = Math.max(minY, sy0)
    const yEnd = Math.min(maxBandY, sy1)
    if (!sec.indices) {
      const uniform = lut[0]
      if (uniform === 0) continue
      for (let y = yStart; y <= yEnd; y++) {
        const base = (y - minY) * 256
        if (!roofCut) {
          blocks.fill(uniform, base, base + 256)
        } else {
          for (let i = 0; i < 256; i++) {
            if (y <= roofCut[i]) blocks[base + i] = uniform
          }
        }
      }
      continue
    }

    for (let y = yStart; y <= yEnd; y++) {
      const srcBase = (y - sy0) * 256
      const dstBase = (y - minY) * 256
      for (let i = 0; i < 256; i++) {
        if (roofCut && y > roofCut[i]) continue
        const v = lut[sec.indices[srcBase + i]]
        if (v !== 0) blocks[dstBase + i] = v
      }
    }
  }

  return encodeHiresChunk({ cx, cz, minY, height, palette, surfaceY, blocks })
}
