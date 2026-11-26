import { deflateSync, gzipSync } from 'zlib'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { decodeHiresChunk, decodeLowresTile, FLAG_WATER, LOWRES_GRID } from '@shared/world-tiles'
import { inspectWorld, readHiresChunk, readLowresTile } from './world-reader'
import { readSiteMeta, saveSiteMeta, updateBuildOrigin } from './site-meta'

function makeTestNbtChunk(surfaceBlock: string, topY: number): Uint8Array {
  const parts: Uint8Array[] = []
  const b = (v: number): void => void parts.push(new Uint8Array([v & 0xff]))
  const s = (str: string): void => {
    const bytes = new TextEncoder().encode(str)
    const len = new Uint8Array(2)
    new DataView(len.buffer).setInt16(0, bytes.length)
    parts.push(len, bytes)
  }
  const i32 = (v: number): void => {
    const buf = new Uint8Array(4)
    new DataView(buf.buffer).setInt32(0, v)
    parts.push(buf)
  }
  const tag = (t: number, name: string): void => {
    b(t)
    s(name)
  }
  const packPadded = (vals: number[], bits: number): bigint[] => {
    const per = Math.floor(64 / bits)
    const out: bigint[] = []
    for (let i = 0; i < vals.length; i += per) {
      let word = 0n
      for (let k = 0; k < per && i + k < vals.length; k++)
        word |= BigInt(vals[i + k]) << BigInt(k * bits)
      out.push(word)
    }
    return out
  }
  const longArray = (name: string, longs: bigint[]): void => {
    tag(12, name)
    i32(longs.length)
    const buf = new Uint8Array(longs.length * 8)
    const v = new DataView(buf.buffer)
    longs.forEach((l, idx) => v.setBigInt64(idx * 8, BigInt.asIntN(64, l)))
    parts.push(buf)
  }

  tag(10, '')
  tag(3, 'DataVersion')
  i32(4189)
  tag(10, 'Heightmaps')
  longArray('WORLD_SURFACE', packPadded(new Array(256).fill(topY + 64 + 1), 9))
  longArray('OCEAN_FLOOR', packPadded(new Array(256).fill(topY - 2 + 64 + 1), 9))
  b(0)
  tag(9, 'sections')
  b(10)
  i32(1)
  tag(1, 'Y')
  b(topY >> 4)
  tag(10, 'block_states')
  tag(9, 'palette')
  b(10)
  i32(3)
  tag(8, 'Name')
  s('minecraft:air')
  b(0)
  tag(8, 'Name')
  s('minecraft:sand')
  b(0)
  tag(8, 'Name')
  s(surfaceBlock)
  b(0)
  const cells = new Array(4096).fill(0)
  const ly = topY & 15
  for (let z = 0; z < 16; z++) {
    for (let x = 0; x < 16; x++) {
      cells[(ly << 8) | (z << 4) | x] = 2
      if (ly >= 2) cells[((ly - 2) << 8) | (z << 4) | x] = 1
    }
  }
  longArray('data', packPadded(cells, 4))
  b(0) // end block_states
  b(0) // end section
  b(0) // end root

  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

function makeRegionFile(chunkBytes: Uint8Array): Uint8Array {
  const compressed = deflateSync(chunkBytes)
  const body = new Uint8Array(5 + compressed.length)
  new DataView(body.buffer).setUint32(0, compressed.length + 1)
  body[4] = 2
  body.set(compressed, 5)
  const sectors = Math.ceil(body.length / 4096)
  const out = new Uint8Array(8192 + sectors * 4096)
  out[2] = 2
  out[3] = sectors
  out.set(body, 8192)
  return out
}

function makeLevelDat(): Uint8Array {
  const parts: Uint8Array[] = []
  const b = (v: number): void => void parts.push(new Uint8Array([v & 0xff]))
  const s = (str: string): void => {
    const bytes = new TextEncoder().encode(str)
    const len = new Uint8Array(2)
    new DataView(len.buffer).setInt16(0, bytes.length)
    parts.push(len, bytes)
  }
  const i32 = (v: number): void => {
    const buf = new Uint8Array(4)
    new DataView(buf.buffer).setInt32(0, v)
    parts.push(buf)
  }
  const tag = (t: number, name: string): void => {
    b(t)
    s(name)
  }
  tag(10, '')
  tag(10, 'Data')
  tag(8, 'LevelName')
  s('Meadow Valley')
  tag(3, 'SpawnX')
  i32(16)
  tag(3, 'SpawnY')
  i32(68)
  tag(3, 'SpawnZ')
  i32(-24)
  b(0)
  b(0)
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return gzipSync(out)
}

const dirs: string[] = []

afterEach(async () => {
  while (dirs.length) {
    const d = dirs.pop()!
    await rm(d, { recursive: true, force: true })
  }
})

describe('world-reader & site-meta', () => {
  it('inspects world dimensions/spawn and extracts lowres + hires tiles without touching original save', async () => {
    const root = join(
      tmpdir(),
      `bs-world-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
    )
    dirs.push(root)
    const world = join(root, 'save')
    const cache = join(root, 'cache')
    await mkdir(join(world, 'region'), { recursive: true })
    await mkdir(join(world, 'DIM-1', 'region'), { recursive: true })

    const levelBytes = makeLevelDat()
    const regionBytes = makeRegionFile(makeTestNbtChunk('minecraft:water', 66))
    await writeFile(join(world, 'level.dat'), levelBytes)
    await writeFile(join(world, 'region', 'r.0.0.mca'), regionBytes)
    await writeFile(join(world, 'DIM-1', 'region', 'r.0.0.mca'), regionBytes)

    const info = await inspectWorld(world)
    expect(info.name).toBe('Meadow Valley')
    expect(info.spawn).toEqual([16, 68, -24])
    expect(info.dimensions).toEqual(['overworld', 'nether'])
    expect(info.regions.overworld).toEqual([[0, 0]])

    const lowBuf = await readLowresTile(world, 'overworld', 0, 0, cache)
    expect(lowBuf).not.toBeNull()
    const low = decodeLowresTile(new Uint8Array(lowBuf!).buffer)
    expect(low.grid).toBe(LOWRES_GRID)
    expect(low.surfaceY[0]).toBe(66)
    expect(low.oceanFloorY[0]).toBe(64)
    expect(low.flags[0] & FLAG_WATER).toBe(FLAG_WATER)

    const hiBuf = await readHiresChunk(world, 'overworld', 0, 0, cache)
    expect(hiBuf).not.toBeNull()
    const hi = decodeHiresChunk(new Uint8Array(hiBuf!).buffer)
    expect(hi.cx).toBe(0)
    expect(hi.cz).toBe(0)
    expect(hi.surfaceY[0]).toBe(66)
    expect(hi.palette).toContain('minecraft:water')

    // Original save files remain byte-for-byte untouched
    expect(await readFile(join(world, 'region', 'r.0.0.mca'))).toEqual(Buffer.from(regionBytes))
    expect(await readFile(join(world, 'level.dat'))).toEqual(Buffer.from(levelBytes))
  })

  it('slices off the solid Nether ceiling in hires chunks while keeping the cavern floor', async () => {
    const root = join(
      tmpdir(),
      `bs-nether-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
    )
    dirs.push(root)
    const world = join(root, 'save')
    const cache = join(root, 'cache')
    await mkdir(join(world, 'DIM-1', 'region'), { recursive: true })
    await writeFile(join(world, 'level.dat'), makeLevelDat())

    // Build a Nether chunk with a solid roof at Y=112..118 (sec 7), air at Y=48..111, floor at Y=40 (sec 2)
    const parts: Uint8Array[] = []
    const b = (v: number): void => void parts.push(new Uint8Array([v & 0xff]))
    const s = (str: string): void => {
      const bytes = new TextEncoder().encode(str)
      const len = new Uint8Array(2)
      new DataView(len.buffer).setInt16(0, bytes.length)
      parts.push(len, bytes)
    }
    const i32 = (v: number): void => {
      const buf = new Uint8Array(4)
      new DataView(buf.buffer).setInt32(0, v)
      parts.push(buf)
    }
    const tag = (t: number, name: string): void => {
      b(t)
      s(name)
    }
    tag(10, '')
    tag(3, 'DataVersion')
    i32(4189)
    tag(9, 'sections')
    b(10)
    i32(2)
    // Section Y=2 (y=32..47): uniform netherrack floor
    tag(1, 'Y')
    b(2)
    tag(10, 'block_states')
    tag(9, 'palette')
    b(10)
    i32(1)
    tag(8, 'Name')
    s('minecraft:netherrack')
    b(0)
    b(0)
    b(0)
    // Section Y=7 (y=112..127): uniform netherrack roof
    tag(1, 'Y')
    b(7)
    tag(10, 'block_states')
    tag(9, 'palette')
    b(10)
    i32(1)
    tag(8, 'Name')
    s('minecraft:netherrack')
    b(0)
    b(0)
    b(0)
    b(0)

    const total = parts.reduce((sum, p) => sum + p.length, 0)
    const chunkBytes = new Uint8Array(total)
    let off = 0
    for (const p of parts) {
      chunkBytes.set(p, off)
      off += p.length
    }

    await writeFile(join(world, 'DIM-1', 'region', 'r.0.0.mca'), makeRegionFile(chunkBytes))
    const hiBuf = await readHiresChunk(world, 'nether', 0, 0, cache)
    expect(hiBuf).not.toBeNull()
    const hi = decodeHiresChunk(new Uint8Array(hiBuf!).buffer)
    expect(hi.surfaceY[0]).toBe(47)
    // Roof at Y=115 must be cleared (air = 0), floor at Y=47 must remain solid
    const roofLy = 115 - hi.minY
    const floorLy = 47 - hi.minY
    expect(hi.blocks[(roofLy << 8) | 0]).toBe(0)
    expect(hi.blocks[(floorLy << 8) | 0]).toBeGreaterThan(0)
  })

  it('persists site.json and updates top-level ORIGIN in build.py while keeping inline comments', async () => {
    const ws = join(tmpdir(), `bs-meta-test-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    dirs.push(ws)
    await mkdir(join(ws, 'builds', 'keep'), { recursive: true })
    await writeFile(
      join(ws, 'builds', 'keep', 'build.py'),
      'FINAL_SUB = "Keep"\nORIGIN = (0, 0, 0)  # paste origin\nSIZE = (32, 24, 32)\n',
      'utf8'
    )

    const placement = {
      version: 1 as const,
      world: 'C:\\saves\\MyWorld',
      dimension: 'overworld' as const,
      mode: 'build' as const,
      box: [100, -50, 131, -19] as [number, number, number, number],
      origin: [100, 69, -50] as [number, number, number],
      rotation: 90 as const,
      margin: 48,
      ground: { min: 65, max: 71, median: 68 }
    }
    await saveSiteMeta(ws, 'keep', placement)
    expect(await readSiteMeta(ws, 'keep')).toEqual(placement)

    const updated = await updateBuildOrigin(ws, 'keep', [100, 69, -50])
    expect(updated).toBe(true)
    const src = await readFile(join(ws, 'builds', 'keep', 'build.py'), 'utf8')
    expect(src).toContain('ORIGIN = (100, 69, -50)  # paste origin')
  })

  it('reads singleplayer position and dimension from players/data/<uuid>.dat on 26.1+ saves', async () => {
    const root = join(
      tmpdir(),
      `bs-263-player-${Date.now()}-${Math.random().toString(16).slice(2)}`
    )
    dirs.push(root)
    const world = join(root, 'save')
    await mkdir(join(world, 'dimensions', 'minecraft', 'overworld', 'region'), { recursive: true })
    await mkdir(join(world, 'players', 'data'), { recursive: true })

    const encodeNbt = (build: (ops: {
      b: (v: number) => void
      s: (v: string) => void
      i32: (v: number) => void
      f64: (v: number) => void
      tag: (t: number, name: string) => void
    }) => void): Uint8Array => {
      const parts: Uint8Array[] = []
      const b = (v: number): void => void parts.push(new Uint8Array([v & 0xff]))
      const s = (str: string): void => {
        const bytes = new TextEncoder().encode(str)
        const len = new Uint8Array(2)
        new DataView(len.buffer).setInt16(0, bytes.length)
        parts.push(len, bytes)
      }
      const i32 = (v: number): void => {
        const buf = new Uint8Array(4)
        new DataView(buf.buffer).setInt32(0, v)
        parts.push(buf)
      }
      const f64 = (v: number): void => {
        const buf = new Uint8Array(8)
        new DataView(buf.buffer).setFloat64(0, v)
        parts.push(buf)
      }
      const tag = (t: number, name: string): void => {
        b(t)
        s(name)
      }
      build({ b, s, i32, f64, tag })
      const total = parts.reduce((sum, p) => sum + p.length, 0)
      const out = new Uint8Array(total)
      let off = 0
      for (const p of parts) {
        out.set(p, off)
        off += p.length
      }
      return gzipSync(out)
    }

    // UUID: 5cf79ec3-f9c7-40a9-8d58-f1f1c980d966
    const uuidInts = [1559731907, -104382295, -1923550735, -914302618]
    const levelDat = encodeNbt(({ b, s, i32, tag }) => {
      tag(10, '')
      tag(10, 'Data')
      tag(8, 'LevelName')
      s('Modern 26.3 World')
      tag(3, 'DataVersion')
      i32(5023)
      tag(11, 'singleplayer_uuid')
      i32(4)
      for (const n of uuidInts) i32(n)
      b(0)
      b(0)
    })
    const playerDat = encodeNbt(({ b, s, i32, f64, tag }) => {
      tag(10, '')
      tag(9, 'Pos')
      b(6)
      i32(3)
      f64(205.87)
      f64(22.49)
      f64(-4836.5)
      tag(8, 'Dimension')
      s('minecraft:overworld')
      b(0)
    })

    await writeFile(join(world, 'level.dat'), levelDat)
    await writeFile(
      join(world, 'players', 'data', '5cf79ec3-f9c7-40a9-8d58-f1f1c980d966.dat'),
      playerDat
    )
    await writeFile(
      join(world, 'dimensions', 'minecraft', 'overworld', 'region', 'r.0.0.mca'),
      makeRegionFile(makeTestNbtChunk('minecraft:grass_block', 64))
    )

    const info = await inspectWorld(world)
    expect(info.name).toBe('Modern 26.3 World')
    expect(info.player).toEqual([206, 22, -4836])
    expect(info.playerDimension).toBe('overworld')
    expect(info.dimensions).toEqual(['overworld'])
  })

  it('allows world:// fetches in the renderer Content-Security-Policy', async () => {
    const html = await readFile(join(process.cwd(), 'src', 'renderer', 'index.html'), 'utf8')
    const csp = /http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/s.exec(html)?.[1]
    expect(csp).toBeTruthy()
    const connectSrc = /connect-src\s+([^;]+)/.exec(csp!)?.[1] ?? ''
    expect(connectSrc).toContain('world:')
    expect(connectSrc).toContain('build:')
    expect(connectSrc).toContain('mcpack:')
  })
})
