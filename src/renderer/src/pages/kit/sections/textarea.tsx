import type { ReactElement } from 'react'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { forceFocus, LONG, RTL_TEXT, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Forms', title: 'Textarea' }

const RAW = `# harbor_lighthouse

## Status
- Round: 5
- Picked: v5_copper_roof

## Round 5 · Copper roof
Weathered cut copper for the lamp room roof; the gallery railing is dark_oak_fence.
	A very long line that does not wrap, so the raw file keeps its shape and the field scrolls sideways instead.`

export default function TextareaSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens className="*:w-72">
        <Specimen label="empty (type to grow)">
          <Textarea aria-label="Brief" placeholder="Describe the build: style, size, materials" />
        </Specimen>
        <Specimen label="filled, grows to max-h then scrolls">
          <Textarea aria-label="Brief" defaultValue={`${LONG}\n\n${LONG}\n\n${LONG}`} />
        </Specimen>
        <Specimen label="focus">
          <Textarea
            aria-label="Brief"
            defaultValue="A tower"
            className={forceFocus}
            tabIndex={-1}
          />
        </Specimen>
        <Specimen label="invalid">
          <Textarea aria-label="Brief" aria-invalid defaultValue="" />
        </Specimen>
        <Specimen label="disabled">
          <Textarea aria-label="Brief" disabled defaultValue="Locked while the draft runs" />
        </Specimen>
        <Specimen label="read-only">
          <Textarea aria-label="Brief" readOnly defaultValue="Round 2 notes are read-only" />
        </Specimen>
        <Specimen label="RTL">
          <Textarea aria-label="RTL" dir="rtl" defaultValue={RTL_TEXT} />
        </Specimen>
      </Specimens>
      <Specimens title="Code variant: raw-file editing (Design log), 14px mono, no wrap, fills its pane">
        <Specimen label="in a 20rem pane" className="w-full max-w-3xl">
          <div className="h-80 w-full">
            <Textarea variant="code" aria-label="DESIGN.md, raw" defaultValue={RAW} />
          </div>
        </Specimen>
        <Specimen label="focus" className="w-72">
          <div className="h-60 w-full">
            <Textarea
              variant="code"
              aria-label="Focus"
              defaultValue={RAW}
              className={forceFocus}
              tabIndex={-1}
            />
          </div>
        </Specimen>
        <Specimen label="invalid (refused save)" className="w-72">
          <div className="h-60 w-full">
            <Textarea variant="code" aria-label="Invalid" aria-invalid defaultValue={RAW} />
          </div>
        </Specimen>
        <Specimen label="read-only (while saving)" className="w-72">
          <div className="h-60 w-full">
            <Textarea variant="code" aria-label="Read-only" readOnly defaultValue={RAW} />
          </div>
        </Specimen>
        <Specimen label="disabled" className="w-72">
          <div className="h-60 w-full">
            <Textarea variant="code" aria-label="Disabled" disabled defaultValue={RAW} />
          </div>
        </Specimen>
      </Specimens>
    </div>
  )
}
