// Settings › General: opening the workspace, running setup again, and the updater's buttons.
import { useMutation } from '@tanstack/react-query'
import { studio } from '@/shared/api/studio'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads all of it
export function useGeneralActions() {
  const open = useMutation({ mutationFn: () => studio.workspace.open() })
  const rerun = useMutation({
    mutationFn: () => studio.setup.progress({ step: 'welcome', completed: false }),
    onSuccess: () => window.location.reload()
  })
  return { open, rerun }
}

export const showNotices = (): void => void studio.updater.notices()
export const installUpdate = (): void => void studio.updater.install()
export const checkForUpdates = (): void => void studio.updater.check()
