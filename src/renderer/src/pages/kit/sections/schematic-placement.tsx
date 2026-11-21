import { useState, type ReactElement } from 'react'
import { SchematicPlacementControls } from '@/entities/viewer/ui/SchematicPlacementControls'
import { Specimen } from '../specimen'

export const meta = { group: 'Viewer', title: 'Schematic placement' }

const overlaps = [
  { owner: 'foundation', label: 'Foundation', count: 24 },
  { owner: 'railings', label: 'Bridge railings', count: 1 }
]

export default function SchematicPlacementSection(): ReactElement {
  const [position, setPosition] = useState<[number, number, number]>([-12, 4, 8])
  const [replace, setReplace] = useState<string[]>([])
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Specimen label="Overlaps by part" className="min-w-0">
        <SchematicPlacementControls
          position={position}
          onPositionChange={setPosition}
          overlaps={overlaps}
          replace={replace}
          onReplaceChange={setReplace}
        />
      </Specimen>
      <div className="grid content-start gap-4">
        <Specimen label="Checking" className="min-w-0">
          <SchematicPlacementControls
            position={position}
            onPositionChange={setPosition}
            overlaps={[]}
            replace={[]}
            onReplaceChange={setReplace}
            checking
          />
        </Specimen>
        <Specimen label="No overlaps" className="min-w-0">
          <SchematicPlacementControls
            position={position}
            onPositionChange={setPosition}
            overlaps={[]}
            replace={[]}
            onReplaceChange={setReplace}
          />
        </Specimen>
        <Specimen label="Saving placement" className="min-w-0">
          <SchematicPlacementControls
            position={position}
            onPositionChange={setPosition}
            overlaps={overlaps}
            replace={replace}
            onReplaceChange={setReplace}
            disabled
          />
        </Specimen>
      </div>
    </div>
  )
}
