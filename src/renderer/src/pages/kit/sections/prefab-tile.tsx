import type { ReactElement } from 'react'
import { PrefabTile } from '@/shared/ui/data/ImageCards'
import { CardGrid } from '@/shared/ui/layout/Grids'
import { sprite } from '../samples'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Data display', title: 'Prefab tile' }

const STONE = ['#6f7178', '#85878d', '#5d5f66', '#9a9b9f']
const COPPER = ['#6c9f8a', '#5e8c7c', '#b4694c', '#8a5a44']
const PREFABS = [
  { name: 'lamp_room_copper', image: sprite(COPPER, 1), blocks: 312, warnings: 0 },
  { name: 'gallery_railing', image: sprite(STONE, 2), blocks: 96, warnings: 1 },
  { name: 'deepslate_brick_base_course', image: sprite(STONE, 3), blocks: 1204, warnings: 3 },
  { name: 'missing_sprite', image: null, blocks: 18, warnings: 0 }
]

export default function PrefabTileSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens title="In a CardGrid (min 11rem): click a tile to copy its id">
        <CardGrid min="11rem" className="w-full max-w-4xl">
          {PREFABS.map((p) => (
            <PrefabTile
              key={p.name}
              {...p}
              tooltip={`Top blocks: stone_bricks, andesite${p.warnings ? ` · ${p.warnings} floating` : ''}`}
              copyText={`assets/${p.name}`}
            />
          ))}
        </CardGrid>
      </Specimens>
      <Specimens>
        <Specimen label="narrow (9rem): the id breaks at underscores" className="w-36">
          <PrefabTile {...PREFABS[2]} copyText={`assets/${PREFABS[2].name}`} />
        </Specimen>
      </Specimens>
      <Guidance>
        The sprite stays pixelated on viewer gray. Name and meta are 13px; a warning count is amber
        with an icon and in the tile’s name. Copied shows for 1.5s; a failed copy toasts.
      </Guidance>
    </div>
  )
}
