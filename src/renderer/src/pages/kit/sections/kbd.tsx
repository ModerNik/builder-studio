import type { ReactElement } from 'react'
import { Kbd, Shortcut, ShortcutHint } from '@/shared/ui/primitives/kbd'
import { Specimen, Specimens } from '../specimen'

export const meta = { group: 'Display', title: 'Kbd and shortcut' }

export default function KbdSection(): ReactElement {
  return (
    <Specimens>
      <Specimen label="key">
        <Kbd>Esc</Kbd>
      </Specimen>
      <Specimen label="combination">
        <Shortcut keys="Ctrl+Shift+P" />
      </Specimen>
      <Specimen label="plus key">
        <Shortcut keys="Ctrl++" />
      </Specimen>
      <Specimen label="hint">
        <ShortcutHint keys="Ctrl+K">Open the palette</ShortcutHint>
      </Specimen>
      <Specimen label="in text">
        <p className="text-fg-secondary">
          Press <Kbd>[</Kbd> or <Kbd>]</Kbd> to move the clip height one layer.
        </p>
      </Specimen>
    </Specimens>
  )
}
