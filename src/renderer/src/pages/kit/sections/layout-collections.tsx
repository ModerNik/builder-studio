import { useState, type ReactElement } from 'react'
import { Bot, Cpu, Map, Palette, Wrench } from 'lucide-react'
import { SplitView } from '@/shared/ui/layout/SplitView'
import { SideNavLayout } from '@/shared/ui/layout/SideNavLayout'
import { CardGrid, LaneColumns, Masonry } from '@/shared/ui/layout/Grids'
import { Specimen } from './shell-demo/Specimen'

export const meta = { group: 'Layout', title: 'Splits, side nav and collections' }

const BUILDS = [
  'stone_bridge',
  'watch_tower',
  'harbour_crane',
  'mill_house',
  'lantern_row',
  'oak_gate'
]
const SETTINGS = [
  { id: 'general', label: 'General', icon: Wrench },
  { id: 'assistant', label: 'Assistant', icon: Bot },
  { id: 'look', label: 'Appearance', icon: Palette },
  {
    id: 'minecraft',
    label: 'Minecraft',
    icon: Map,
    notice: 'Needs setup: Exported schematics folder'
  },
  { id: 'advanced', label: 'Advanced', icon: Cpu },
  // a long name wraps start-aligned, as Documentation page titles do
  { id: 'workflow', label: 'Minecraft builds with AI: which workflow to choose?' }
]

const Card = ({ name, tall }: { name: string; tall?: boolean }): ReactElement => (
  <article className="rounded-lg border border-border-subtle bg-surface-panel p-3">
    <div
      className={
        tall ? 'mb-2 h-40 rounded-md bg-surface-sunken' : 'mb-2 h-24 rounded-md bg-surface-sunken'
      }
    />
    <h3 className="font-mono text-sm">{name}</h3>
    <p className="text-sm text-fg-secondary">Review 3 · 176 blocks</p>
  </article>
)

export default function CollectionsDemo(): ReactElement {
  const [section, setSection] = useState('assistant')
  const [linked, setLinked] = useState<string | null>('minecraft')
  return (
    <div>
      <p className="mb-4 max-w-prose text-fg-secondary">
        Every layout here reads its own width, so it behaves the same in a window, a dock or a
        sheet. Drag the corners. Each split pane scrolls on its own and takes a tab stop for it.
      </p>
      <Specimen
        label="Split view: list and detail (stacks under 768)"
        resizable
        className="h-72 w-[56.25rem] p-0"
      >
        <SplitView
          className="h-full"
          preset="list-detail"
          labels={['Builds', 'Details']}
          first={
            <ul className="p-2">
              {BUILDS.map((b) => (
                <li key={b} className="flex h-(--density-row) items-center px-2 font-mono text-sm">
                  {b}
                </li>
              ))}
            </ul>
          }
          second={
            <p className="p-4 text-fg-secondary">stone_bridge: 5 parts, 176 blocks, review 3.</p>
          }
        />
      </Specimen>
      <Specimen label="Split view: compare" resizable className="h-56 w-[56.25rem] p-0">
        <SplitView
          className="h-full"
          preset="compare"
          labels={['Version 3', 'Version 4']}
          first={<p className="p-4">v3</p>}
          second={<p className="p-4">v4</p>}
        />
      </Specimen>
      <Specimen label="Side nav (a menu under 768)" resizable className="w-[56.25rem]">
        <SideNavLayout
          label="Settings sections"
          items={SETTINGS}
          value={section}
          onChange={setSection}
        >
          <p className="text-fg-secondary">
            {SETTINGS.find((s) => s.id === section)?.label} settings go here.
          </p>
        </SideNavLayout>
      </Specimen>
      <Specimen
        label="Side nav, drill-in on phone (Settings): tap a section, Back returns to the list; the list carries the page h1"
        resizable
        className="w-[24.375rem]"
      >
        <SideNavLayout
          label="Settings"
          items={SETTINGS}
          value={section}
          onChange={setSection}
          narrow="drill"
        >
          <h2 className="text-lg">{SETTINGS.find((s) => s.id === section)?.label}</h2>
          <p className="text-fg-secondary">
            Only this section shows; Back returns focus to the row that opened it.
          </p>
        </SideNavLayout>
      </Specimen>
      <Specimen
        label="Side nav, drill-in, controlled: opened by a link to a section (a repair link to Minecraft)"
        resizable
        className="w-[24.375rem]"
      >
        <SideNavLayout
          label="Settings"
          items={SETTINGS}
          value={linked ?? section}
          onChange={setLinked}
          narrow="drill"
          drilled={linked !== null}
          onBack={() => setLinked(null)}
        >
          <h2 className="text-lg">{SETTINGS.find((s) => s.id === (linked ?? section))?.label}</h2>
          <p className="text-fg-secondary">
            The open section comes from the screen, so a deep link lands here, not on the list.
          </p>
        </SideNavLayout>
      </Specimen>
      <Specimen label="Card grid (Gallery)" resizable className="w-[56.25rem]">
        <CardGrid min="14rem">
          {BUILDS.map((b) => (
            <Card key={b} name={b} />
          ))}
        </CardGrid>
      </Specimen>
      <Specimen label="Masonry (References)" resizable className="w-[56.25rem]">
        <Masonry column="13rem">
          {BUILDS.map((b, i) => (
            <Card key={b} name={b} tall={i % 3 === 1} />
          ))}
        </Masonry>
      </Specimen>
      <Specimen
        label="Lanes (Variants): share the width, or scroll with snap when narrow"
        resizable
        className="w-[56.25rem]"
      >
        <LaneColumns min="16rem">
          {['Spruce railings', 'Oak railings', 'Stone walls'].map((v) => (
            <section
              key={v}
              aria-label={v}
              className="rounded-lg border border-border-subtle bg-surface-panel p-3"
            >
              <h3 className="mb-2 font-medium">{v}</h3>
              <div className="h-32 rounded-md bg-surface-sunken" />
            </section>
          ))}
        </LaneColumns>
      </Specimen>
    </div>
  )
}
