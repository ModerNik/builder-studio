import { useEffect, useState, type ReactElement } from 'react'
import { Progress } from '@/shared/ui/primitives/progress'
import { Guidance, LONG, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Display', title: 'Progress' }

export default function ProgressSection(): ReactElement {
  const [live, setLive] = useState(10)
  useEffect(() => {
    const t = setInterval(() => setLive((v) => (v >= 100 ? 0 : v + 10)), 800)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex flex-col gap-6">
      <Specimens className="*:w-72">
        <Specimen label="determinate, live">
          <Progress value={live} label="Exporting watchtower" showValue />
        </Specimen>
        <Specimen label="indeterminate">
          <Progress value={null} label="Installing Python runtime" showValue />
        </Specimen>
        <Specimen label="0%">
          <Progress value={0} label="Queued" showValue />
        </Specimen>
        <Specimen label="complete, success">
          <Progress value={100} label="Checks" showValue tone="success" />
        </Specimen>
        <Specimen label="failed, danger">
          <Progress value={64} label="Download stopped at 64%" showValue tone="danger" />
        </Specimen>
        <Specimen label="no label (aria-label)">
          <Progress value={40} aria-label="Upload" />
        </Specimen>
        <Specimen label="long label truncates">
          <Progress value={30} label={LONG} showValue />
        </Specimen>
      </Specimens>
      <Guidance>
        Determinate when the total is known. Indeterminate sweeps; under reduced motion it parks as a still bar
        and the text “Working…” carries the state.
      </Guidance>
    </div>
  )
}
