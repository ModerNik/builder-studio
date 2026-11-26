import { useState, type ReactElement } from 'react'
import { Check, MessageSquarePlus, Trash2 } from 'lucide-react'
import { RefTile } from '@/shared/ui/data/ImageCards'
import { Lightbox, type LightboxItem } from '@/shared/ui/data/Lightbox'
import { CardGrid } from '@/shared/ui/layout/Grids'
import { Button } from '@/shared/ui/primitives/button'
import { towerSketch } from '../samples'
import { Guidance, Specimens } from '../specimen'

export const meta = { group: 'Data display', title: 'Ref tile and lightbox' }

const START: LightboxItem[] = [
  {
    id: 'ref-1',
    name: 'lighthouse-dusk.png',
    src: towerSketch('#d9a46b', ['#c94f3d', '#e8e2d6'], 400, 300),
    note: 'Red and white bands, but in terracotta, not wool.',
    meta: 'Nov 5'
  },
  {
    id: 'ref-2',
    name: 'tower-taper.png',
    src: towerSketch('#9fb7c9', ['#8a6f4e', '#c7c2b8'], 400, 300),
    note: 'Taper about one block in every eight.',
    meta: 'Nov 5'
  },
  {
    id: 'ref-3',
    name: 'base-course.png',
    src: towerSketch('#2f3a4f', ['#4a4f57', '#6f7178'], 400, 300),
    note: '',
    meta: 'Nov 6'
  }
]

export default function RefTileSection(): ReactElement {
  const [items, setItems] = useState(START)
  const [attached, setAttached] = useState<string[]>(['ref-1'])
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const save = (i: number, note: string): void =>
    setItems((list) => list.map((it, j) => (j === i ? { ...it, note } : it)))
  const toggle = (id: string): void =>
    setAttached((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  return (
    <div className="flex flex-col gap-6">
      <Specimens title="Visual-first 4:3 tiles: empty notes stay hidden at rest, hover reveals Attach / Add note / Delete, click opens the zoomable lightbox">
        <CardGrid min="12rem" className="w-full max-w-5xl items-start">
          {items.map((it, i) => (
            <RefTile
              key={it.id}
              name={it.name}
              image={it.src}
              note={it.note ?? ''}
              attached={attached.includes(it.id!)}
              onToggleAttach={() => toggle(it.id!)}
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
        actions={(it) => {
          const isAttached = !!it.id && attached.includes(it.id)
          return (
            <>
              <Button
                variant={isAttached ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => it.id && toggle(it.id)}
              >
                {isAttached ? <Check aria-hidden /> : <MessageSquarePlus aria-hidden />}
                {isAttached ? 'In chat' : 'Attach to chat'}
              </Button>
              <Button variant="outline" size="sm">
                <Trash2 aria-hidden />
                Delete…
              </Button>
            </>
          )
        }}
      />
      <Guidance>
        Empty image notes stay hidden at rest to keep the reference board visual-first. Clicking a
        filled caption edits it inline; hover, focus and touch reveal quick actions to attach a
        reference to chat, add a note, or delete it. The Lightbox supports scroll-wheel zoom, drag
        to pan, double-click zoom, natural dimensions metadata, arrow-key navigation, and safe note
        saving.
      </Guidance>
    </div>
  )
}
