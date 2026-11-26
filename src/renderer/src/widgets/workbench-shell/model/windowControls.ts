// Desktop window chrome state: detects Electron's preload window controls and tracks maximize/restore.
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { StudioApi } from '@shared/api'

type WindowControlsOverlay = EventTarget & { visible: boolean }
const overlay = (): WindowControlsOverlay | undefined =>
  typeof navigator !== 'undefined'
    ? (navigator as Navigator & { windowControlsOverlay?: WindowControlsOverlay })
        .windowControlsOverlay
    : undefined

const windowApi = (): StudioApi['window'] | undefined =>
  typeof window !== 'undefined' ? window.studio?.window : undefined

function useOverlayVisible(): boolean {
  return useSyncExternalStore(
    (change) => {
      overlay()?.addEventListener('geometrychange', change)
      return () => overlay()?.removeEventListener('geometrychange', change)
    },
    () => !!overlay()?.visible,
    () => false
  )
}

export interface WindowChromeState {
  /** True inside the desktop app (enables the title-bar drag region). */
  isApp: boolean
  /** True on Windows and Linux where the renderer draws Minimize, Maximize / Restore and Close. */
  customControls: boolean
  maximized: boolean
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
}

export function useWindowChrome(): WindowChromeState {
  const overlayVisible = useOverlayVisible()
  const api = windowApi()
  const customControls = !!api?.controls
  const isApp = !!api || overlayVisible
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!api?.controls) return
    let live = true
    void api
      .state()
      .then((s) => {
        if (live) setMaximized(s.maximized)
      })
      .catch(() => {})
    const off = api.onState((s) => setMaximized(s.maximized))
    return () => {
      live = false
      off()
    }
  }, [api])

  return {
    isApp,
    customControls,
    maximized,
    minimize: () => void api?.minimize(),
    toggleMaximize: () => void api?.toggleMaximize(),
    close: () => void api?.close()
  }
}
