// What the Import builds dialog does: follow the import state, preview the paths, and recover, bootstrap or import.
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ImportPreview, ImportState } from '@shared/api'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { queryClient, studio } from '@/shared/api/studio'
import { reloadWorkspace, useSettings } from '@/entities/settings/model/settings'
import {
  absolute,
  createPreviewQueue,
  defaultImportSource,
  isImportCopying,
  resolveImportError,
  type ImportErrorKind,
  type PreviewQueue
} from './helpers'

export { absolute, isImportCopying, type ImportErrorKind }
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

interface PreviewTrigger {
  key: string
  source: string
  destination: string
  assets: boolean
  delay: number
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the dialog reads all of it
export function useImportForm(state: ImportState, into: string | undefined, onClose: () => void) {
  const settings = useSettings().data
  const defaultSource = defaultImportSource(settings?.importSource)
  const [sourceDraft, setSourceDraft] = useState<string | null>(null)
  const [destinationDraft, setDestinationDraft] = useState<string | null>(null)
  const source = sourceDraft ?? defaultSource
  const destination = destinationDraft ?? into ?? settings?.workspace ?? ''
  const [assets, setAssetsState] = useState(true)
  const [checking, setChecking] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<{ text: string; kind: ImportErrorKind } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [trigger, setTrigger] = useState<PreviewTrigger | null>(null)
  const [result, setResult] = useState<{ key: string; preview?: ImportPreview; error?: string }>()
  // Only show ImportService.state.error if an import was actively running in this dialog session
  const [sawActiveImport, setSawActiveImport] = useState(() => isImportCopying(state))
  if (isImportCopying(state) && !sawActiveImport) setSawActiveImport(true)

  const copying = isImportCopying(state)
  const busy = copying || pending
  const ready = absolute(source) && absolute(destination)
  const queueRef = useRef<PreviewQueue<ImportPreview> | null>(null)
  const mountedRef = useRef(true)
  const getQueue = (): PreviewQueue<ImportPreview> => {
    queueRef.current ??= createPreviewQueue<ImportPreview>(cancelImport)
    return queueRef.current
  }

  const keyFor = (s: string, d: string, a: boolean, n: number): string =>
    JSON.stringify([s, d, a, n])
  const key = keyFor(source, destination, assets, attempt)
  const preview = result?.key === key ? (result.preview ?? null) : null
  const previewError = result?.key === key ? (result.error ?? '') : ''

  const schedulePreview = (
    nextSource: string,
    nextDestination: string,
    nextAssets: boolean,
    nextAttempt: number,
    delay: number
  ): void => {
    setFailure(null)
    setSawActiveImport(false)
    getQueue().cancel()
    if (!absolute(nextSource) || !absolute(nextDestination)) {
      setTrigger(null)
      return
    }
    setTrigger({
      key: keyFor(nextSource, nextDestination, nextAssets, nextAttempt),
      source: nextSource,
      destination: nextDestination,
      assets: nextAssets,
      delay
    })
  }

  useEffect(() => {
    if (!trigger) return
    const runPreview = (): void => {
      getQueue().enqueue(
        () =>
          studio.workspace.preview({
            source: trigger.source.trim(),
            destination: trigger.destination.trim(),
            assets: trigger.assets
          }),
        {
          onStart: () => mountedRef.current && setChecking(true),
          onSuccess: (p) => mountedRef.current && setResult({ key: trigger.key, preview: p }),
          onError: (e) => mountedRef.current && setResult({ key: trigger.key, error: message(e) }),
          onSettled: () => mountedRef.current && setChecking(false)
        }
      )
    }
    if (trigger.delay <= 0) {
      runPreview()
      return undefined
    }
    const t = setTimeout(runPreview, trigger.delay)
    return () => clearTimeout(t)
  }, [trigger])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      queueRef.current?.cancel()
    }
  }, [])

  const setSource = (next: string, immediate = false): void => {
    setSourceDraft(next)
    schedulePreview(next, destination, assets, attempt, immediate ? 0 : 500)
  }
  const setDestination = (next: string, immediate = false): void => {
    setDestinationDraft(next)
    schedulePreview(source, next, assets, attempt, immediate ? 0 : 500)
  }
  const setAssets = (next: boolean): void => {
    setAssetsState(next)
    schedulePreview(source, destination, next, attempt, 0)
  }
  const triggerPreview = (): void => {
    const nextAttempt = attempt + 1
    setAttempt(nextAttempt)
    schedulePreview(source, destination, assets, nextAttempt, 0)
  }

  const act = async (kind: ImportErrorKind, fn: () => Promise<unknown>): Promise<boolean> => {
    setTrigger(null)
    setPending(true)
    setFailure(null)
    setSawActiveImport(false)
    try {
      await getQueue().cancelAndWait()
      await fn()
      return true
    } catch (e) {
      if (mountedRef.current) setFailure({ text: message(e), kind })
      return false
    } finally {
      if (mountedRef.current) setPending(false)
    }
  }
  const pick = (kind: 'source' | 'destination'): void =>
    void studio.workspace
      .pick(kind === 'source' ? source : destination)
      .then((path) => {
        if (!mountedRef.current || !path) return
        if (kind === 'source') setSource(path, true)
        else setDestination(path, true)
      })
      .catch((e) => {
        if (mountedRef.current) setFailure({ text: message(e), kind: 'action' })
      })
  const recover = async (): Promise<void> => {
    const ok = await act('action', async () => {
      await studio.workspace.recover(destination.trim())
      void queryClient.invalidateQueries()
    })
    if (ok) {
      toast.success('Recovery check complete')
      if (mountedRef.current && ready) triggerPreview()
    }
  }
  const bootstrap = async (): Promise<void> => {
    const ok = await act('action', () => studio.workspace.bootstrap())
    if (ok) toast.success('Workspace Git initialized')
  }
  const copy = async (id: string): Promise<void> => {
    const ok = await act('import', async () => {
      await studio.workspace.import(id)
      reloadWorkspace()
      onClose()
    })
    // ImportService.run() consumes the staged plan regardless of outcome; invalidate so retry re-previews
    if (!ok && mountedRef.current) setResult(undefined)
  }

  const { error, errorKind } = resolveImportError({
    failure,
    previewError,
    state,
    sawActiveImport
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
    copying,
    busy,
    ready,
    triggerPreview,
    preview,
    error,
    errorKind,
    pick,
    recover,
    bootstrap,
    copy
  }
}
