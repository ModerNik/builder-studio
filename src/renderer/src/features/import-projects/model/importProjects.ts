// What the Import builds dialog does: follow the import state, preview the paths, and recover, bootstrap or import.
import { useEffect, useRef, useState } from 'react'
import type { ImportPreview, ImportState } from '@shared/api'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { queryClient, studio } from '@/shared/api/studio'
import { reloadWorkspace, useSettings } from '@/entities/settings/model/settings'

export const absolute = (p: string): boolean => /^[a-z]:[\\/]|^\\\\/i.test(p.trim())
const message = errorMessage

export function useImportState(): ImportState {
  const [state, setState] = useState<ImportState>({
    busy: false,
    stage: 'idle',
    copied: 0,
    total: 0
  })
  useEffect(() => {
    void studio.workspace.state().then(setState)
    return studio.workspace.onState(setState)
  }, [])
  return state
}

export const cancelImport = (): void => void studio.workspace.cancel()

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the dialog reads all of it
export function useImportForm(state: ImportState, into: string | undefined, onClose: () => void) {
  const settings = useSettings().data
  const [source, setSource] = useState(settings?.importSource ?? '')
  const [destination, setDestination] = useState(into ?? settings?.workspace ?? '')
  const [assets, setAssets] = useState(true)
  const [checking, setChecking] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setError] = useState('')
  const busy = state.busy || pending
  const ready = absolute(source) && absolute(destination)
  const run = useRef(0)
  const [attempt, setAttempt] = useState(0) // Try again reruns the preview
  // a result belongs to the inputs it was made for, so editing a path or the box hides it
  const key = JSON.stringify([source, destination, assets, attempt])
  const [result, setResult] = useState<{ key: string; preview?: ImportPreview; error?: string }>()
  const preview = result?.key === key ? (result.preview ?? null) : null
  const error = failure || (result?.key === key ? (result.error ?? '') : '')

  // a preview as soon as both paths are full paths
  useEffect(() => {
    if (!ready) return
    const id = ++run.current
    const t = setTimeout(() => {
      setChecking(true)
      studio.workspace
        .preview({ source: source.trim(), destination: destination.trim(), assets })
        .then((p) => id === run.current && setResult({ key, preview: p }))
        .catch((e) => id === run.current && setResult({ key, error: message(e) }))
        .finally(() => id === run.current && setChecking(false))
    }, 500)
    return () => clearTimeout(t)
  }, [source, destination, assets, ready, key])

  const act = async (fn: () => Promise<unknown>): Promise<void> => {
    setPending(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(message(e))
    } finally {
      setPending(false)
    }
  }
  const pick = (kind: 'source' | 'destination'): void =>
    void studio.workspace
      .pick(kind === 'source' ? source : destination)
      .then((path) => path && (kind === 'source' ? setSource(path) : setDestination(path)))
  const recover = (): Promise<void> =>
    act(async () => {
      await studio.workspace.recover(destination.trim())
      void queryClient.invalidateQueries()
    })
  const bootstrap = (): Promise<void> => act(() => studio.workspace.bootstrap())
  const copy = (id: string): Promise<void> =>
    act(async () => {
      await studio.workspace.import(id)
      reloadWorkspace()
      onClose()
    })

  return {
    settings,
    source,
    setSource,
    destination,
    setDestination,
    assets,
    setAssets,
    checking,
    busy,
    ready,
    setAttempt,
    preview,
    error,
    pick,
    recover,
    bootstrap,
    copy
  }
}
