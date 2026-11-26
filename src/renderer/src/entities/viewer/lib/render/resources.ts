// The user's resource pack (built from their own client jar): blockstates, models and one texture atlas.
// Nothing from the game ships with the app; this only reads the zip it is handed at runtime.
import * as THREE from 'three'
import { unzipSync } from 'fflate'
import {
  BlockDefinition,
  BlockModel,
  Identifier,
  type TextureAtlasProvider,
  type UV
} from 'deepslate'

export const OPAQUE = 0
export const CUTOUT = 1
export const TRANSLUCENT = 2
export const LIQUID = 3 // translucent water: its own material, so a look can keep it see-through

// Sprites are packed on a 16px grid, so mip level 4 reduces each 16x16 tile to 1x1 texel.
// Generating levels past 4 merges unrelated neighbor blocks and tints tilted/distant geometry.
export const ATLAS_CELL = 16
export const ATLAS_MAX_MIP_LEVEL = 4

export interface AtlasMipLevel {
  data: Uint8Array
  width: number
  height: number
}

/** Build alpha-weighted 2x2 mip levels up to `maxLevel`, stopping before unrelated 16px tiles merge. */
export function buildAtlasMipmaps(
  base: Uint8Array,
  width: number,
  height: number,
  maxLevel = ATLAS_MAX_MIP_LEVEL
): AtlasMipLevel[] {
  const levels: AtlasMipLevel[] = [{ data: base, width, height }]
  let prev = base
  let pw = width
  let ph = height
  for (let level = 1; level <= maxLevel && pw >= 2 && ph >= 2; level++) {
    const nw = pw >> 1
    const nh = ph >> 1
    const next = new Uint8Array(nw * nh * 4)
    for (let y = 0; y < nh; y++) {
      const sy = y << 1
      const row0 = sy * pw
      const row1 = (sy + 1) * pw
      const dstRow = y * nw
      for (let x = 0; x < nw; x++) {
        const sx = x << 1
        const i0 = (row0 + sx) << 2
        const i1 = (row0 + sx + 1) << 2
        const i2 = (row1 + sx) << 2
        const i3 = (row1 + sx + 1) << 2
        const a0 = prev[i0 + 3]
        const a1 = prev[i1 + 3]
        const a2 = prev[i2 + 3]
        const a3 = prev[i3 + 3]
        const aSum = a0 + a1 + a2 + a3
        const dst = (dstRow + x) << 2
        if (aSum > 0) {
          // Weight RGB by alpha so transparent pixels never darken cutout edges (leaves, bars, rails).
          next[dst] = Math.round((prev[i0] * a0 + prev[i1] * a1 + prev[i2] * a2 + prev[i3] * a3) / aSum)
          next[dst + 1] = Math.round(
            (prev[i0 + 1] * a0 + prev[i1 + 1] * a1 + prev[i2 + 1] * a2 + prev[i3 + 1] * a3) / aSum
          )
          next[dst + 2] = Math.round(
            (prev[i0 + 2] * a0 + prev[i1 + 2] * a1 + prev[i2 + 2] * a2 + prev[i3 + 2] * a3) / aSum
          )
          next[dst + 3] = Math.round(aSum / 4)
        }
      }
    }
    levels.push({ data: next, width: nw, height: nh })
    prev = next
    pw = nw
    ph = nh
  }
  return levels
}

export interface Sprite {
  uv: UV
  kind: number // OPAQUE, CUTOUT, TRANSLUCENT or LIQUID
}

export interface Resources extends TextureAtlasProvider {
  texture: THREE.Texture
  getBlockDefinition(id: Identifier): BlockDefinition | null
  getBlockModel(id: Identifier): BlockModel | null
  /** The sprite under an atlas uv: its rect and how it blends. */
  spriteAt(u: number, v: number): Sprite
}

