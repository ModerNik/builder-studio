import { useState, type ReactElement } from 'react'
import { Keyboard } from 'lucide-react'
import { useShortcuts } from '@/shared/lib/shortcuts'
import { Kbd } from '@/shared/ui/common/parts'
import { ShortcutsDialog } from '@/widgets/workbench-shell/ui/ShortcutsDialog'
import { Button } from '@/shared/ui/primitives/button'
import { Specimen } from './shell-demo/Specimen'

export const meta = { group: 'Shell', title: 'Shortcuts and focus order' }

const ORDER = [
  ['Skip link', 'First Tab on the page jumps straight to the screen.'],
  ['Title bar', 'App mark, breadcrumb and build switcher, search, setup, actions.'],
  ['Screen tabs', 'One stop; arrow keys move between screens.'],
  ['Dock toggles', 'Editor, Chat, Activity (Ctrl I, Ctrl J, Ctrl `).'],
  ['Screen', 'The canvas and its overlays.'],
  ['Right dock', 'One column at a time, tabs first.'],
  ['Bottom dock', 'Activity.']
]

export default function ShortcutsDemo(): ReactElement {
  const [open, setOpen] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  useShortcuts([
    {
      keys: 'Alt+R',
      label: 'Rotate the view a quarter turn',
      group: 'Kit demo',
      run: () => setLast('Rotate the view a quarter turn')
    },
    { keys: 'Alt+P', label: 'Add a pin', group: 'Kit demo', run: () => setLast('Add a pin') }
  ])
  return (
    <div>
      <p className="mb-4 max-w-prose text-fg-secondary">
        Components register shortcuts where they are used; the newest registration of a key wins,
        and the Keyboard shortcuts list (?) is built from what is registered right now. Single keys
        never fire while typing in a field.
      </p>
      <Specimen label="Registry" className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Keyboard aria-hidden="true" />
          Show all shortcuts
        </Button>
        <span className="text-fg-secondary">
          Try <Kbd keys="Alt+R" className="pointer-coarse:inline-flex" /> or{' '}
          <Kbd keys="Alt+P" className="pointer-coarse:inline-flex" />
        </span>
        <output aria-live="polite" className="text-fg">
          {last ? `Ran: ${last}` : 'Nothing run yet'}
        </output>
        <ShortcutsDialog open={open} onOpenChange={setOpen} />
      </Specimen>
      <Specimen label="Focus order in the workbench; F6 and Shift F6 jump between regions">
        <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
          {ORDER.map(([name, what], i) => (
            <li key={name} className="contents">
              <span className="font-medium">
                {i + 1}. {name}
              </span>
              <span className="text-fg-secondary">{what}</span>
            </li>
          ))}
        </ol>
      </Specimen>
    </div>
  )
}
