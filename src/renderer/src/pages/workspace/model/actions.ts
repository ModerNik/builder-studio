// What the Workspace screen does besides showing a build: report its state to the agent tools, delete a
// version, and change the build's Minecraft target.
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AppState } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'
import { errorText } from '@/entities/build/model/workspace'

/** MCP status(): what the workspace shows right now. */
export function useReportWorkspace(
  build: string,
  version: string | null,
  tab: AppState['tab'],
  pick: AppState['pick'],
  parts: AppState['parts']
): void {
  useEffect(() => {
    studio.app.report({ build, version, tab, pick, parts, review: null })
  }, [build, version, tab, pick, parts])
}

export const deleteVersion = (path: string, onDeleted: () => void): void =>
  void studio.builds.deleteVersion(path).then(onDeleted, (error) => toast.error(errorText(error)))

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the dialog reads all of it
export function useUpgradeTarget(
  name: string,
  current: string,
  onOpenChange: (open: boolean) => void
) {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const version = selectedVersion ?? current
  const [busy, setBusy] = useState(false)
  const close = (): void => {
    setSelectedVersion(null)
    onOpenChange(false)
  }
  const upgrade = async (): Promise<void> => {
    if (busy || version === current) return
    setBusy(true)
    try {
      await studio.builds.upgrade(name, version)
      await queryClient.invalidateQueries({ queryKey: ['builds'] })
      close()
    } catch (error) {
      toast.error(`Couldn’t upgrade the Minecraft target: ${String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  return { version, setSelectedVersion, busy, close, upgrade }
}
