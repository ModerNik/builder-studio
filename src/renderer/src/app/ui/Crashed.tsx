// What the window shows when rendering throws: the error, the updater (so a broken release can still reach the
// fix) and a reset of the UI state this window keeps, which may be what keeps crashing it.
import type { ReactElement } from 'react'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '@/shared/ui/primitives/button'
import { TitleBar } from '@/widgets/workbench-shell/ui/TitleBar'
import { WorkbenchShell } from '@/widgets/workbench-shell/ui/WorkbenchShell'
import { ErrorDetails } from '@/shared/ui/feedback/ErrorState'
import { SettingsPanel } from '@/entities/settings/ui/Settings'
import { useUpdates } from '@/entities/update/model/updates'
import { Updates } from '@/pages/settings/ui/General'

const resetLayout = (): void => {
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // blocked storage: the reload below still drops the route
  }
  location.replace(location.pathname) // without the #/route, back to the gallery
}

/** The crash page with its own title bar, for errors that took the app shell down with them. */
export function CrashedWindow(props: ErrorComponentProps): ReactElement {
  return (
    <WorkbenchShell
      layoutId="crashed"
      titleBar={<TitleBar crumbs={[]} onHome={() => location.replace(location.pathname)} />}
      screens={[]}
      screen=""
      onScreenChange={() => {}}
      panels={[]}
      status={null}
      skipLabel="Skip to the error"
    >
      <Crashed {...props} />
    </WorkbenchShell>
  )
}

export function Crashed({ error }: ErrorComponentProps): ReactElement {
  const ready = useUpdates()?.state.s === 'ready'
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-dialog-lg flex-col gap-6 px-4 py-10 sm:px-8 sm:py-14">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl">Builder Studio hit an error</h1>
          <p className="text-fg-secondary">
            Your builds and settings are safe. If an update is ready, installing it may fix this.
          </p>
        </header>
        <ErrorDetails error={error} />
        <SettingsPanel>
          <Updates />
        </SettingsPanel>
        <div className="flex flex-wrap gap-2">
          {/* when an update is ready, its Restart to update above is the main button */}
          <Button variant={ready ? 'outline' : 'default'} onClick={() => location.reload()}>
            Reload
          </Button>
          <Button variant="outline" onClick={resetLayout}>
            Reset layout and reload
          </Button>
        </div>
        <p className="text-sm text-fg-muted">
          Reset layout forgets what this window remembers: open panels, remembered run options,
          dismissed notices. It doesn’t touch builds, the workspace or Settings.
        </p>
      </div>
    </div>
  )
}