// entity textures the special renderers (chests, skulls, banners, shulkers, ...) draw with
const ENTITY =
  /^entity\/(chest\/|bed\/|signs\/|banner\/banner_base|shulker\/|skeleton\/(skeleton|wither_skeleton)$|zombie\/zombie$|creeper\/creeper$|piglin\/piglin$|enderdragon\/dragon$|player\/wide\/steve$|decorated_pot\/decorated_pot_(base|side)$|conduit\/base$|bell\/bell_body$|copper_golem\/copper_golem)/

const ROOT = 'assets/minecraft/'

/** Parse a pack zip. Throws when it holds no blockstates. */
export async function loadResources(zip: ArrayBuffer | Uint8Array): Promise<Resources> {
  const files = unzipSync(zip instanceof Uint8Array ? zip : new Uint8Array(zip), {
    filter: (f) =>
      f.name.startsWith(ROOT + 'blockstates/') ||
      f.name.startsWith(ROOT + 'models/block/') ||
      (f.name.startsWith(ROOT + 'textures/') && f.name.endsWith('.png'))
  })
  const text = new TextDecoder()
  const json = (path: string): unknown => {
    const f = files[ROOT + path]
    return f ? JSON.parse(text.decode(f)) : null
  }
  if (!Object.keys(files).some((f) => f.startsWith(ROOT + 'blockstates/')))
    throw new Error('the texture pack has no blockstates')

  // textures: block/* (first frame of animated strips) and the entity textures above
  const sprites: { id: string; img: ImageBitmap; w: number; h: number }[] = []
  await Promise.all(
    Object.entries(files).map(async ([name, bytes]) => {
      if (!name.startsWith(ROOT + 'textures/')) return
      const path = name.slice(ROOT.length + 9, -4)
      const block = path.startsWith('block/')
      if (!block && !ENTITY.test(path)) return
      try {
        const img = await createImageBitmap(new Blob([bytes as BlobPart], { type: 'image/png' }), {
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none'
        })
        const h = block && img.height > img.width ? img.width : img.height
        sprites.push({ id: 'minecraft:' + path, img, w: img.width, h })
      } catch {
        // an unreadable texture draws as the missing-texture tile
      }
    })
  )

  // shelf-pack: tallest first, every sprite at a multiple of 16 so mip levels up to 16px stay inside one sprite
  sprites.sort((a, b) => b.h - a.h || b.w - a.w || a.id.localeCompare(b.id))
  const area = sprites.reduce((s, x) => s + x.w * x.h, 256)
  let W = 256
  while (W * W < area * 1.3) W *= 2
  const place: { x: number; y: number }[] = []
  let [x, y, row] = [16, 0, 16] // (0, 0): the missing texture
  for (const s of sprites) {
    if (x + s.w > W) [x, y, row] = [0, y + row, s.h]
    place.push({ x, y })
    x += Math.ceil(s.w / 16) * 16
    row = Math.max(row, Math.ceil(s.h / 16) * 16)
  }
  let H = 16
  while (H < y + row) H *= 2

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(W, H)
      : Object.assign(document.createElement('canvas'), { width: W, height: H })
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
    OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 16, 16)
  ctx.fillStyle = '#f0f'
  ctx.fillRect(0, 0, 8, 8)
  ctx.fillRect(8, 8, 8, 8)
  sprites.forEach((s, i) => {
    ctx.drawImage(s.img, 0, 0, s.w, s.h, place[i].x, place[i].y, s.w, s.h)
    s.img.close()
  })
  const pixels = ctx.getImageData(0, 0, W, H).data

  // sprite lookup per 16px cell, and each sprite's blend: translucent if a few % of its texels are partly
  // transparent (stained glass, water, ice), cutout if any texel is clear (glass, leaves, plants)
  const cols = W / 16
  const cell = new Int32Array(cols * (H / 16)).fill(-1)
  const uvs: Record<string, UV> = {}
  const rects: Sprite[] = []
  sprites.forEach((s, i) => {
    const { x: px, y: py } = place[i]
    let clear = 0
    let semi = 0
    for (let yy = py; yy < py + s.h; yy++)
      for (let xx = px; xx < px + s.w; xx++) {
        const a = pixels[(yy * W + xx) * 4 + 3]
        if (a === 0) clear++
        else if (a < 255) semi++
      }
    const kind = semi > 0.05 * s.w * s.h ? TRANSLUCENT : clear || semi ? CUTOUT : OPAQUE
    // Tiny inset (1/256 of a level-0 texel) keeps exact quad edges from rounding into adjacent cells.
    const epsU = Math.min(s.w / (4 * W), 1 / (W * 256))
    const epsV = Math.min(s.h / (4 * H), 1 / (H * 256))
    const uv: UV = [px / W + epsU, py / H + epsV, (px + s.w) / W - epsU, (py + s.h) / H - epsV]
    uvs[s.id] = uv
    rects.push({
      uv,
      kind: kind === TRANSLUCENT && s.id.startsWith('minecraft:block/water_') ? LIQUID : kind
    })
    for (let cy = py / 16; cy < (py + s.h) / 16; cy++)
      for (let cx = px / 16; cx < (px + s.w) / 16; cx++) cell[cy * cols + cx] = i
  })
  const missing: Sprite = { uv: [0, 0, 16 / W, 16 / H], kind: OPAQUE }

  const basePixels = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength)
  const texture = new THREE.DataTexture(basePixels, W, H)
  texture.mipmaps = buildAtlasMipmaps(basePixels, W, H, ATLAS_MAX_MIP_LEVEL)
  texture.flipY = false // atlas v grows downward, as deepslate's uvs do
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestMipmapLinearFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.NoColorSpace // the game multiplies raw texels by the light
  texture.needsUpdate = true

  const defs = new Map<string, BlockDefinition | null>()
  const models = new Map<string, BlockModel | null>()
  const res: Resources = {
    texture,
    getTextureAtlas: () => new ImageData(new Uint8ClampedArray(pixels.buffer), W, H),
    getTextureUV: (id) => uvs[id.toString()] ?? missing.uv,
    getPixelSize: () => 1 / W,
    spriteAt: (u, v) => {
      const i = cell[Math.floor(v * (H / 16)) * cols + Math.floor(u * cols)]
      return i >= 0 ? rects[i] : missing
    },
    getBlockDefinition(id) {
      const key = id.toString()
      if (!defs.has(key)) {
        const data = json(`blockstates/${id.path}.json`)
        defs.set(key, data ? BlockDefinition.fromJson(data) : null)
      }
      return defs.get(key)!
    },
    getBlockModel(id) {
      const key = id.toString()
      if (!models.has(key)) {
        const data = json(`models/${id.path}.json`)
        const model = data ? BlockModel.fromJson(data) : null
        models.set(key, model)
        model?.flatten(res) // parents first, cached in the same map
      }
      return models.get(key)!
    }
  }
  return res
}

/** Parse each pack once for active viewers and keep the two most recent idle packs warm. */
const cache = new Map<string, { refs: number; res: Promise<Resources> }>()
export function acquireResources(key: string, load: () => Promise<Resources>): Promise<Resources> {
  let e = cache.get(key)
  if (!e) cache.set(key, (e = { refs: 0, res: load() }))
  e.refs++
  e.res.catch(() => cache.get(key) === e && cache.delete(key)) // a failed parse is retried next time
  return e.res
}
export function releaseResources(key: string): void {
  const e = cache.get(key)
  if (!e || !e.refs) return
  if (--e.refs) return
  cache.delete(key)
  cache.set(key, e)
  const idle = [...cache].filter(([, entry]) => !entry.refs)
  for (const [id, entry] of idle.slice(0, Math.max(0, idle.length - 2))) {
    cache.delete(id)
    void entry.res.then(({ texture }) => texture.dispose(), () => {})
  }
}
