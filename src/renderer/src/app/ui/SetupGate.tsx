import { lazy, Suspense, type ReactElement, type ReactNode } from 'react'
import { ErrorState } from '@/shared/ui/feedback/ErrorState'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
import { useSettings } from '@/entities/settings/model/settings'
import { usePrefetchBuilds } from '@/entities/build/model/builds'

// most launches never show setup: its chunk loads only when it does
const Setup = lazy(() => import('@/pages/setup/ui/Setup').then((m) => ({ default: m.Setup })))

/** Setup until it is complete, then the app. */
export function SetupGate({ children }: { children: ReactNode }): ReactElement {
  const settings = useSettings()
  usePrefetchBuilds(settings.data?.setup.completed === false)
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
  return settings.data.setup.completed ? (
    <>{children}</>
  ) : (
    <Suspense fallback={<LoadingState label="Loading Builder Studio…" className="h-full" />}>
      <Setup />
    </Suspense>
  )
}
