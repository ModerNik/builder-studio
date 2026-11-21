// The block picker: search, one category, any shapes, then the blocks as tiles in one grid.
import { useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { SearchX, Search } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/primitives/button'
import { Chip } from '@/shared/ui/primitives/chip'
import { Input } from '@/shared/ui/primitives/input'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import {
  CATEGORIES,
  SHAPES,
  filterBlocks,
  fullState,
  type BlockInfo,
  type Shape
} from '@/entities/block/model/registry'
import { BlockTile } from './BlockTile'

export function BlockPicker({
  blocks,
  recent,
  value,
  onChange,
  icon,
  color,
  className
}: {
  blocks: BlockInfo[]
  /** Block ids for the Recent category, in order. */
  recent: string[]
  /** The selected block's id. */
  value: string | null
  onChange: (block: BlockInfo) => void
  icon: (state: string) => string | undefined
  color: (id: string) => string | null
  className?: string
}): ReactElement {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>(recent.length ? 'recent' : 'building')
  const [shapes, setShapes] = useState<Shape[]>([])
  const shown = filterBlocks(blocks, { category, shapes, search, recent })
  const grid = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState(0)
  const at = Math.min(focus, Math.max(shown.length - 1, 0))

  // one tab stop: arrow keys move through the grid by its columns
  const move = (e: KeyboardEvent<HTMLDivElement>): void => {
    const n = shown.length
    if (!n || !grid.current) return
    const cols = getComputedStyle(grid.current).gridTemplateColumns.split(' ').length
    const rtl = getComputedStyle(grid.current).direction === 'rtl' ? -1 : 1
    const steps: Record<string, number> = {
      ArrowRight: rtl,
      ArrowLeft: -rtl,
      ArrowDown: cols,
      ArrowUp: -cols,
      Home: -n,
      End: n
    }
    const step = steps[e.key]
    if (step === undefined) return
    e.preventDefault()
    const next = Math.min(Math.max(at + step, 0), n - 1)
    setFocus(next)
    grid.current.querySelectorAll('button')[next]?.focus()
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch('')}
        leading={<Search aria-hidden="true" className="size-4 text-fg-muted" />}
        placeholder="Search blocks"
        aria-label="Search blocks"
      />
      <div role="group" aria-label="Category" className="flex flex-wrap gap-1">
        {CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            selected={category === c.id}
            disabled={!!search.trim()}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </Chip>
        ))}
      </div>
      <div role="group" aria-label="Shape" className="flex flex-wrap gap-1">
        {SHAPES.map((s) => (
          <Chip
            key={s.id}
            selected={shapes.includes(s.id)}
            onClick={() =>
              setShapes((all) =>
                all.includes(s.id) ? all.filter((x) => x !== s.id) : [...all, s.id]
              )
            }
          >
            {s.label}
          </Chip>
        ))}
      </div>
      {shown.length ? (
        <div
          ref={grid}
          role="group"
          aria-label="Blocks"
          onKeyDown={move}
          className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1"
        >
          {shown.map((b, i) => (
            <BlockTile
              key={b.id}
              label={b.label}
              icon={icon(fullState(b))}
              color={color(b.id)}
              selected={b.id === value}
              tabIndex={i === at ? 0 : -1}
              onFocus={() => setFocus(i)}
              onClick={() => onChange(b)}
              className="size-auto aspect-square"
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={SearchX}
          variant="no-results"
          title={
            category === 'recent' && !search && !shapes.length
              ? 'No recent blocks'
              : 'No blocks match'
          }
          action={
            (search || shapes.length > 0) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setShapes([])
                }}
              >
                Clear filters
              </Button>
            )
          }
        >
          {category === 'recent' && !search && !shapes.length
            ? 'Blocks you place and star show here.'
            : undefined}
        </EmptyState>
      )}
    </div>
  )
}
