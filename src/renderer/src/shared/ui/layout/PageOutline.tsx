// "On this page": the page's h2–h4 as links, the heading in view marked. The screen shows it from 1280px
// (Documentation, Design log); pair it with useHeadingInView and jumpToHeading from ./outline.
import type { ReactElement } from 'react'
import { cn } from '@/shared/lib/utils'
import { focusRing } from '@/shared/ui/common/styles'
import type { OutlineItem } from './outline'

const INDENT = { 2: 'ps-3', 3: 'ps-6', 4: 'ps-9' } as const

export function PageOutline({
  items,
  current,
  onJump,
  label = 'On this page',
  className
}: {
  items: OutlineItem[]
  /** The id of the heading in view. */
  current?: string
  onJump: (id: string) => void
  label?: string
  className?: string
}): ReactElement | null {
  if (!items.length) return null
  return (
    <nav aria-label={label} className={cn('flex min-w-0 flex-col gap-2', className)}>
      <p aria-hidden="true" className="px-3 text-xs text-fg-muted">
        {label}
      </p>
      <ul className="flex flex-col border-s border-border-default">
        {items.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              aria-current={h.id === current ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault()
                onJump(h.id)
              }}
              className={cn(
                focusRing,
                '-ms-px flex min-h-(--density-row) items-center rounded-e-sm border-s-2 border-transparent py-1 pe-2 text-sm text-fg-secondary transition-colors duration-fast ease-standard can-hover:text-fg',
                'aria-[current=location]:border-accent-solid aria-[current=location]:font-medium aria-[current=location]:text-fg',
                INDENT[h.level]
              )}
            >
              <span className="line-clamp-2">{h.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
