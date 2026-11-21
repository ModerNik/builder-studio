// The open build's hand edits and their history, kept for the session. The editor hook loads and saves them.
import { create } from 'zustand'
import { EMPTY, commit, moveTo, type History, type Layer } from './history'
import type { ToolId } from './edit'

export type SaveState = 'saved' | 'saving' | 'failed'

export const useEdits = create<{
  build: string | null // whose edits are loaded
  history: History
  changed: number // bumps on every change, so the editor saves
  save: SaveState
  load: (build: string, layer: Layer) => void
  commit: (
    label: string,
    tool: ToolId,
    cells: Iterable<[string, string | null | undefined]>
  ) => void
  moveTo: (cursor: number) => void
  setSave: (save: SaveState) => void
}>()((set) => ({
  build: null,
  history: EMPTY,
  changed: 0,
  save: 'saved',
  load: (build, layer) => set({ build, history: { layer, edits: [], cursor: 0 }, save: 'saved' }),
  commit: (label, tool, cells) =>
    set((s) => {
      const history = commit(s.history, label, tool, cells)
      return history === s.history ? s : { history, changed: s.changed + 1 }
    }),
  moveTo: (cursor) =>
    set((s) => {
      const history = moveTo(s.history, cursor)
      return history === s.history ? s : { history, changed: s.changed + 1 }
    }),
  setSave: (save) => set({ save })
}))
