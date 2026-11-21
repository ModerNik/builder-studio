// The active tool's settings in the Edit tab (DESIGN › Tool options): each tool's panel from its own slice.
import type { ReactElement } from 'react'
import type { ToolId } from '@/entities/block-edit/model/edit'
import { BrushPanel } from '@/features/block-tools/brush/ui/BrushPanel'
import { FillPanel } from '@/features/block-tools/fill/ui/FillPanel'
import { PaintPanel } from '@/features/block-tools/paint/ui/PaintPanel'
import { ShapePanel } from '@/features/block-tools/shape/ui/ShapePanel'
import { TerrainPanel } from '@/features/block-tools/terrain/ui/TerrainPanel'
import type { TransformState } from '@/features/block-tools/transform/model/transform'
import { TransformPanel } from '@/features/block-tools/transform/ui/TransformPanel'
import type { ToolOptions as Options } from '../model/options'

export type OptionsChange = <T extends keyof Options>(tool: T, patch: Partial<Options[T]>) => void

export function ToolOptions({
  tool,
  options,
  onChange,
  transform
}: {
  tool: ToolId
  options: Options
  onChange: OptionsChange
  /** Transform's selection and what is waiting to be applied. */
  transform?: TransformState
}): ReactElement | null {
  switch (tool) {
    case 'brush':
      return <BrushPanel options={options.brush} onChange={(p) => onChange('brush', p)} />
    case 'paint':
      return <PaintPanel options={options.paint} onChange={(p) => onChange('paint', p)} />
    case 'fill':
      return <FillPanel options={options.fill} onChange={(p) => onChange('fill', p)} />
    case 'shape':
      return <ShapePanel options={options.shape} onChange={(p) => onChange('shape', p)} />
    case 'terrain':
      return <TerrainPanel options={options.terrain} onChange={(p) => onChange('terrain', p)} />
    case 'transform':
      return (
        <TransformPanel
          options={options.transform}
          onChange={(p) => onChange('transform', p)}
          transform={transform}
        />
      )
    default:
      return null
  }
}
