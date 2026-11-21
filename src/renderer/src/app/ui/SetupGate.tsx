import type { ReactElement, ReactNode } from 'react'
import { ErrorState } from '@/shared/ui/feedback/ErrorState'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
import { useSettings } from '@/entities/settings/model/settings'
import { Setup } from '@/pages/setup/ui/Setup'

/** Setup until it is complete, then the app. */
export function SetupGate({ children }: { children: ReactNode }): ReactElement {
  const settings = useSettings()
  if (settings.isError && !settings.data)
    return (
      <ErrorState
        layout="centered"
        className="h-full"
        title="Setup can’t read your settings"
        error={settings.error}
        onRetry={() => void settings.refetch()}
      >
        Nothing was changed.
      </ErrorState>
    )
  if (!settings.data) return <LoadingState label="Loading Builder Studio…" className="h-full" />
  return settings.data.setup.completed ? <>{children}</> : <Setup />
}
