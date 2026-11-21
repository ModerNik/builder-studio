import { useState, type ReactElement } from 'react'
import { WrapText } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { CopyButton } from '@/shared/ui/common/CopyButton'
import { Tip } from '@/shared/ui/common/Tip'

/**
 * Read-only code or file text: a title bar with the file or language, a wrap toggle and copy,
 * optional line numbers (never copied or selected), and a scroll area capped by `maxHeight`.
 */
export function CodeBlock({
  code,
  title,
  lineNumbers = true,
  wrap: wrapDefault = false,
  startLine = 1,
  highlight,
  maxHeight = 'max-h-80',
  className
}: {
  code: string
  /** File path or language shown in the title bar: "builds/stone_watchtower/build.py". */
  title?: string
  lineNumbers?: boolean
  wrap?: boolean
  startLine?: number
  /** Line numbers to mark, e.g. the line a part was opened on. */
  highlight?: number[]
  maxHeight?: string
  className?: string
}): ReactElement {
  const [wrap, setWrap] = useState(wrapDefault)
  const lines = code.replace(/\n$/, '').split('\n')
  const marked = new Set(highlight)
  const digits = String(startLine + lines.length - 1).length
  return (
    <figure
      className={cn(
        'min-w-0 overflow-hidden rounded-lg border border-border-default bg-surface-sunken',
        className
      )}
    >
      <figcaption className="flex h-(--density-control) items-center gap-1 border-b border-border-subtle bg-surface-panel pr-1 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg-secondary" title={title}>
          {title ?? 'Code'}
        </span>
        <Tip label={wrap ? 'Stop wrapping lines' : 'Wrap long lines'}>
          <button
            type="button"
            aria-label="Wrap lines"
            aria-pressed={wrap}
            onClick={() => setWrap((w) => !w)}
            className={cn(
              'grid size-6 shrink-0 place-items-center rounded-md text-fg-secondary transition-colors duration-(--dur-fast) hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-focus pointer-coarse:size-(--density-control-sm)',
              wrap && 'bg-surface-active text-fg'
            )}
          >
            <WrapText aria-hidden className="size-3.5" />
          </button>
        </Tip>
        <CopyButton text={code} label="Copy code" size="xs" />
      </figcaption>
      <pre
        tabIndex={0}
        aria-label={title ? `Code: ${title}` : 'Code'}
        className={cn(
          'overflow-auto py-2 font-mono text-sm leading-5 text-fg select-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
          maxHeight
        )}
      >
        <code className={cn('grid min-w-max', wrap && 'min-w-0')}>
          {lines.map((line, i) => {
            const n = startLine + i
            return (
              <span key={i} className={cn('flex px-3', marked.has(n) && 'bg-accent-subtle')}>
                {lineNumbers && (
                  <span
                    aria-hidden
                    className="mr-4 shrink-0 text-right text-fg-muted tabular-nums select-none"
                    style={{ width: `${digits}ch` }}
                  >
                    {n}
                  </span>
                )}
                <span
                  className={cn(
                    'min-w-0',
                    wrap ? 'break-all whitespace-pre-wrap' : 'whitespace-pre'
                  )}
                >
                  {line || ' '}
                </span>
              </span>
            )
          })}
        </code>
      </pre>
    </figure>
  )
}
