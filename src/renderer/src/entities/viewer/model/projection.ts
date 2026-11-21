// The viewers' projection, one choice for every viewer on screen, kept until the app closes.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type Projection = 'perspective' | 'isometric'

export const useProjection = create<{ projection: Projection }>()(
  persist(() => ({ projection: 'isometric' as Projection }), {
    name: 'viewer-projection',
    storage: createJSONStorage(() => sessionStorage)
  })
)
