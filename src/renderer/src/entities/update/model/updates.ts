// The app updater's state for Settings › General and the Crashed page.
import { useEffect, useState } from 'react'
import type { UpdateState } from '@shared/api'
import { studio } from '@/shared/api/studio'

export const releasesUrl = 'https://github.com/ModerNik/builder-studio/releases'

export function updateText(state: UpdateState): string {
  switch (state.s) {
    case 'off':
      return state.why
    case 'idle':
      return 'You’re up to date. New versions download in the background.'
    case 'checking':
      return 'Checking for a new version…'
    case 'downloading':
      return `Downloading ${state.version}… ${state.percent}%`
    case 'ready':
      return `${state.version} is downloaded. Restart to install it.`
    case 'error':
      return 'The update couldn’t be completed. Try again or get the installer from GitHub Releases.'
  }
}

/** The running version and the updater's live state; null until the first answer. */
export function useUpdates(): { version: string; state: UpdateState } | null {
  const [info, setInfo] = useState<{ version: string; state: UpdateState } | null>(null)
  useEffect(() => {
    void studio.updater.get().then(setInfo)
    return studio.updater.onState((state) => setInfo((i) => i && { ...i, state }))
  }, [])
  return info
}
