// Each drawing tool's settings, kept for the session, and the one line the viewer's tool HUD shows for them.
import { MAX_SIZE, type ToolId } from '@/entities/block-edit/model/edit'
import type { BrushOptions } from '@/features/block-tools/brush/model/brush'
import type { FillOptions } from '@/features/block-tools/fill/model/fill'
import type { PaintOptions } from '@/features/block-tools/paint/model/paint'
import type { ShapeOptions } from '@/features/block-tools/shape/model/shape'
import type { TerrainOptions } from '@/features/block-tools/terrain/model/terrain'
import type { TransformOptions } from '@/features/block-tools/transform/model/transform'

export interface ToolOptions {
  brush: BrushOptions
  paint: PaintOptions
  fill: FillOptions
  shape: ShapeOptions
  terrain: TerrainOptions
  transform: TransformOptions
}
export const DEFAULT_OPTIONS: ToolOptions = {
  brush: { shape: 'sphere', size: 5, mode: 'add' },
  paint: { shape: 'sphere', size: 3, surface: true, keep: true },
  fill: { mode: 'connected', limit: 'selection', keep: true },
  shape: { kind: 'box', size: [5, 5, 5], hollow: false, wall: 1, spacing: 6, width: 1 },
  terrain: { mode: 'raise', size: 8, strength: 1 },
  transform: { mode: 'move' }
}
/** Tools whose size the - and = keys change. */
export const SIZED = ['brush', 'paint', 'terrain'] as const satisfies (keyof ToolOptions & ToolId)[]

const word = (s: string): string => s[0].toUpperCase() + s.slice(1)

/** The HUD's summary of a tool's settings, or null for a tool without any. */
export function summary(tool: ToolId, o: ToolOptions): string | null {
  switch (tool) {
    case 'brush':
      return `${word(o.brush.shape)} ${o.brush.size} · ${word(o.brush.mode)}`
    case 'paint':
      return [
        `${word(o.paint.shape)} ${o.paint.size}`,
        o.paint.surface && 'surface',
        o.paint.keep && 'keep shape'
      ]
        .filter(Boolean)
        .join(' · ')
    case 'fill':
      return [
        word(o.fill.mode),
        word(o.fill.limit),
        o.fill.mode !== 'air' && o.fill.keep && 'keep shape'
      ]
        .filter(Boolean)
        .join(' · ')
    case 'shape': {
      const s = o.shape
      if (s.kind === 'line') return `Line · width ${s.width}`
      return [
        `${word(s.kind)} ${s.size.join('×')}`,
        s.hollow && `hollow ${s.wall}`,
        `spacing ${s.spacing}`
      ]
        .filter(Boolean)
        .join(' · ')
    }
    case 'terrain':
      return `${word(o.terrain.mode)} ${o.terrain.size} · strength ${o.terrain.strength}`
    default:
      return null
  }
}

/** The options with a sized tool's size moved by `by`, kept in 1 to MAX_SIZE. */
export function resize(o: ToolOptions, tool: (typeof SIZED)[number], by: number): ToolOptions {
  const size = Math.min(MAX_SIZE, Math.max(1, o[tool].size + by))
  return { ...o, [tool]: { ...o[tool], size } }
}
