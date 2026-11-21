import * as React from 'react'
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/shared/ui/primitives/table'

type Column<T> = {
  key: string
  header: React.ReactNode
  /** The cell content; defaults to String(row[key]). */
  cell?: (row: T) => React.ReactNode
  /** Makes the header a sort button; returns the value to compare. */
  sortValue?: (row: T) => string | number
  align?: 'start' | 'end'
  className?: string
}

type Sort = { key: string; dir: 'asc' | 'desc' }

type DataTableProps<T> = {
  columns: Column<T>[]
  rows: T[]
  getRowId: (row: T) => string
  /** Accessible name for the table. */
  label: string
  /** Adds a checkbox column; controlled by selected / onSelectedChange. */
  selected?: Set<string>
  onSelectedChange?: (selected: Set<string>) => void
  loading?: boolean
  /** Shown in one full-width row when there are no rows. */
  empty?: React.ReactNode
  dense?: boolean
  /** A max height makes the body scroll under a sticky header. */
  className?: string
  defaultSort?: Sort
}

/** A table with sortable headers (aria-sort), selectable rows, sticky header, loading and empty rows. */
function DataTable<T>({
  columns,
  rows,
  getRowId,
  label,
  selected,
  onSelectedChange,
  loading = false,
  empty = 'Nothing here yet',
  dense,
  className,
  defaultSort
}: DataTableProps<T>): React.ReactElement {
  const [sort, setSort] = React.useState<Sort | undefined>(defaultSort)
  const sorted = React.useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key)
    if (!col?.sortValue || !sort) return rows
    const value = col.sortValue
    const sign = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = value(a)
      const y = value(b)
      return sign * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true }))
    })
  }, [rows, columns, sort])

  const selectable = !!selected && !!onSelectedChange
  const ids = sorted.map(getRowId)
  const picked = ids.filter((id) => selected?.has(id)).length
  const all = picked > 0 && picked === ids.length ? true : picked > 0 ? 'indeterminate' : false
  const toggle = (id: string, on: boolean): void => {
    const next = new Set(selected)
    if (on) next.add(id)
    else next.delete(id)
    onSelectedChange?.(next)
  }
  const span = columns.length + (selectable ? 1 : 0)

  return (
    <Table dense={dense} aria-label={label} aria-busy={loading || undefined} containerClassName={cn('border border-border-default', className)}>
      <TableHeader sticky>
        <TableRow className="hover:bg-transparent">
          {selectable && (
            <TableHead className="ps-3">
              <Checkbox
                aria-label="Select all rows"
                checked={all}
                disabled={loading || ids.length === 0}
                onCheckedChange={(on) => onSelectedChange?.(new Set(on === true ? ids : []))}
              />
            </TableHead>
          )}
          {columns.map((c) => {
            const active = sort?.key === c.key ? sort.dir : undefined
            return (
              <TableHead
                key={c.key}
                aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : c.sortValue ? 'none' : undefined}
                className={cn(c.align === 'end' && 'text-end', c.className)}
              >
                {c.sortValue ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSort(active === 'asc' ? { key: c.key, dir: 'desc' } : active === 'desc' ? undefined : { key: c.key, dir: 'asc' })
                    }
                    className={cn(
                      'focus-ring -mx-1 inline-flex cursor-pointer items-center gap-1 rounded-xs px-1 can-hover:text-fg',
                      active && 'text-fg',
                      c.align === 'end' && 'flex-row-reverse'
                    )}
                  >
                    {c.header}
                    {active === 'asc' ? (
                      <ArrowUpIcon aria-hidden className="size-3.5" />
                    ) : active === 'desc' ? (
                      <ArrowDownIcon aria-hidden className="size-3.5" />
                    ) : (
                      <ArrowUpDownIcon aria-hidden className="size-3.5 text-fg-muted" />
                    )}
                  </button>
                ) : (
                  c.header
                )}
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 4 }, (_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              {Array.from({ length: span }, (_, j) => (
                <TableCell key={j}>
                  <Skeleton className={cn('h-3', j === 0 && selectable ? 'w-4' : 'w-3/4')} />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : sorted.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={span} className="h-24 text-center text-fg-muted">
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          sorted.map((row) => {
            const id = getRowId(row)
            const on = !!selected?.has(id)
            return (
              <TableRow key={id} aria-selected={selectable ? on : undefined}>
                {selectable && (
                  <TableCell className="ps-3">
                    <Checkbox
                      aria-label="Select row"
                      checked={on}
                      onCheckedChange={(v) => toggle(id, v === true)}
                    />
                  </TableCell>
                )}
                {columns.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn('max-w-0 truncate', c.align === 'end' && 'text-end', c.className)}
                  >
                    {c.cell ? c.cell(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}

export { DataTable, type Column, type DataTableProps }
