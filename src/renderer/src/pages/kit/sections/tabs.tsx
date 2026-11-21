import type { ReactElement } from 'react'
import { BoxIcon, ColumnsIcon, ImageIcon } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs'
import { EditorTabs } from '@/widgets/workbench-shell/ui/EditorTabs'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Navigation', title: 'Tabs' }

const many = [
  'Edit',
  'Parts',
  'Checks',
  'Materials',
  'History',
  'Notes',
  'References',
  'Export settings'
]

export default function TabsSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="pill (default)">
          <Tabs defaultValue="3d">
            <TabsList aria-label="View">
              <TabsTrigger value="3d">
                <BoxIcon />
                3D
              </TabsTrigger>
              <TabsTrigger value="preview">
                <ImageIcon />
                Preview
              </TabsTrigger>
              <TabsTrigger value="compare">
                <ColumnsIcon />
                Compare
              </TabsTrigger>
              <TabsTrigger value="off" disabled>
                Disabled
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Specimen>
        <Specimen label="line, with panels" className="w-96 max-w-full">
          <Tabs defaultValue="edit" className="w-full">
            <TabsList variant="line" aria-label="Editor">
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="parts">Parts</TabsTrigger>
              <TabsTrigger value="checks">Checks</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="text-sm text-fg-secondary">
              minecraft:cut_copper at 12, 64, -3
            </TabsContent>
            <TabsContent value="parts" className="text-sm text-fg-secondary">
              roof, walls, stair
            </TabsContent>
            <TabsContent value="checks" className="text-sm text-fg-secondary">
              2 warnings
            </TabsContent>
          </Tabs>
        </Specimen>
        <Specimen label="Editor with labels" className="w-96 max-w-full">
          <Tabs defaultValue="parts" className="w-full">
            <EditorTabs />
          </Tabs>
        </Specimen>
        <Specimen label="Editor with icons" className="w-72 max-w-full">
          <Tabs defaultValue="parts" className="w-full">
            <EditorTabs />
          </Tabs>
        </Specimen>
        <Specimen
          label="overflow scrolls (arrow keys bring tabs into view)"
          className="w-80 max-w-full"
        >
          <Tabs defaultValue="Edit" className="w-full">
            <TabsList variant="line" aria-label="Many tabs">
              {many.map((t) => (
                <TabsTrigger key={t} value={t}>
                  {t}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Specimen>
        <Specimen label="pill, full width" className="w-80 max-w-full">
          <Tabs defaultValue="a" className="w-full">
            <TabsList className="w-full" aria-label="Full width">
              <TabsTrigger value="a">Details</TabsTrigger>
              <TabsTrigger value="b">Activity</TabsTrigger>
            </TabsList>
          </Tabs>
        </Specimen>
        <Specimen label="vertical, line">
          <Tabs defaultValue="general" orientation="vertical">
            <TabsList variant="line" aria-label="Settings">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="minecraft">Minecraft</TabsTrigger>
              <TabsTrigger value="ai">AI assistant</TabsTrigger>
            </TabsList>
          </Tabs>
        </Specimen>
        <Specimen label="RTL">
          <Tabs defaultValue="a" dir="rtl">
            <TabsList variant="line" aria-label="RTL">
              <TabsTrigger value="a">ראשי</TabsTrigger>
              <TabsTrigger value="b">חלקים</TabsTrigger>
            </TabsList>
          </Tabs>
        </Specimen>
      </Specimens>
      <Guidance>
        Pill tabs switch views of one thing (3D / Preview / Compare); line tabs label panels and
        pages. Arrow keys move between tabs, Tab moves into the panel.
      </Guidance>
    </div>
  )
}
