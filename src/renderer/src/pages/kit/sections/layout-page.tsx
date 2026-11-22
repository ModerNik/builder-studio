import { useState, type ReactElement } from 'react'
import { DropdownMenu } from 'radix-ui'
import {
  AlignCenter,
  Box,
  Check,
  Eye,
  Grid3x3,
  Layers,
  Ruler,
  Send,
  Sun,
  Undo2,
  Redo2
} from 'lucide-react'
import { PageHeader } from '@/shared/ui/layout/PageHeader'
import { Toolbar, ToolbarButton, type ToolbarGroup } from '@/shared/ui/layout/Toolbar'
import { menuItem } from '@/shared/ui/common/styles'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { Specimen } from './shell-demo/Specimen'

export const meta = { group: 'Layout', title: 'Page header and toolbar' }

const noop = (): void => {}
const item = (Icon: typeof Box, label: string): ReactElement => (
  <DropdownMenu.Item className={menuItem} onSelect={noop}>
    <Icon aria-hidden="true" />
    {label}
  </DropdownMenu.Item>
)
const button = (Icon: typeof Box, label: string): ReactElement => (
  <ToolbarButton key={label}>
    <Icon aria-hidden="true" />
    {label}
  </ToolbarButton>
)

const GROUPS: ToolbarGroup[] = [
  {
    id: 'history',
    label: 'History',
    content: [button(Undo2, 'Undo'), button(Redo2, 'Redo')],
    overflow: [item(Undo2, 'Undo'), item(Redo2, 'Redo')]
  },
  {
    id: 'show',
    label: 'Show',
    content: [button(Grid3x3, 'Grid'), button(Ruler, 'Measure'), button(Layers, 'Layers')],
    overflow: [item(Grid3x3, 'Grid'), item(Ruler, 'Measure'), item(Layers, 'Layers')]
  },
  {
    id: 'light',
    label: 'Lighting',
    content: [button(Sun, 'Daylight'), button(Eye, 'X-ray')],
    overflow: [item(Sun, 'Daylight'), item(Eye, 'X-ray')]
  },
  {
    id: 'align',
    label: 'Align',
    content: [button(AlignCenter, 'Centre on site')],
    overflow: [item(AlignCenter, 'Centre on site')]
  }
]

export default function PageLayoutDemo(): ReactElement {
  const [question, setQuestion] = useState('Which railing reads better from the river?')
  return (
    <div>
      <p className="mb-4 max-w-prose text-fg-secondary">
        Headers wrap instead of squeezing: a field keeps at least 20rem and moves to its own row, so
        the Review question stays usable at 1280 with a dock open. Toolbars keep one row and move
        whole groups into More, measured by their own width; or they wrap.
      </p>
      <Specimen label="Review header with the review question" resizable className="w-[68.75rem]">
        <PageHeader
          title="Review"
          back={{ label: 'Back to the workspace', onClick: noop }}
          meta={
            <>
              <span className="font-mono">stone_bridge</span>
              <span className="rounded-full border border-accent-subtle-border bg-accent-subtle px-2 text-xs text-accent-text">
                The agent is waiting
              </span>
            </>
          }
          field={
            <Input
              aria-label="The question for this review"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          }
          actions={
            <>
              <Button variant="ghost">Decline</Button>
              <Button>
                <Send aria-hidden="true" />
                Save and send
              </Button>
            </>
          }
        />
      </Specimen>
      <Specimen label="Settings header with a description" resizable className="w-[55rem]">
        <PageHeader
          title="Build location"
          description="Where new builds are placed in your world. Pick a spot on the map or type the coordinates."
          actions={
            <Button variant="outline">
              <Check aria-hidden="true" />
              Use this spot
            </Button>
          }
        />
      </Specimen>
      <Specimen label="Toolbar, overflow into More" resizable className="w-[40rem]">
        <Toolbar
          label="View tools"
          groups={GROUPS}
          end={<Button size="sm">Generate draft</Button>}
        />
      </Specimen>
      <Specimen label="Toolbar, wrapping" resizable className="w-[32.5rem]">
        <Toolbar label="View tools, wrapping" mode="wrap" groups={GROUPS} />
      </Specimen>
    </div>
  )
}
