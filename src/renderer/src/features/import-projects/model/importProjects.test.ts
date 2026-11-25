import { describe, expect, it, vi } from 'vitest'
import {
  absolute,
  createPreviewQueue,
  defaultImportSource,
  isImportCopying,
  resolveImportError
} from './helpers'

describe('importProjects helpers', () => {
  it('recognizes absolute Windows drive and UNC paths', () => {
    expect(absolute('C:\\Users\\test\\workspace')).toBe(true)
    expect(absolute('d:/builds/old')).toBe(true)
    expect(absolute('\\\\server\\share\\workspace')).toBe(true)
    expect(absolute('  D:\\workspace  ')).toBe(true)
    expect(absolute('')).toBe(false)
    expect(absolute('old checkout')).toBe(false)
    expect(absolute('./builds')).toBe(false)
  })

  it('ignores non-absolute legacy importSource values on dialog open', () => {
    expect(defaultImportSource('old checkout')).toBe('')
    expect(defaultImportSource('')).toBe('')
    expect(defaultImportSource(undefined)).toBe('')
    expect(defaultImportSource('D:\\legacy-workspace')).toBe('D:\\legacy-workspace')
  })

  it('distinguishes active copying/recovery from preview scanning', () => {
    expect(isImportCopying({ busy: false, stage: 'idle', copied: 0, total: 0 })).toBe(false)
    expect(isImportCopying({ busy: true, stage: 'scanning', copied: 0, total: 0 })).toBe(false)
    expect(isImportCopying({ busy: true, stage: 'validating', copied: 0, total: 100 })).toBe(true)
    expect(isImportCopying({ busy: true, stage: 'copying', copied: 50, total: 100 })).toBe(true)
    expect(isImportCopying({ busy: true, stage: 'activating', copied: 100, total: 100 })).toBe(true)
    expect(isImportCopying({ busy: true, stage: 'recovering', copied: 0, total: 0 })).toBe(true)
  })

  it('hides stale singleton state.error on a fresh dialog open and prioritizes active form errors', () => {
    const staleState = {
      busy: false,
      stage: 'failed',
      copied: 0,
      total: 0,
      error: 'Previous import failed'
    }
    expect(
      resolveImportError({
        failure: null,
        previewError: '',
        state: staleState,
        sawActiveImport: false
      })
    ).toEqual({ error: '', errorKind: 'import' })

    expect(
      resolveImportError({
        failure: null,
        previewError: '',
        state: staleState,
        sawActiveImport: true
      })
    ).toEqual({ error: 'Previous import failed', errorKind: 'import' })

    expect(
      resolveImportError({
        failure: null,
        previewError: 'No builds folder found',
        state: staleState,
        sawActiveImport: false
      })
    ).toEqual({ error: 'No builds folder found', errorKind: 'preview' })

    expect(
      resolveImportError({
        failure: { text: 'Git unavailable', kind: 'action' },
        previewError: 'No builds folder found',
        state: staleState,
        sawActiveImport: true
      })
    ).toEqual({ error: 'Git unavailable', errorKind: 'action' })
  })

  it('serializes cancel and replacement preview so the next call waits for the cancelled scan to unwind', async () => {
    const events: string[] = []
    let finishFirst!: () => void
    let secondStarted = false
    const onCancel = vi.fn(() => events.push('cancel'))
    const queue = createPreviewQueue<string>(onCancel)

    queue.enqueue(
      () =>
        new Promise<string>((_resolve, reject) => {
          events.push('start-1')
          finishFirst = () => reject(new Error('aborted'))
        }),
      {
        onStart: () => events.push('checking-on-1'),
        onSuccess: (v) => events.push(`ok-1:${v}`),
        onError: () => events.push('err-1'),
        onSettled: () => events.push('settled-1')
      }
    )

    // Cancel scan #1 and immediately enqueue scan #2 (e.g., toggling the assets checkbox)
    queue.cancel()
    queue.enqueue(
      async () => {
        secondStarted = true
        events.push('start-2')
        return 'preview-2'
      },
      {
        onStart: () => events.push('checking-on-2'),
        onSuccess: (v) => events.push(`ok-2:${v}`),
        onError: () => events.push('err-2'),
        onSettled: () => events.push('settled-2')
      }
    )

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(secondStarted).toBe(false)

    // First scan finishes unwinding -> second scan now runs and settles cleanly
    finishFirst()
    await vi.waitFor(() => expect(events).toContain('settled-2'))
    expect(events).toEqual([
      'checking-on-1',
      'start-1',
      'cancel',
      'checking-on-2',
      'start-2',
      'ok-2:preview-2',
      'settled-2'
    ])
  })

  it('settles checking state when cancelled with no replacement scan', async () => {
    let finish!: () => void
    const settled = vi.fn()
    const onError = vi.fn()
    const queue = createPreviewQueue<string>(() => {})

    queue.enqueue(
      () =>
        new Promise<string>((_resolve, reject) => {
          finish = () => reject(new Error('aborted'))
        }),
      {
        onStart: () => {},
        onSuccess: () => {},
        onError,
        onSettled: settled
      }
    )

    queue.cancel()
    expect(settled).not.toHaveBeenCalled()
    finish()
    await vi.waitFor(() => expect(settled).toHaveBeenCalledTimes(1))
    expect(onError).not.toHaveBeenCalled()
  })
})
