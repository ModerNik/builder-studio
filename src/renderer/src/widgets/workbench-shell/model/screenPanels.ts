// Dock panels the open screen adds to the shell (after the Assistant): set on mount, cleared on unmount.
import { useSyncExternalStore } from 'react'
import type { WorkbenchPanel } from '@/widgets/workbench-shell/ui/Dock'

let panels: WorkbenchPanel[] = []
const listeners = new Set<() => void>()

export function setScreenPanels(next: WorkbenchPanel[]): void {
  panels = next
  listeners.forEach((l) => l())
}

export const clearScreenPanels = (): void => setScreenPanels([])

export function subscribeScreenPanels(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getScreenPanels = (): WorkbenchPanel[] => panels

export const useScreenPanels = (): WorkbenchPanel[] =>
  useSyncExternalStore(subscribeScreenPanels, getScreenPanels)
