import { useState, type ReactElement } from 'react'
import { Bot, Box, FileCode } from 'lucide-react'
import { TreeList, type TreeItem } from '@/shared/ui/data/TreeList'
import { StatusDot } from '@/shared/ui/status/StatusDot'
import { Cell, Grid, Sub, Touch } from '../composites-demo'

export const meta = { group: 'Data display', title: 'Tree list' }

const PARTS: TreeItem[] = [
  {
    id: 'keep',
    label: 'keep',
    icon: Box,
    meta: '2,940',
    detail: 'build.py:41  c.op("keep")',
    children: [
      { id: 'keep/walls', label: 'walls', icon: Box, meta: '1,612', detail: 'build.py:48' },
      {
        id: 'keep/roof',
        label: 'roof',
        icon: Box,
        meta: '688',
        detail: 'build.py:88',
        children: [
          { id: 'keep/roof/ridge', label: 'ridge', icon: Box, meta: '52', detail: 'build.py:97' },
          {
            id: 'keep/roof/dormers',
            label: 'dormers',
            icon: Box,
            meta: '144',
            detail: 'build.py:104'
          }
        ]
      },
      { id: 'keep/stair', label: 'spiral stair', icon: Box, meta: '640', detail: 'build.py:120' }
    ]
  },
  {
    id: 'gatehouse',
    label: 'gatehouse',
    icon: Box,
    meta: '1,204',
    detail: 'build.py:150',
    children: [
      {
        id: 'gatehouse/portcullis',
        label: 'portcullis',
        icon: Box,
        meta: '36',
        detail: 'build.py:171'
      }
    ]
  },
  { id: '-', label: 'Untagged blocks', icon: FileCode, meta: '17' }
]

const SUBAGENTS: TreeItem[] = [
  {
    id: 'critic',
    label: 'render-critic: judge v3 against the brief',
    icon: Bot,
    meta: <StatusDot state="done" />,
    children: [
      { id: 'critic/1', label: 'Read out/v3_3d/sheet.png', meta: <StatusDot state="done" /> },
      { id: 'critic/2', label: 'Searched build.py for "roof"', meta: <StatusDot state="done" /> }
    ]
  },
  {
    id: 'explore',
    label: 'Explore: find the gatehouse helpers',
    icon: Bot,
    meta: <StatusDot state="running" />,
    children: [
      { id: 'explore/1', label: 'Searched lib/ for "gate"', meta: <StatusDot state="running" /> }
    ]
  }
]

export default function DataTree(): ReactElement {
  const [selected, setSelected] = useState<string[]>(['keep/roof'])
  const select = (id: string, add: boolean): void =>
    setSelected((s) => (add ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]))
  return (
    <Sub
      title="TreeList"
      note="Parts and subagents. Arrows move and open, Home/End jump, Enter selects, Space or Ctrl/Shift-click adds to the selection."
    >
      <Grid min="20rem">
        <Cell label={`Parts of v3 (${selected.length} selected)`}>
          <TreeList
            items={PARTS}
            label="Parts of v3"
            selected={selected}
            onSelect={select}
            defaultExpanded={['keep', 'keep/roof']}
          />
        </Cell>
        <Cell label="Subagents, read-only">
          <TreeList items={SUBAGENTS} label="Subagents" defaultExpanded={['critic', 'explore']} />
        </Cell>
        <Cell label="Touch density">
          <Touch>
            <TreeList
              items={PARTS}
              label="Parts of v3, touch"
              selected={selected}
              onSelect={select}
            />
          </Touch>
        </Cell>
      </Grid>
    </Sub>
  )
}
