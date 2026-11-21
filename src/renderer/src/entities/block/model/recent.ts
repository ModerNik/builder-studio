// The blocks the user placed lately and the ones they starred, kept on this computer.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const KEEP = 32

export const useBlockPicks = create<{
  recent: string[] // block ids, newest first
  favourites: string[]
  use: (id: string) => void
  toggleFavourite: (id: string) => void
}>()(
  persist(
    (set) => ({
      recent: [],
      favourites: [],
      use: (id) =>
        set((s) => ({ recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, KEEP) })),
      toggleFavourite: (id) =>
        set((s) => ({
          favourites: s.favourites.includes(id)
            ? s.favourites.filter((f) => f !== id)
            : [...s.favourites, id]
        }))
    }),
    { name: 'bs.blocks.picks', partialize: ({ recent, favourites }) => ({ recent, favourites }) }
  )
)

/** The Recent category: starred blocks first, then the latest placed. */
export const recentIds = (s: { recent: string[]; favourites: string[] }): string[] => [
  ...s.favourites,
  ...s.recent.filter((id) => !s.favourites.includes(id))
]
