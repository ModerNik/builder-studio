// Render Studio Lightbox and Sheet Viewer Lightbox state stores (persisted user studio preferences).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  defaultStudioSettings,
  getPreset,
  type PresetId,
  type StudioCameraPreset,
  type StudioSettings
} from '@/entities/viewer/lib/cinematic/presets'
import type { Projection } from '@/entities/viewer/lib/render/renderer'

export interface RenderStudioLaunch {
  build: string
  versionPath?: string | null
  initialView?: StudioCameraPreset
  initialProjection?: Projection
  initialClipY?: number | null
}

interface RenderStudioStore {
  open: boolean
  sessionId: number
  launch: RenderStudioLaunch | null
  openStudio: (launch: RenderStudioLaunch) => void
  closeStudio: () => void
  setVersionPath: (versionPath: string) => void
}

export const useRenderStudio = create<RenderStudioStore>((set) => ({
  open: false,
  sessionId: 0,
  launch: null,
  openStudio: (launch) => set((s) => ({ open: true, sessionId: s.sessionId + 1, launch })),
  closeStudio: () => set({ open: false }),
  setVersionPath: (versionPath) =>
    set((s) => (s.launch ? { launch: { ...s.launch, versionPath } } : s))
}))

export const openRenderStudio = (launch: RenderStudioLaunch): void =>
  useRenderStudio.getState().openStudio(launch)

export interface SheetViewerItem {
  build: string
  path: string
  mtime?: number
}

interface SheetViewerStore {
  open: boolean
  item: SheetViewerItem | null
  openSheet: (item: SheetViewerItem) => void
  closeSheet: () => void
}

export const useSheetViewer = create<SheetViewerStore>((set) => ({
  open: false,
  item: null,
  openSheet: (item) => set({ open: true, item }),
  closeSheet: () => set({ open: false })
}))

export const openSheetViewer = (item: SheetViewerItem): void =>
  useSheetViewer.getState().openSheet(item)

interface StudioSettingsStore {
  settings: StudioSettings
  applyPreset: (id: Exclude<PresetId, 'custom'>) => void
  patch: (partial: Partial<StudioSettings>, markCustom?: boolean) => void
  reset: () => void
}

export const useStudioSettings = create<StudioSettingsStore>()(
  persist(
    (set) => ({
      settings: defaultStudioSettings(),
      applyPreset: (id) =>
        set((s) => ({
          settings: {
            ...s.settings,
            ...getPreset(id).look,
            preset: id
          }
        })),
      patch: (partial, markCustom = false) =>
        set((s) => ({
          settings: {
            ...s.settings,
            ...partial,
            ...(markCustom ? { preset: 'custom' as const } : {})
          }
        })),
      reset: () => set({ settings: defaultStudioSettings() })
    }),
    {
      name: 'render-studio-settings',
      partialize: (s) => ({ settings: s.settings }),
      merge: (persisted, current) => {
        const stored = (persisted as { settings?: Partial<StudioSettings> } | undefined)?.settings
        return {
          ...current,
          settings: { ...defaultStudioSettings(), ...(stored ?? {}) }
        }
      }
    }
  )
)
