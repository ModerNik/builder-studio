import { deflateSync, gzipSync } from 'zlib'
import { describe, expect, it } from 'vitest'
import {
  decodeChunkSections,
  formatBlockState,
  parseGzippedNbt,
  parseNbt,
  readHeightmap,
  readRegionChunk,
  unpackLongs
} from './nbt'

/** Minimal NBT writer for building test fixtures (modern, flattened, legacy chunks & level.dat). */
class NbtWriter {
  private chunks: Uint8Array[] = []
  private push(b: Uint8Array): void {
    this.chunks.push(b)
  }
  byte(v: number): void {
    this.push(new Uint8Array([v & 0xff]))
  }
  short(v: number): void {
    const b = new Uint8Array(2)
    new DataView(b.buffer).setInt16(0, v)
    this.push(b)
  }
  int(v: number): void {
    const b = new Uint8Array(4)
    new DataView(b.buffer).setInt32(0, v)
    this.push(b)
  }
  double(v: number): void {
    const b = new Uint8Array(8)
    new DataView(b.buffer).setFloat64(0, v)
    this.push(b)
  }
  str(s: string): void {
    const bytes = new TextEncoder().encode(s)
    this.short(bytes.length)
    this.push(bytes)
  }
  tag(type: number, name: string): void {
    this.byte(type)
    this.str(name)
  }
  longArray(name: string, longs: bigint[]): void {
    this.tag(12, name)
    this.int(longs.length)
    const b = new Uint8Array(longs.length * 8)
    const v = new DataView(b.buffer)
    longs.forEach((val, i) => v.setBigInt64(i * 8, BigInt.asIntN(64, val)))
    this.push(b)
  }
  intArray(name: string, ints: number[]): void {
    this.tag(11, name)
    this.int(ints.length)
    const b = new Uint8Array(ints.length * 4)
    const v = new DataView(b.buffer)
    ints.forEach((val, i) => v.setInt32(i * 4, val))
    this.push(b)
  }
  byteArray(name: string, bytes: Uint8Array): void {
    this.tag(7, name)
    this.int(bytes.length)
    this.push(bytes)
  }
  finish(): Uint8Array {
    const total = this.chunks.reduce((s, c) => s + c.length, 0)
    const out = new Uint8Array(total)
    let off = 0
    for (const c of this.chunks) {
      out.set(c, off)
      off += c.length
    }
    return out
  }
}

function packLongsBigInt(values: number[], bits: number, padded: boolean): bigint[] {
  if (padded) {
    const per = Math.floor(64 / bits)
    const out: bigint[] = []
    for (let i = 0; i < values.length; i += per) {
      let word = 0n
      for (let k = 0; k < per && i + k < values.length; k++) {
        word |= BigInt(values[i + k]) << BigInt(k * bits)
      }
      out.push(word)
    }
    return out
  }
  const longs = new Array<bigint>(Math.ceil((values.length * bits) / 64)).fill(0n)
  const mask64 = (1n << 64n) - 1n
  for (let i = 0; i < values.length; i++) {
    const bit = i * bits
    const w = bit >> 6
    const shift = bit & 63
    longs[w] = (longs[w] | (BigInt(values[i]) << BigInt(shift))) & mask64
    if (shift + bits > 64) {
      longs[w + 1] = (longs[w + 1] | (BigInt(values[i]) >> BigInt(64 - shift))) & mask64
    }
  }
  return longs
}

