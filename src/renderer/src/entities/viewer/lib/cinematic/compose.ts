// Canvas 2D post-export helpers: crisp SSAA downscaling, tight auto-crop (alpha or solid sky), contact sheet tiling.
import type { RenderImageFormat } from '@shared/api'

/** Stepped high-quality downscale for 2x SSAA buffers (avoids shimmering on crisp Minecraft pixel textures). */
export function downscaleCanvas(
  source: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  if (source.width === targetWidth && source.height === targetHeight) return source
  let current = source
  while (current.width > targetWidth * 2 && current.height > targetHeight * 2) {
    const next = document.createElement('canvas')
    next.width = Math.max(targetWidth, Math.round(current.width / 2))
    next.height = Math.max(targetHeight, Math.round(current.height / 2))
    const ctx = next.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(current, 0, 0, next.width, next.height)
    current = next
  }
  const out = document.createElement('canvas')
  out.width = targetWidth
  out.height = targetHeight
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(current, 0, 0, targetWidth, targetHeight)
  return out
}

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

/** Pure bounding-box finder over raw RGBA pixels: crops transparent edges or uniform corner-color margins. */
export function findCropRect(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  transparent: boolean,
  margin = 24,
  tolerance = 14
): CropRect | null {
  if (!width || !height) return null
  const r0 = rgba[0]
  const g0 = rgba[1]
  const b0 = rgba[2]
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    const row = y * width * 4
    for (let x = 0; x < width; x++) {
      const i = row + x * 4
      const keep = transparent
        ? rgba[i + 3] > 6
        : Math.abs(rgba[i] - r0) > tolerance ||
          Math.abs(rgba[i + 1] - g0) > tolerance ||
          Math.abs(rgba[i + 2] - b0) > tolerance
      if (keep) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX || maxY < minY) return null
  const x = Math.max(0, minX - margin)
  const y = Math.max(0, minY - margin)
  const right = Math.min(width, maxX + 1 + margin)
  const bottom = Math.min(height, maxY + 1 + margin)
  return { x, y, width: right - x, height: bottom - y }
}

/** Trim uniform background or transparent padding from a rendered canvas. */
export function autoCropCanvas(
  source: HTMLCanvasElement,
  transparent: boolean,
  margin = 24
): HTMLCanvasElement {
  const ctx = source.getContext('2d', { willReadFrequently: true })
  if (!ctx) return source
  const { data } = ctx.getImageData(0, 0, source.width, source.height)
  const rect = findCropRect(data, source.width, source.height, transparent, margin)
  if (!rect || (rect.width === source.width && rect.height === source.height)) return source
  const out = document.createElement('canvas')
  out.width = rect.width
  out.height = rect.height
  out
    .getContext('2d')!
    .drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height)
  return out
}

export interface SheetTile {
  label: string
  canvas: HTMLCanvasElement
}

/** Tile multiple angle canvases into one crisp labelled contact sheet (2 cols up to 4 views, else 3). */
export function composeContactSheet(
  tiles: SheetTile[],
  opts: { width?: number; background?: string | null; labels?: boolean } = {}
): HTMLCanvasElement {
  const width = opts.width ?? 1920
  const labels = opts.labels !== false
  const cols = tiles.length <= 1 ? 1 : tiles.length <= 4 ? 2 : 3
  const rows = Math.max(1, Math.ceil(tiles.length / cols))
  const pad = 16
  const cellW = Math.floor((width - pad * (cols + 1)) / cols)
  const cellH = Math.floor((cellW * 3) / 4)
  const totalW = cols * cellW + pad * (cols + 1)
  const totalH = rows * cellH + pad * (rows + 1)

  const out = document.createElement('canvas')
  out.width = totalW
  out.height = totalH
  const ctx = out.getContext('2d')!

  if (opts.background) {
    ctx.fillStyle = opts.background
    ctx.fillRect(0, 0, totalW, totalH)
  }

  tiles.forEach((tile, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    const x = pad + col * (cellW + pad)
    const y = pad + row * (cellH + pad)

    // Subtle tile frame when opaque
    if (opts.background) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fillRect(x, y, cellW, cellH)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1)
    }

    const scale = Math.min((cellW - 12) / tile.canvas.width, (cellH - 12) / tile.canvas.height)
    const dw = Math.max(1, Math.round(tile.canvas.width * scale))
    const dh = Math.max(1, Math.round(tile.canvas.height * scale))
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      tile.canvas,
      x + Math.round((cellW - dw) / 2),
      y + Math.round((cellH - dh) / 2),
      dw,
      dh
    )

    if (labels) {
      ctx.font = '600 13px "JetBrains Mono", ui-monospace, monospace'
      const textWidth = ctx.measureText(tile.label).width
      const pillW = Math.ceil(textWidth + 16)
      const pillH = 24
      ctx.fillStyle = 'rgba(14, 16, 20, 0.78)'
      ctx.beginPath()
      ctx.roundRect(x + 8, y + 8, pillW, pillH, 5)
      ctx.fill()
      ctx.fillStyle = '#f4f4f5'
      ctx.textBaseline = 'middle'
      ctx.fillText(tile.label, x + 16, y + 8 + pillH / 2 + 0.5)
    }
  })

  return out
}

/** Encode a canvas to raw Uint8Array bytes in the requested image format. */
export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: RenderImageFormat,
  quality = 0.92
): Promise<Uint8Array> {
  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
  // JPEG has no alpha channel: flatten transparent pixels onto dark viewer grey if needed
  let target = canvas
  if (format === 'jpeg') {
    const flat = document.createElement('canvas')
    flat.width = canvas.width
    flat.height = canvas.height
    const ctx = flat.getContext('2d')!
    ctx.fillStyle = '#27272a'
    ctx.fillRect(0, 0, flat.width, flat.height)
    ctx.drawImage(canvas, 0, 0)
    target = flat
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    target.toBlob(
      (b) => (b ? resolve(b) : reject(new Error(`Failed to encode ${format.toUpperCase()} image`))),
      mime,
      format === 'png' ? undefined : quality
    )
  )
  return new Uint8Array(await blob.arrayBuffer())
}
