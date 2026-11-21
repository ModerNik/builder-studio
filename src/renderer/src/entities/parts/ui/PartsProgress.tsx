import type { ReactElement } from 'react'
import { Progress } from '@/shared/ui/primitives/progress'
import type { BridgeProgress } from '@shared/api'

const LABELS: Record<BridgeProgress['stage'], string> = {
  waiting: 'Waiting to prepare parts…',
  reading: 'Reading parts…',
  selecting: 'Selecting parts…',
  colors: 'Assigning part colours…',
  encoding: 'Encoding parts…',
  saving: 'Saving parts…',
  loading: 'Loading parts…',
  meshing: 'Preparing parts view…'
}

export function PartsProgress({ progress }: { progress: BridgeProgress }): ReactElement {
  const label = LABELS[progress.stage]
  return (
    <div className="viewer-overlay w-52 max-w-full px-2 py-1.5">
      <span role="status" aria-live="polite" className="sr-only">
        {label}
      </span>
      <Progress
        label={label}
        value={progress.fraction === null ? null : progress.fraction * 100}
        showValue={progress.fraction !== null}
      />
    </div>
  )
}
