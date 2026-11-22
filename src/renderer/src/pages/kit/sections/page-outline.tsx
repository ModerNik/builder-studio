import { useRef, type ReactElement } from 'react'
import { PageOutline } from '@/shared/ui/layout/PageOutline'
import { jumpToHeading, useHeadingInView, type OutlineItem } from '@/shared/ui/layout/outline'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Layout', title: 'On this page' }

const ITEMS: OutlineItem[] = [
  { id: 'kit-otp-start', title: 'Getting started', level: 2 },
  { id: 'kit-otp-folder', title: 'Pick a workspace folder', level: 3 },
  { id: 'kit-otp-engine', title: 'Install the build engine', level: 3 },
  { id: 'kit-otp-python', title: 'When Python is already installed', level: 4 },
  { id: 'kit-otp-first', title: 'Your first build', level: 2 },
  {
    id: 'kit-otp-review',
    title: 'Reviews and pins, with a heading long enough to wrap',
    level: 2
  },
  { id: 'kit-otp-export', title: 'Export to Minecraft', level: 2 }
]
const H = { 2: 'h2', 3: 'h3', 4: 'h4' } as const
const SIZE = { 2: 'text-xl', 3: 'text-lg', 4: 'text-md' } as const

export default function PageOutlineSection(): ReactElement {
  const pane = useRef<HTMLDivElement>(null)
  const current = useHeadingInView(
    pane,
    ITEMS.map((i) => i.id)
  )
  return (
    <div className="flex flex-col gap-6">
      <Specimen
        label="live: scroll the article or pick a heading; only the article scrolls"
        className="w-full"
      >
        <div className="flex h-96 w-full max-w-5xl gap-6 rounded-lg border border-border-subtle bg-surface p-0">
          <div ref={pane} className="min-w-0 flex-1 overflow-auto p-6">
            <article className="flex max-w-[68ch] flex-col gap-4">
              {ITEMS.map((h) => {
                const Tag = H[h.level]
                return (
                  <section key={h.id} className="flex flex-col gap-3">
                    <Tag id={h.id} className={`${SIZE[h.level]} scroll-mt-4 outline-none`}>
                      {h.title}
                    </Tag>
                    <p className="text-base text-fg-secondary">
                      A build is a folder with its drawing code, its reviews and its exports. The
                      outline marks the heading at the top quarter of this pane, so the mark follows
                      what you are reading rather than what is at the very top.
                    </p>
                    <p className="text-base text-fg-secondary">
                      Jumping scrolls only this pane and moves focus to the heading, so the next Tab
                      continues from there.
                    </p>
                  </section>
                )
              })}
            </article>
          </div>
          <PageOutline
            items={ITEMS}
            current={current}
            onJump={jumpToHeading}
            className="w-56 shrink-0 overflow-auto py-6 pe-3 max-md:hidden"
          />
        </div>
      </Specimen>
      <Specimens>
        <Specimen label="static: third heading in view" className="w-56">
          <PageOutline items={ITEMS} current="kit-otp-engine" onJump={() => {}} />
        </Specimen>
        <Specimen label="no headings: renders nothing" className="w-56">
          <span className="text-sm text-fg-muted">
            <PageOutline items={[]} onJump={() => {}} />
            (no outline)
          </span>
        </Specimen>
      </Specimens>
      <Guidance>
        Documentation and the Design log show it beside the reading column from 1280px; narrower,
        the outline is left out (the page list menu still jumps between pages). The heading in view
        has the verdigris bar and medium weight, and aria-current for screen readers.
      </Guidance>
    </div>
  )
}
