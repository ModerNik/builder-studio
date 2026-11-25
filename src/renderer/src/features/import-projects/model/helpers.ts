import type { ImportState } from '@shared/api'

export type ImportErrorKind = 'preview' | 'import' | 'action'

export const absolute = (p: string): boolean => /^[a-z]:[\\/]|^\\\\/i.test(p.trim())

export const isImportCopying = (state: ImportState): boolean =>
  state.busy && state.stage !== 'scanning'

/** Only prefill a saved importSource suggestion when it is a valid absolute path. */
export const defaultImportSource = (importSource?: string): string =>
  importSource && absolute(importSource) ? importSource : ''

/**
 * Resolves the single error banner to show in the Import Builds dialog.
 * Never surfaces stale singleton `state.error` unless an import actually ran in this dialog session.
 */
export function resolveImportError({
  failure,
  previewError,
  state,
  sawActiveImport
}: {
  failure: { text: string; kind: ImportErrorKind } | null
  previewError: string
  state: ImportState
  sawActiveImport: boolean
}): { error: string; errorKind: ImportErrorKind } {
  const copying = isImportCopying(state)
  const liveStateError = sawActiveImport && !copying ? (state.error ?? '') : ''
  const error = failure?.text || previewError || liveStateError
  const errorKind: ImportErrorKind = failure ? failure.kind : previewError ? 'preview' : 'import'
  return { error, errorKind }
}

export interface PreviewQueue<T> {
  /** Cancels any active scan without losing track of its unwinding promise. */
  cancel: () => void
  /** Cancels any active scan and waits for its unwinding promise to settle before running another workspace operation. */
  cancelAndWait: () => Promise<void>
  /** Runs `fn` only after any previously cancelled scan has settled, ignoring stale results. */
  enqueue: (
    fn: () => Promise<T>,
    callbacks: {
      onStart: () => void
      onSuccess: (value: T) => void
      onError: (error: unknown) => void
      onSettled: () => void
    }
  ) => void
}

/**
 * Serializes workspace:preview calls so cancelling a running preview waits for main's
 * workspaceOperation lock to release before launching the replacement preview.
 */
export function createPreviewQueue<T>(onCancel: () => void): PreviewQueue<T> {
  let seq = 0
  let inFlight: Promise<void> | null = null
  let inFlightId = 0
  let active = false

  const cancel = (): void => {
    seq++
    if (active) {
      active = false
      onCancel()
    }
  }

  const cancelAndWait = async (): Promise<void> => {
    cancel()
    const pending = inFlight
    if (pending) await pending.catch(() => {})
  }

  const enqueue: PreviewQueue<T>['enqueue'] = (fn, { onStart, onSuccess, onError, onSettled }) => {
    const id = ++seq
    const prev = inFlight
    inFlightId = id
    onStart()
    const settle = (): void => {
      if (inFlightId === id) {
        inFlight = null
        onSettled()
      }
    }
    inFlight = (async () => {
      if (prev) await prev.catch(() => {})
      if (id !== seq) {
        settle()
        return
      }
      active = true
      try {
        const value = await fn()
        if (id === seq) onSuccess(value)
      } catch (e) {
        if (id === seq) onError(e)
      } finally {
        active = false
        settle()
      }
    })()
  }

  return { cancel, cancelAndWait, enqueue }
}
