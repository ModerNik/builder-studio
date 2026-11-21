import { useState, type ReactElement } from 'react'
import { MapSelectionCanvas } from '@/entities/site/ui/MapSelectionCanvas'
import type { Box } from '@/entities/site/model/site'
import { Slider } from '@/shared/ui/primitives/slider'
import { Specimen } from './shell-demo/Specimen'

export const meta = { group: 'Viewer', title: 'Map selection' }

const SIZE = 96
// a made-up terrain: a river across grass, a sand bank and a few hills; one pixel per column
const height = (x: number, z: number): number =>
  Math.round(64 + 6 * Math.sin(x / 9) * Math.cos(z / 11))
const river = (x: number, z: number): boolean => Math.abs(z - 48 - 10 * Math.sin(x / 14)) < 4

function terrain(): string {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  for (let x = 0; x < SIZE; x++)
    for (let z = 0; z < SIZE; z++) {
      const h = height(x, z)
      const bank = Math.abs(z - 48 - 10 * Math.sin(x / 14)) < 6
      ctx.fillStyle = river(x, z)
        ? '#3b6ea8'
        : bank
          ? '#cdbb84'
          : `hsl(100 35% ${22 + (h - 58) * 2}%)`
      ctx.fillRect(x, z, 1, 1)
    }
  return canvas.toDataURL()
}

export default function MapSelectionDemo(): ReactElement {
  const [src] = useState(terrain)
  const [box, setBox] = useState<Box | null>([-20, -12, 3, 7])
  const [margin, setMargin] = useState(4)
  const map = { origin: [-48, -48] as [number, number], size: [SIZE, SIZE] as [number, number] }
  return (
    <div>
      <p className="mb-4 max-w-prose text-fg-secondary">
        Drag to draw the build area; hover reads out x, z and the top block y. From the keyboard:
        Enter starts a 16 by 16 box, arrows move it (Shift moves 16), Alt and arrows resize it,
        Delete clears it. The margin (clear columns kept around the build) is the dashed outline.
        Resize the specimen: the map fits both its width and its height, with no wrapper around it.
      </p>
      <Specimen label="Build location map" resizable className="h-[26.25rem] w-[45rem] p-0">
        <MapSelectionCanvas
          map={map}
          src={src}
          box={box}
          onBoxChange={setBox}
          heightAt={(x, z) => (river(x + 48, z + 48) ? 62 : height(x + 48, z + 48))}
          margin={margin}
          label="World map around spawn"
        />
      </Specimen>
      <div className="mt-3 flex max-w-sm items-center gap-3">
        <span className="shrink-0 text-sm text-fg-secondary">Margin</span>
        <Slider
          aria-label="Margin"
          min={0}
          max={16}
          step={1}
          value={[margin]}
          onValueChange={([v]) => setMargin(v)}
          showValue
          formatValue={(v) => `${v} col`}
        />
      </div>
      <p className="text-sm text-fg-secondary">
        Selected:{' '}
        <span className="font-mono">
          {box ? `${box[0]} ${box[1]} to ${box[2]} ${box[3]}` : 'nothing'}
        </span>
      </p>
    </div>
  )
}
