import { createContext, useContext } from 'react'
import type { DockAction, Tier } from '@/shared/lib/layout'

export interface WorkbenchContextValue {
  tier: Tier
  openPanels?: string[]
  /** Open, close or switch dock panels (the toggles, Ctrl I / J / `). */
  dock: (action: DockAction) => void
}

// outside a shell (kit demos, tests) pieces render at the wide tier and dock actions do nothing
export const WorkbenchContext = createContext<WorkbenchContextValue>({
  tier: 'wide',
  dock: () => {}
})
export const useWorkbench = (): WorkbenchContextValue => useContext(WorkbenchContext)
