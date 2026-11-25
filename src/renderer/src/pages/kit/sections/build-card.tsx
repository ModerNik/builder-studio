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
    name: 'Harbor Lighthouse #2 (v5)',
    status: 'v5_copper_roof picked; export next',
    meta: 'Review 5 · Exported v4 · 2 h ago',
    image: IMG,
    badge: <Badge variant="warning">Waiting for review</Badge>
  },
  {
    name: 'Stone Bridge — Canal',
    status: 'v7: deeper arches over the canal',
    meta: 'Review 6 · Exported v4 · now',
    image: IMG2,
    badge: <Badge variant="info">Drafting · 42%</Badge>,
    progress: 42
  },
  {
    name: 'Keeper’s Cottage: Long Project Title & Testing Truncation (100%)',
    status:
      'No Status block yet, so the line stays readable across two lines before clamping cleanly on narrower screens',
    meta: 'Review 1 · never exported · yesterday',
    image: null
  },
  {
    name: 'Quarry Crane #4',
    status: 'v2: taller jib',
    meta: 'Review 2 · never exported · 5 min ago',
    image: IMG2,
    badge: <StatusBadge state="failed">Last job failed</StatusBadge>
  },
  {
    name: 'Mill House (Survival)',
    status: 'Exported to schematics/',
    meta: 'Review 3 · Exported v3 · 4 days ago',
    image: 'missing-file.png',
    badge: <Badge variant="success">Exported</Badge>
  }
]

export default function BuildCardSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens title="Card: full isometric 16:10 preview on viewer gray, status badge and progress on the image, ⋯ above the open target">
        <CardGrid min="15rem" className="w-full">
          {BUILDS.map((b) => (
            <BuildCard key={b.name} {...b} onOpen={noop} menu={menu(b.name)} />
          ))}
        </CardGrid>
      </Specimens>
      <Specimens title="Row: spacious horizontal list cards with 16:10 isometric previews, multi-line status and always-visible metadata">
        <div className="flex w-full max-w-4xl flex-col gap-3">
          {BUILDS.map((b) => (
            <BuildCard key={b.name} {...b} layout="row" onOpen={noop} menu={menu(b.name)} />
          ))}
          <BuildCard
            name="Oak Gate & Courtyard"
            status="Waiting for its first draft"
            meta="No reviews yet · No versions yet"
            progress={null}
            progressLabel="Oak Gate & Courtyard: starting"
            onOpen={noop}
            layout="row"
          />
        </div>
      </Specimens>
      <Guidance>
        The whole card opens the build (Enter on the focused name does too); the ⋯ button and the
        context menu hold Rename and Delete. Previews use object-contain so full isometric renders
        never crop. No image shows “No preview yet” (or “No preview” in compact thumbnails); a
        broken one shows the image-off mark.
      </Guidance>
    </div>
  )
}
