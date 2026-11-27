import { useState, type ReactElement } from 'react'
import { useShortcuts } from '@/shared/lib/shortcuts'
import { usePerfHud } from '../model/perf'
import { PerfHudPanel } from './PerfHudPanel'

/** Dev-only floating performance HUD, toggled with Ctrl+Shift+P. Shell lazy-loads it in development only. */
export default function PerfHud(): ReactElement | null {
  const [open, setOpen] = useState(false)
  const groups = usePerfHud(open)
  useShortcuts([
    {
      keys: 'Ctrl+Shift+P',
      label: 'Performance HUD (dev)',
      group: 'App',
      inModals: true,
      run: () => setOpen((o) => !o)
    }
  ])
  if (!open) return null
  return (
    <PerfHudPanel
      groups={groups}
      onClose={() => setOpen(false)}
      className="fixed bottom-3 left-3 z-tooltip max-h-[calc(100vh-1.5rem)] overflow-y-auto"
    />
  )
}
