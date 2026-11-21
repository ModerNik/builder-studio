import { useState, type ReactElement } from 'react'
import { Badge } from '@/shared/ui/primitives/badge'
import { DataTable, type Column } from '@/shared/ui/primitives/data-table'
import { Guidance, LONG, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Display', title: 'Data table' }

type Check = { id: string; name: string; part: string; count: number; severity: 'error' | 'warning' | 'info' }

const severity = { error: 'danger', warning: 'warning', info: 'info' } as const

const rows: Check[] = Array.from({ length: 24 }, (_, i) => ({
  id: `c${i}`,
  name: i === 3 ? LONG : ['Floating block', 'Unsupported sand', 'Dark room', 'Unreachable door'][i % 4],
  part: ['roof', 'walls', 'stair', 'cellar', 'lantern_post'][i % 5],
  count: (i * 7) % 23,
  severity: (['error', 'warning', 'info'] as const)[i % 3]
}))

const columns: Column<Check>[] = [
  { key: 'name', header: 'Check', sortValue: (r) => r.name, className: 'w-1/2' },
  { key: 'part', header: 'Part', sortValue: (r) => r.part, cell: (r) => <span className="font-mono text-sm">{r.part}</span> },
  {
    key: 'severity',
    header: 'Severity',
    sortValue: (r) => r.severity,
    cell: (r) => <Badge variant={severity[r.severity]}>{r.severity}</Badge>
  },
  { key: 'count', header: 'Blocks', align: 'end', sortValue: (r) => r.count }
]

export default function DataTableSection(): ReactElement {
  const [selected, setSelected] = useState(new Set<string>(['c1']))
  return (
    <div className="flex flex-col gap-6">
      <Specimens className="*:w-[min(40rem,100%)]">
        <Specimen label={`sortable, selectable, sticky header (${selected.size} selected)`}>
          <DataTable
            label="Checks"
            columns={columns}
            rows={rows}
            getRowId={(r) => r.id}
            selected={selected}
            onSelectedChange={setSelected}
            className="max-h-72"
            defaultSort={{ key: 'count', dir: 'desc' }}
          />
        </Specimen>
        <Specimen label="dense">
          <DataTable label="Checks (dense)" columns={columns} rows={rows.slice(0, 5)} getRowId={(r) => r.id} dense />
        </Specimen>
        <Specimen label="loading">
          <DataTable
            label="Checks (loading)"
            columns={columns}
            rows={[]}
            getRowId={(r) => r.id}
            loading
            selected={new Set()}
            onSelectedChange={() => {}}
          />
        </Specimen>
        <Specimen label="empty">
          <DataTable label="Checks (empty)" columns={columns} rows={[]} getRowId={(r) => r.id} empty="No problems found. Run checks again after the next draft." />
        </Specimen>
      </Specimens>
      <Guidance>
        Click a sortable header to sort ascending, again for descending, a third time to clear; the header
        carries aria-sort. Selected rows get the patina tint and aria-selected. Numbers line up with
        tabular figures.
      </Guidance>
    </div>
  )
}
