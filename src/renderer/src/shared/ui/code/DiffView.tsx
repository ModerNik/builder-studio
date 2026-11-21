import { useEffect, useRef, type ReactElement } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { unifiedMergeView } from '@codemirror/merge'
import { cn } from '@/shared/lib/utils'
import { useResolvedTheme } from '@/shared/lib/theme'

// the merge view's classes painted with the diff tokens; the editor itself sits on the sunken surface
const skin = (dark: boolean): ReturnType<typeof EditorView.theme> =>
  EditorView.theme(
    {
      '&': {
        fontSize: 'var(--text-sm)',
        color: 'var(--fg)',
        backgroundColor: 'var(--surface-sunken)'
      },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.25rem' },
      '.cm-content': { padding: 'var(--space-1) 0', caretColor: 'transparent' },
      '.cm-gutters': {
        backgroundColor: 'var(--surface-sunken)',
        color: 'var(--fg-muted)',
        border: 'none'
      },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 var(--space-2) 0 var(--space-3)' },
      '.cm-changedLine, .cm-insertedLine': { backgroundColor: 'var(--diff-added-bg)' },
      '.cm-changedText, .cm-insertedLine .cm-changedText': {
        background: 'color-mix(in oklab, var(--diff-added-mark) 30%, transparent)',
        textDecoration: 'none'
      },
      '.cm-deletedChunk': {
        backgroundColor: 'var(--diff-removed-bg)',
        color: 'var(--fg-secondary)'
      },
      '.cm-deletedChunk .cm-deletedText, .cm-deletedText': {
        background: 'color-mix(in oklab, var(--diff-removed-mark) 30%, transparent)',
        textDecoration: 'none'
      },
      '.cm-changeGutter': { width: '0.1875rem', paddingLeft: '0' },
      '.cm-changedLineGutter, .cm-insertedLineGutter': { background: 'var(--diff-added-mark)' },
      '.cm-deletedLineGutter': { background: 'var(--diff-removed-mark)' },
      '.cm-collapsedLines': {
        color: 'var(--fg-muted)',
        background: 'var(--surface-panel)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-xs)'
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        background: 'var(--selection-bg) !important'
      }
    },
    { dark }
  )

/**
 * Old → new of one file as a read-only CodeMirror unified diff, in the diff tokens.
 * Removed lines are interleaved above the added ones, with a gutter mark so the kind never relies on tint alone.
 */
export function DiffView({
  before,
  after,
  label,
  numbers = false,
  collapse = true,
  maxHeight = 'max-h-80',
  className
}: {
  before: string
  after: string
  /** Accessible name: the file it changes. */
  label: string
  numbers?: boolean
  /** Fold long unchanged stretches. */
  collapse?: boolean
  maxHeight?: string
  className?: string
}): ReactElement {
  const host = useRef<HTMLDivElement>(null)
  const dark = useResolvedTheme() === 'dark'
  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: after,
        extensions: [
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.lineWrapping,
          numbers ? lineNumbers() : [],
          unifiedMergeView({
            original: before,
            mergeControls: false,
            gutter: true,
            highlightChanges: true,
            collapseUnchanged: collapse ? { margin: 3, minSize: 6 } : undefined
          }),
          skin(dark)
        ]
      })
    })
    return () => view.destroy()
  }, [before, after, numbers, collapse, dark])
  return (
    <div
      ref={host}
      role="region"
      aria-label={`Changes to ${label}`}
      tabIndex={0}
      className={cn(
        'min-w-0 overflow-auto rounded-md border border-border-default bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus',
        maxHeight,
        className
      )}
    />
  )
}
