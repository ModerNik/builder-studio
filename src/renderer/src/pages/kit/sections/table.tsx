import type { ReactElement } from 'react'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from '@/shared/ui/primitives/table'
import { Specimen, Specimens } from '../specimen'

export const meta = { group: 'Display', title: 'Table' }

const materials = [
  ['minecraft:cut_copper', 412, '6 stacks + 28'],
  ['minecraft:deepslate_tiles', 386, '6 stacks + 2'],
  ['minecraft:spruce_planks', 220, '3 stacks + 28'],
  ['minecraft:glass_pane', 64, '1 stack'],
  ['minecraft:lantern', 12, '12']
] as const

function Materials({ dense = false }: { dense?: boolean }): ReactElement {
  return (
    <Table dense={dense}>
      <TableCaption>Materials for watchtower v14</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Block</TableHead>
          <TableHead className="text-end">Count</TableHead>
          <TableHead className="text-end">Stacks</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {materials.map(([id, n, s]) => (
          <TableRow key={id}>
            <TableCell className="font-mono text-sm">{id}</TableCell>
            <TableCell className="text-end">{n}</TableCell>
            <TableCell className="text-end text-fg-secondary">{s}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell className="text-end">1,094</TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  )
}

export default function TableSection(): ReactElement {
  return (
    <Specimens className="*:w-[min(26.25rem,100%)]">
      <Specimen label="default rows (--density-row)">
        <Materials />
      </Specimen>
      <Specimen label="dense (--density-control-sm)">
        <Materials dense />
      </Specimen>
    </Specimens>
  )
}
