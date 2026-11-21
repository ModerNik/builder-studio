// The Editor's tools, in the rail's order and groups.
import {
  Brush,
  Eraser,
  Mountain,
  Move3d,
  MousePointer2,
  PaintBucket,
  Paintbrush,
  Pipette,
  Ruler,
  Shapes,
  SquarePlus,
  type LucideIcon
} from 'lucide-react'
import type { ToolId } from '@/entities/block-edit/model/edit'

export interface Tool {
  id: ToolId
  label: string
  icon: LucideIcon
  keys?: string
  /** It has variants (brush shapes, line or box); the rail marks it. */
  variants?: boolean
  /** It places the chosen block, so picking one in the Edit tab keeps it on. */
  block?: boolean
  /** What it does, for the Edit tab. */
  hint: string
}

export const TOOL_GROUPS: Tool[][] = [
  [
    {
      id: 'select',
      label: 'Select',
      icon: MousePointer2,
      keys: 'S',
      hint: 'Click a block to select it; Shift-click another to select the box between them.'
    },
    {
      id: 'place',
      label: 'Place',
      icon: SquarePlus,
      keys: 'P',
      block: true,
      hint: 'Click a face to place the block against it.'
    },
    {
      id: 'erase',
      label: 'Erase',
      icon: Eraser,
      keys: 'E',
      hint: 'Click a block to remove it.'
    },
    {
      id: 'pick',
      label: 'Pick',
      icon: Pipette,
      keys: 'I',
      hint: 'Click a block to place more of it. Alt-click picks in any tool.'
    }
  ],
  [
    {
      id: 'brush',
      label: 'Brush',
      icon: Brush,
      keys: 'B',
      variants: true,
      block: true,
      hint: 'Drag over the build to add or erase blocks in a shape. A drag that starts off the build turns the view.'
    },
    {
      id: 'paint',
      label: 'Paint',
      icon: Paintbrush,
      keys: 'N',
      block: true,
      hint: 'Drag over blocks to change them to the chosen block.'
    },
    {
      id: 'fill',
      label: 'Fill',
      icon: PaintBucket,
      keys: 'G',
      block: true,
      hint: 'Click to fill with the chosen block, as far as the mode and limit below allow.'
    },
    {
      id: 'shape',
      label: 'Shape',
      icon: Shapes,
      keys: 'U',
      variants: true,
      block: true,
      hint: 'Click a face to stand a shape on it; drag to stamp one every few blocks. Line draws from press to release.'
    },
    {
      id: 'terrain',
      label: 'Terrain',
      icon: Mountain,
      keys: 'T',
      variants: true,
      hint: 'Drag over the ground to raise, lower, smooth or flatten it.'
    }
  ],
  [
    {
      id: 'transform',
      label: 'Transform',
      icon: Move3d,
      keys: 'M',
      hint: 'Move, copy, turn or flip the selected box.'
    },
    {
      id: 'ruler',
      label: 'Ruler',
      icon: Ruler,
      keys: 'L',
      hint: 'Click two blocks to measure between them. A third click starts again.'
    }
  ]
]
export const TOOLS = TOOL_GROUPS.flat()
export const toolOf = (id: ToolId): Tool => TOOLS.find((t) => t.id === id)!
