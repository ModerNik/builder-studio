import { useState, type ReactElement } from 'react'
import { HistoryList } from '@/widgets/block-editor/ui/HistoryList'
import type { Edit } from '@/entities/block-edit/model/history'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Editor', title: 'History list' }

const cells = (n: number): Edit['changes'] =>
  Array.from({ length: n }, (_, i) => [`${i},64,0`, undefined, 'minecraft:stone'])
const EDITS: Edit[] = [
  { label: 'Place oak_stairs', tool: 'place', changes: cells(1) },
  { label: 'Place oak_stairs', tool: 'place', changes: cells(1) },
  { label: 'Edit oak_stairs', tool: 'select', changes: cells(1) },
  { label: 'Erase 24 blocks', tool: 'select', changes: cells(24) },
  { label: 'Erase lantern', tool: 'erase', changes: cells(1) }
]

export default function HistoryListSection(): ReactElement {
  const [cursor, setCursor] = useState(3)
  const move = (to: number): void => setCursor(Math.max(0, Math.min(EDITS.length, to)))
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen
          label="Two edits undone: click any row to go there, Start for the build as it opened"
          className="w-[18.75rem] max-w-full"
        >
          <HistoryList
            className="w-full"
            edits={EDITS}
            cursor={cursor}
            onJump={move}
            onUndo={() => move(cursor - 1)}
            onRedo={() => move(cursor + 1)}
            handEdits={26}
            save="saved"
            onDiscard={() => setCursor(0)}
            build="stone_bridge"
          />
        </Specimen>
        <Specimen label="Saving hand edits" className="w-[18.75rem] max-w-full">
          <HistoryList
            className="w-full"
            edits={EDITS.slice(0, 1)}
            cursor={1}
            onJump={() => {}}
            onUndo={() => {}}
            onRedo={() => {}}
            handEdits={1}
            save="saving"
            onDiscard={() => {}}
            build="stone_bridge"
          />
        </Specimen>
        <Specimen label="Save failed" className="w-[18.75rem] max-w-full">
          <HistoryList
            className="w-full"
            edits={EDITS.slice(0, 2)}
            cursor={2}
            onJump={() => {}}
            onUndo={() => {}}
            onRedo={() => {}}
            handEdits={240}
            save="failed"
            onDiscard={() => {}}
            build="stone_bridge"
          />
        </Specimen>
        <Specimen label="No edits yet" className="w-[18.75rem] max-w-full">
          <HistoryList
            className="w-full"
            edits={[]}
            cursor={0}
            onJump={() => {}}
            onUndo={() => {}}
            onRedo={() => {}}
            handEdits={0}
            onDiscard={() => {}}
            build="stone_bridge"
          />
        </Specimen>
      </Specimens>
      <Guidance>
        History is the session&apos;s log; the hand edits themselves are saved with the build, so a
        build reopened with saved edits starts with an empty log and Discard still offered.
      </Guidance>
    </div>
  )
}
