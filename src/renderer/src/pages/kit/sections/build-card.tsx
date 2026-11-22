import type { ReactElement } from 'react'
import { Ellipsis } from 'lucide-react'
import { BuildCard } from '@/shared/ui/data/ImageCards'
import { CardGrid } from '@/shared/ui/layout/Grids'
import { Badge } from '@/shared/ui/primitives/badge'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { IconAction } from '@/shared/ui/common/Tip'
import { towerSketch } from '../samples'
import { Guidance, Specimens } from '../specimen'

export const meta = { group: 'Data display', title: 'Build card' }

const IMG = towerSketch('#9fb7c9', ['#c94f3d', '#e8e2d6'])
const IMG2 = towerSketch('#2f3a4f', ['#8a6f4e', '#c7c2b8'])
const menu = (name: string): ReactElement => (
  <IconAction label={`More for ${name}`} icon={Ellipsis} />
)
const noop = (): void => {}

const BUILDS = [
  {
    name: 'harbor_lighthouse',
    status: 'v5_copper_roof picked; export next',
    meta: 'Review 5 · Exported v4 · 2 h ago',
    image: IMG,
    badge: <Badge variant="warning">Waiting for review</Badge>
  },
  {
    name: 'stone_bridge',
    status: 'v7: deeper arches over the canal',
    meta: 'Review 6 · Exported v4 · now',
    image: IMG2,
    badge: <Badge variant="info">Drafting · 42%</Badge>,
    progress: 42
  },
  {
    name: 'keepers_cottage_with_a_very_long_name_for_truncation',
    status: 'No Status block yet, so the line stays short and this one is long enough to clamp',
    meta: 'Review 1 · never exported · yesterday',
    image: null
  },
  {
    name: 'quarry_crane',
    status: 'v2: taller jib',
    meta: 'Review 2 · never exported · 5 min ago',
    image: IMG2,
    badge: <StatusBadge state="failed">Last job failed</StatusBadge>
  },
  {
    name: 'mill_house',
    status: 'Exported to schematics/',
    meta: 'Review 3 · Exported v3 · 4 days ago',
    image: 'missing-file.png',
    badge: <Badge variant="success">Exported</Badge>
  }
]

export default function BuildCardSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens title="Card: preview 16:10 on viewer gray, status badge and progress on the image, ⋯ above the open target">
        <CardGrid min="15rem" className="w-full">
          {BUILDS.map((b) => (
            <BuildCard key={b.name} {...b} onOpen={noop} menu={menu(b.name)} />
          ))}
        </CardGrid>
      </Specimens>
      <Specimens title="Row: the list view for many builds, 44px with a 56×35 thumbnail">
        <div className="flex w-full max-w-4xl flex-col divide-y divide-border-subtle rounded-lg border border-border-default bg-surface-raised p-1">
          {BUILDS.map((b) => (
            <BuildCard key={b.name} {...b} layout="row" onOpen={noop} menu={menu(b.name)} />
          ))}
          <BuildCard
            name="oak_gate"
            status="Waiting for its first draft"
            meta="No reviews yet"
            progress={null}
            progressLabel="oak_gate: starting"
            onOpen={noop}
            layout="row"
          />
        </div>
      </Specimens>
      <Guidance>
        The whole card opens the build (Enter on the focused name does too); the ⋯ button and the
        context menu hold Rename and Delete. No image shows “No preview yet”; a broken one the
        image-off mark. The meta line drops out of rows under 640px.
      </Guidance>
    </div>
  )
}
