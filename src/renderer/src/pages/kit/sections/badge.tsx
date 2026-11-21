import type { ReactElement } from 'react'
import { CheckIcon, CircleAlertIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react'
import { Badge } from '@/shared/ui/primitives/badge'
import { Guidance, LONG, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Display', title: 'Badge' }

export default function BadgeSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens title="Variants">
        <Specimen label="default">
          <Badge>New</Badge>
        </Specimen>
        <Specimen label="secondary">
          <Badge variant="secondary">v14</Badge>
        </Specimen>
        <Specimen label="outline">
          <Badge variant="outline">1.21.4</Badge>
        </Specimen>
        <Specimen label="accent">
          <Badge variant="accent">Running</Badge>
        </Specimen>
        <Specimen label="destructive">
          <Badge variant="destructive">3</Badge>
        </Specimen>
      </Specimens>
      <Specimens title="Status tones (always with a word or icon)">
        <Specimen label="success">
          <Badge variant="success">
            <CheckIcon />
            Passed
          </Badge>
        </Specimen>
        <Specimen label="warning">
          <Badge variant="warning">
            <TriangleAlertIcon />2 warnings
          </Badge>
        </Specimen>
        <Specimen label="danger">
          <Badge variant="danger">
            <CircleAlertIcon />
            Failed
          </Badge>
        </Specimen>
        <Specimen label="info">
          <Badge variant="info">
            <InfoIcon />
            Beta
          </Badge>
        </Specimen>
        <Specimen label="as link (hover)">
          <Badge asChild variant="secondary">
            <a href="#">12 pins</a>
          </Badge>
        </Specimen>
        <Specimen label="long text truncates" className="w-40">
          <Badge variant="outline">
            <span className="truncate">{LONG}</span>
          </Badge>
        </Specimen>
      </Specimens>
      <Guidance>
        Badges label and count; they are not buttons. Use Chip for filters you can toggle and the status chip
        (app composites) for job and agent state.
      </Guidance>
    </div>
  )
}
