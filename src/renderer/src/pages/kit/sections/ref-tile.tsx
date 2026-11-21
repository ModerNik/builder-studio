import { useState, type ReactElement } from 'react'
import { Trash2 } from 'lucide-react'
import { RefTile } from '@/shared/ui/data/ImageCards'
import { Lightbox, type LightboxItem } from '@/shared/ui/data/Lightbox'
import { CardGrid } from '@/shared/ui/layout/Grids'
import { Button } from '@/shared/ui/primitives/button'
import { towerSketch } from '../samples'
import { Guidance, Specimens } from '../specimen'

export const meta = { group: 'Data display', title: 'Ref tile and lightbox' }

const START: LightboxItem[] = [
  {
    name: 'lighthouse-dusk.png',
    src: towerSketch('#d9a46b', ['#c94f3d', '#e8e2d6'], 400, 300),
    note: 'Red and white bands, but in terracotta, not wool.',
    meta: '1280 × 960 · pasted 2026-11-05'
  },
  {
    name: 'tower-taper.png',
    src: towerSketch('#9fb7c9', ['#8a6f4e', '#c7c2b8'], 400, 300),
    note: 'Taper about one block in every eight.',
    meta: '1600 × 1200 · dropped 2026-11-05'
  },
  {
    name: 'base-course.png',
    src: towerSketch('#2f3a4f', ['#4a4f57', '#6f7178'], 400, 300),
    note: '',
    meta: '800 × 600 · dropped 2026-11-06'
  }
]

export default function RefTileSection(): ReactElement {
  const [items, setItems] = useState(START)
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const save = (i: number, note: string): void =>
    setItems((list) => list.map((it, j) => (j === i ? { ...it, note } : it)))
  return (
    <div className="flex flex-col gap-6">
      <Specimens title="Tiles: even 4:3, note saved on blur, Delete on hover and focus (always on touch); click to open the lightbox">
        <CardGrid min="12rem" className="w-full max-w-5xl">
          {items.map((it, i) => (
            <RefTile
              key={it.name}
              name={it.name}
              image={it.src}
              note={it.note ?? ''}
              onNoteSave={(n) => save(i, n)}
              onOpen={() => {
                setIndex(i)
                setOpen(true)
              }}
              onDelete={() => {}}
            />
          ))}
          <RefTile name="pasted-1730903512.png" note="" onNoteSave={() => {}} adding />
          <RefTile
            name="lighthouse-night.png"
            note="Night lighting reference."
            onNoteSave={() => {}}
            onDelete={() => {}}
            missing
          />
        </CardGrid>
      </Specimens>
      <Lightbox
        items={items}
        index={index}
        onIndexChange={setIndex}
        open={open}
        onOpenChange={setOpen}
        onNoteChange={(n, i) => save(i, n)}
        actions={() => (
          <Button variant="outline" size="sm">
            <Trash2 aria-hidden />
            Delete…
          </Button>
        )}
      />
      <Guidance>
        Links and notes are not tiles: a link is a Link with its note, a note is a Card with a
        Textarea. In the lightbox the arrow keys move between images, Esc closes and focus returns
        to the tile. With `onNoteChange` the lightbox note is the same inline Textarea as the
        tile&rsquo;s, saved on blur or when the image changes or the dialog closes; without it the
        note is read-only text.
      </Guidance>
    </div>
  )
}
