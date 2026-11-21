import type { ReactElement } from 'react'
import { Separator } from '@/shared/ui/primitives/separator'
import { Specimen, Specimens } from '../specimen'

export const meta = { group: 'Display', title: 'Separator' }

export default function SeparatorSection(): ReactElement {
  return (
    <Specimens>
      <Specimen label="horizontal" className="w-64">
        <div className="flex w-full flex-col gap-2">
          <span>Blocks</span>
          <Separator />
          <span>Parts</span>
        </div>
      </Specimen>
      <Specimen label="vertical">
        <div className="flex h-5 items-center gap-3 text-sm">
          <span>1,204 blocks</span>
          <Separator orientation="vertical" />
          <span>32 × 48 × 32</span>
          <Separator orientation="vertical" />
          <span>v14</span>
        </div>
      </Specimen>
    </Specimens>
  )
}
