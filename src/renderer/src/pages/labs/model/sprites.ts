// One cell of a sprite sheet as its own image URL, for kit tiles that take an image (Labs' prefab tiles:
// tools/prefab_index.py draws 6 columns of 180 px cells, 36 to a sheet). The build:// scheme sends CORS
// headers, so the canvas is not tainted.
import { useQuery } from '@tanstack/react-query'

const sheets = new Map<string, Promise<HTMLImageElement>>()

function load(src: string): Promise<HTMLImageElement> {
  let p = sheets.get(src)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => {
        sheets.delete(src)
        reject(new Error(`Can’t load ${src}`))
      }
      img.src = src
    })
    sheets.set(src, p)
  }
  return p
}

/** Where cell `index` sits on a sheet `cols` cells wide. */
export const cellOrigin = (index: number, cell: number, cols: number): [number, number] => [
  (index % cols) * cell,
  Math.floor(index / cols) * cell
]

async function crop(src: string, index: number, cell: number, cols: number): Promise<string> {
  const img = await load(src)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = cell
  const [x, y] = cellOrigin(index, cell, cols)
  canvas.getContext('2d')!.drawImage(img, x, y, cell, cell, 0, 0, cell, cell)
  return canvas.toDataURL('image/png')
}

export function useSpriteCell(src: string, index: number, cell = 180, cols = 6): string | null {
  return (
    useQuery({
      queryKey: ['sprite', src, index, cell, cols],
      queryFn: () => crop(src, index, cell, cols),
      staleTime: Infinity
    }).data ?? null
  )
}
