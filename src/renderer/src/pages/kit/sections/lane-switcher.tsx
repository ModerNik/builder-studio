import { useRef, useState, type ReactElement } from 'react'
import { Composer } from '@/features/agent-chat/ui/Composer'
import { LaneSwitcher, type Lane } from '@/features/agent-chat/ui/LaneSwitcher'
import { LaneColumns } from '@/shared/ui/layout/Grids'
import { StatusDot } from '@/shared/ui/status/StatusDot'
import { Guidance, Specimen, Specimens } from '../specimen'
import { Specimen as Resizable } from './shell-demo/Specimen'

export const meta = { group: 'Agent', title: 'Lane switcher and compact composer' }

const LANES: Lane[] = [
  { id: 'a', letter: 'A', name: 'Spruce railings', state: 'running' },
  { id: 'b', letter: 'B', name: 'Oak railings', state: 'awaiting-approval' },
  { id: 'c', letter: 'C', name: 'Stone walls', state: 'done' },
  { id: 'd', letter: 'D', name: 'Copper trim', state: 'failed' },
  { id: 'e', letter: 'E', name: 'Glass gallery', state: 'idle' }
]

function Board(): ReactElement {
  const [current, setCurrent] = useState('a')
  const board = useRef<HTMLDivElement>(null)
  const [sent, setSent] = useState<Record<string, string>>({})
  return (
    <div className="flex flex-col gap-3">
      <LaneSwitcher
        lanes={LANES}
        value={current}
        onChange={(id) => {
          setCurrent(id)
          board.current
            ?.querySelector(`[data-lane="${id}"]`)
            ?.scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'smooth' })
        }}
        className="self-start"
      />
      <div ref={board}>
        <LaneColumns min="16rem">
          {LANES.map((l) => (
            <section
              key={l.id}
              data-lane={l.id}
              aria-label={`Lane ${l.letter}: ${l.name}`}
              className="flex flex-col overflow-hidden rounded-lg border border-border-default bg-surface-panel"
            >
              <header className="flex h-(--density-row) items-center gap-2 border-b border-border-default px-3">
                <span className="font-mono text-sm font-semibold">{l.letter}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{l.name}</span>
                <StatusDot state={l.state} />
              </header>
              <p className="h-32 px-3 py-2 text-sm text-fg-secondary">
                {sent[l.id] ?? 'Transcript…'}
              </p>
              <Composer
                variant="compact"
                placeholder={`Message lane ${l.letter}`}
                running={l.state === 'running'}
                disabledReason={
                  l.state === 'failed' ? 'The lane stopped: restart it first' : undefined
                }
                onSend={(t) => setSent((s) => ({ ...s, [l.id]: t }))}
                onStop={() => undefined}
              />
            </section>
          ))}
        </LaneColumns>
      </div>
    </div>
  )
}

export default function LaneSwitcherSection(): ReactElement {
  const [v, setV] = useState('b')
  return (
    <div className="flex flex-col gap-6">
      <Specimens title="Lane switcher: letter and status per lane">
        <Specimen label="current B">
          <LaneSwitcher lanes={LANES} value={v} onChange={setV} />
        </Specimen>
        <Specimen label="two lanes">
          <LaneSwitcher lanes={LANES.slice(0, 2)} value="a" onChange={() => undefined} />
        </Specimen>
      </Specimens>
      <Specimens title="Compact composer: idle, running (Stop), disabled">
        <Specimen label="idle" className="w-72">
          <Composer
            variant="compact"
            placeholder="Message lane A"
            onSend={() => undefined}
            onStop={() => undefined}
            className="w-full"
          />
        </Specimen>
        <Specimen label="running" className="w-72">
          <Composer
            variant="compact"
            placeholder="Message lane A"
            running
            onSend={() => undefined}
            onStop={() => undefined}
            className="w-full"
          />
        </Specimen>
        <Specimen label="disabled" className="w-72">
          <Composer
            variant="compact"
            placeholder="Message lane D"
            disabledReason="The lane stopped: restart it first"
            onSend={() => undefined}
            onStop={() => undefined}
            className="w-full"
          />
        </Specimen>
      </Specimens>
      <Resizable
        label="Variants board: the switcher scrolls the board to a lane"
        resizable
        className="w-[56.25rem]"
      >
        <Board />
      </Resizable>
      <Guidance>
        The switcher shows when lanes do not all fit; on phone it picks the one lane shown. Each
        lane is named with its status for screen readers; status is shape and colour. The compact
        composer keeps Enter to send and skills, and leaves the mode and model to the lane’s thread.
      </Guidance>
    </div>
  )
}
