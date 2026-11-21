// Saving settings as they change, and what the app detects for empty fields.
import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query'
import { queryClient, studio } from '@/shared/api/studio'
import { reloadWorkspace } from './settings'
import { useDetected } from '@/entities/settings/model/detected'
import type { Settings } from '@shared/api'

/** Settings that only take effect after the window reloads. */
const RELOAD_KEYS = ['provider', 'codex', 'gitBash', 'ollamaEndpoint', 'ollamaModel'] as const
// saves run one after another, each on top of the last saved settings
let queue: Promise<unknown> = Promise.resolve()

/** Saves a change on its own: no Save button. */
export function useSaveSettings(): UseMutationResult<
  { prev: Settings; next: Settings },
  Error,
  Partial<Settings>
> {
  return useMutation({
    mutationKey: ['settings', 'save'],
    mutationFn: (patch: Partial<Settings>) => {
      const run = queue.then(async () => {
        const prev =
          queryClient.getQueryData<Settings>(['settings']) ?? (await studio.settings.get())
        const next = await studio.settings.set({ ...prev, ...patch })
        queryClient.setQueryData(['settings'], next)
        return { prev, next }
      })
      queue = run.catch(() => undefined)
      return run
    },
    onSuccess: ({ prev, next }) => {
      if (next.workspace !== prev.workspace) reloadWorkspace()
      else if (RELOAD_KEYS.some((key) => next[key] !== prev[key])) window.location.reload()
      else void queryClient.invalidateQueries()
    }
  })
}

export type PathKey = Exclude<
  keyof Settings,
  | 'agentAllow'
  | 'variantCap'
  | 'appearance'
  | 'version'
  | 'importSource'
  | 'setup'
  | 'provider'
  | 'previousRuntime'
  | 'browser'
  | 'git'
>

/** What the app uses when a field is empty: shown as the grey placeholder. Detected first, else the resolved path. */
export function useLocations(): Partial<Record<PathKey, string>> {
  const paths = useQuery({ queryKey: ['paths'], queryFn: () => studio.settings.checkPaths() })
  const detected = useDetected().data ?? {}
  return Object.fromEntries([
    ...(paths.data ?? []).map((p) => [p.name, p.path]),
    ...Object.entries(detected).filter(([, path]) => path)
  ])
}

/** Settings whose saved path doesn't exist on disk: the field says so before anything fails. */
export function useMissingPaths(): Set<string> {
  const paths = useQuery({ queryKey: ['paths'], queryFn: () => studio.settings.checkPaths() })
  return new Set((paths.data ?? []).filter((p) => !p.ok).map((p) => p.name))
}