describe('nbt parser & chunk decoders', () => {
  it('parses gzipped level.dat with spawn and player position', () => {
    const w = new NbtWriter()
    w.tag(10, '')
    w.tag(10, 'Data')
    w.tag(8, 'LevelName')
    w.str('Test World')
    w.tag(3, 'DataVersion')
    w.int(4189)
    w.tag(3, 'SpawnX')
    w.int(120)
    w.tag(3, 'SpawnY')
    w.int(70)
    w.tag(3, 'SpawnZ')
    w.int(-45)
    w.tag(10, 'Player')
    w.tag(9, 'Pos')
    w.byte(6)
    w.int(3)
    w.double(12.4)
    w.double(65.0)
    w.double(-33.7)
    w.tag(8, 'Dimension')
    w.str('minecraft:overworld')
    w.byte(0) // end Player
    w.byte(0) // end Data
    w.byte(0) // end root

    const parsed = parseGzippedNbt(gzipSync(w.finish()))
    const data = parsed.Data as Record<string, unknown>
    expect(data.LevelName).toBe('Test World')
    expect(data.SpawnX).toBe(120)
    expect(data.SpawnZ).toBe(-45)
    const player = data.Player as { Pos: number[]; Dimension: string }
    expect(player.Pos).toEqual([12.4, 65.0, -33.7])
    expect(player.Dimension).toBe('minecraft:overworld')
  })

  it('unpacks both padded (1.16+) and unpadded (1.13-1.15) bit-packed long arrays', () => {
    const values = Array.from({ length: 4096 }, (_, i) => i % 17)
    for (const padded of [true, false]) {
      const longs = packLongsBigInt(values, 5, padded)
      const words = new Uint32Array(longs.length * 2)
      longs.forEach((v, i) => {
        words[i * 2] = Number(v & 0xffffffffn)
        words[i * 2 + 1] = Number((v >> 32n) & 0xffffffffn)
      })
      const unpacked = unpackLongs(words, 4096, 5)
      expect(Array.from(unpacked.slice(0, 64))).toEqual(values.slice(0, 64))
      expect(unpacked[4095]).toBe(values[4095])
    }
  })

  it('formats block state entries across 1.13-26.2 and 26.3+ schemas', () => {
    expect(formatBlockState('minecraft:stone')).toBe('minecraft:stone')
    expect(formatBlockState({ '': 'minecraft:dirt' })).toBe('minecraft:dirt')
    expect(
      formatBlockState({
        Name: 'minecraft:oak_stairs',
        Properties: { half: 'bottom', facing: 'east' }
      })
    ).toBe('minecraft:oak_stairs[facing=east,half=bottom]')
    expect(formatBlockState({ id: 'minecraft:grass_block', properties: { snowy: 'false' } })).toBe(
      'minecraft:grass_block[snowy=false]'
    )
  })

  it('reads modern compressed chunks from an .mca region buffer and decodes heightmap + sections', () => {
    const w = new NbtWriter()
    w.tag(10, '')
    w.tag(3, 'DataVersion')
    w.int(4189)
    // WORLD_SURFACE heightmap: every column at y=3 (stored as 3 + 64 + 1 = 68)
    w.tag(10, 'Heightmaps')
    w.longArray('WORLD_SURFACE', packLongsBigInt(new Array(256).fill(68), 9, true))
    w.byte(0)
    // One section at Y=0 with 3 palette entries
    w.tag(9, 'sections')
    w.byte(10)
    w.int(1)
    w.tag(1, 'Y')
    w.byte(0)
    w.tag(10, 'block_states')
    w.tag(9, 'palette')
    w.byte(10)
    w.int(2)
    w.tag(8, 'Name')
    w.str('minecraft:air')
    w.byte(0)
    w.tag(8, 'Name')
    w.str('minecraft:grass_block')
    w.byte(0)
    const cells = new Array(4096).fill(0)
    cells[3 * 256] = 1 // (x=0, y=3, z=0)
    w.longArray('data', packLongsBigInt(cells, 4, true))
    w.byte(0) // end block_states
    w.byte(0) // end section[0]
    w.byte(0) // end root

    const compressed = deflateSync(w.finish())
    const header = new Uint8Array(8192)
    const body = new Uint8Array(5 + compressed.length)
    new DataView(body.buffer).setUint32(0, compressed.length + 1)
    body[4] = 2 // zlib
    body.set(compressed, 5)
    const sectors = Math.ceil(body.length / 4096)
    header[0] = 0
    header[1] = 0
    header[2] = 2
    header[3] = sectors
    const region = new Uint8Array(8192 + sectors * 4096)
    region.set(header, 0)
    region.set(body, 8192)

    const chunk = readRegionChunk(region, 0, 0)
    expect(chunk).not.toBeNull()
    const hm = readHeightmap(chunk!, 'WORLD_SURFACE')
    expect(hm?.[0]).toBe(3)
    const secs = decodeChunkSections(chunk!)
    expect(secs).toHaveLength(1)
    expect(secs[0].palette).toEqual(['minecraft:air', 'minecraft:grass_block'])
    expect(secs[0].indices?.[3 * 256]).toBe(1)
    expect(parseNbt(w.finish()).DataVersion).toBe(4189)
  })
})
