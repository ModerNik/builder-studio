import type { ReactElement } from 'react'
import { PerfHudPanel } from '@/widgets/perf-hud/ui/PerfHudPanel'
import type { PerfGroup } from '@/widgets/perf-hud/model/perf'
import { Specimen, Specimens } from '../specimen'

export const meta = { group: 'Status', title: 'Performance HUD (dev)' }

const GROUPS: PerfGroup[] = [
  {
    title: 'Renderer',
    rows: [
      { label: 'Frame rate', value: '60 fps' },
      { label: 'Worst frame', value: '84 ms', tone: 'warn' },
      { label: 'Long tasks', value: '3 · 512 ms', tone: 'bad' },
      { label: 'JS heap', value: '148 MB' }
    ]
  },
  {
    title: 'Processes',
    rows: [
      { label: 'Main', value: '1.2% · 112 MB' },
      { label: 'Renderer', value: '18.4% · 402 MB' },
      { label: 'GPU', value: '6.0% · 310 MB' },
      { label: 'Total', value: '25.6% · 824 MB' }
    ]
  },
  {
    title: 'WebGL',
    rows: [
      { label: 'Viewer 1', value: '60 fps · 96 geo · 9 tex · 14 prog' },
      { label: 'World map', value: '212 geo · 3 tex · 6 prog' },
      { label: 'Regions', value: '42 low · 9 high · 0 pending' }
    ]
  }
]

export default function PerfHudSection(): ReactElement {
  return (
    <Specimens>
      <Specimen label="sampling">
        <PerfHudPanel groups={GROUPS} onClose={() => {}} />
      </Specimen>
      <Specimen label="waiting for the first sample">
        <PerfHudPanel groups={[]} />
      </Specimen>
    </Specimens>
  )
}
