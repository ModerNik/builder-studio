import { useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { treeKey, visibleRows, type TreeNode } from './tree'

export type TreeItem = TreeNode & {
  icon?: LucideIcon
  /** Right-aligned extra: a count, a status, a line number. */
  meta?: ReactNode
  /** Second, muted line: a code line, a description. */
  detail?: string
  children?: TreeItem[]
}

/**
 * A nested list with expand, select and full keyboard use (the ARIA tree pattern): arrows move and
 * open, Home/End jump, Enter selects, Space or Ctrl/Shift-click adds to the selection.
 */
export function TreeList({
  items,
  label,
  selected = [],
  onSelect,
  defaultExpanded = [],
  className
}: {
  items: TreeItem[]
  /** Accessible name of the tree: "Parts of v3". */
  label: string
  selected?: string[]
  /** add: Space, Ctrl or Shift was held, so the id toggles in the selection instead of replacing it. */
  onSelect?: (id: string, add: boolean) => void
  defaultExpanded?: string[]
  className?: string
}): ReactElement {
  const [expanded, setExpanded] = useState(() => new Set(defaultExpanded))
  const rows = useMemo(() => visibleRows(items, expanded), [items, expanded])
  const [focus, setFocus] = useState<string | null>(null)
  const refs = useRef(new Map<string, HTMLDivElement>())
  const chosen = new Set(selected)
  const current = rows.some((r) => r.node.id === focus) ? focus : (rows[0]?.node.id ?? null)

  const toggle = (id: string, open?: boolean): void =>
    setExpanded((s) => {
      const next = new Set(s)
      if (open ?? !next.has(id)) next.add(id)
      else next.delete(id)
      return next
    })
  const moveTo = (id: string): void => {
    setFocus(id)
    refs.current.get(id)?.focus()
  }

  return (
    <div
      role="tree"
      aria-label={label}
      aria-multiselectable={onSelect ? true : undefined}
      className={cn('flex flex-col', className)}
      onKeyDown={(e) => {
        if (!current) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.(current, e.key === ' ' || e.ctrlKey || e.metaKey || e.shiftKey)
          return
        }
        const move = treeKey(rows, current, e.key, expanded)
        if (!move) return
        e.preventDefault()
        if (move.expand) toggle(move.expand, true)
        if (move.collapse) toggle(move.collapse, false)
        if (move.focus) moveTo(move.focus)
      }}
    >
      {rows.map(({ node, level, hasChildren }) => {
        const item = node as TreeItem
        const Icon = item.icon
        const open = expanded.has(item.id)
        const isSelected = chosen.has(item.id)
        return (
          <div
            key={item.id}
            ref={(el) => {
              if (el) refs.current.set(item.id, el)
              else refs.current.delete(item.id)
            }}
            role="treeitem"
            aria-level={level}
            aria-expanded={hasChildren ? open : undefined}
            aria-selected={onSelect ? isSelected : undefined}
            tabIndex={item.id === current ? 0 : -1}
            onFocus={() => setFocus(item.id)}
            onClick={(e) => onSelect?.(item.id, e.ctrlKey || e.metaKey || e.shiftKey)}
            style={{ paddingLeft: `calc(${level - 1} * 1rem + var(--space-1))` }}
            className={cn(
              'group flex min-h-(--density-row) cursor-default items-center gap-1.5 rounded-md pr-2 select-none',
              'transition-colors duration-(--dur-fast) hover:bg-surface-hover',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
              isSelected && 'bg-accent-subtle text-fg hover:bg-accent-subtle'
            )}
          >
            {hasChildren ? (
              <span
                aria-hidden
                onClick={(e) => {
                  e.stopPropagation()
                  toggle(item.id)
                }}
                className="grid size-5 shrink-0 place-items-center rounded-sm text-fg-muted hover:text-fg"
              >
                <ChevronRight
                  className={cn(
                    'size-3.5 transition-transform duration-(--dur-base)',
                    open && 'rotate-90'
                  )}
                />
              </span>
            ) : (
              <span aria-hidden className="size-5 shrink-0" />
            )}
            {Icon && (
              <Icon
                aria-hidden
                className={cn(
                  'size-3.5 shrink-0',
                  isSelected ? 'text-accent-text' : 'text-fg-muted'
                )}
              />
            )}
            <span className="flex min-w-0 flex-1 flex-col py-1">
              <span className="truncate">{item.label}</span>
              {item.detail && (
                <span className="truncate font-mono text-xs text-fg-muted">{item.detail}</span>
              )}
            </span>
            {item.meta !== undefined && (
              <span className="shrink-0 text-sm text-fg-muted tabular-nums">{item.meta}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
