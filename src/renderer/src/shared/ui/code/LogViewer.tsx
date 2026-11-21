import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactElement
} from 'react'
import { ArrowDown, ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { cn } from '@/shared/lib/utils'
import { CopyButton } from '@/shared/ui/common/CopyButton'
import { IconAction } from '@/shared/ui/common/Tip'
import { findLines, follow, isNearBottom, lineTone, splitMatches, unseen } from './log'

// shortcut: renders every kept line; past ~5k lines it keeps the tail. Virtualise if job logs grow larger.
const MAX_LINES = 5000

/**
 * A job's log. While streaming it follows new lines; scrolling up pauses that and shows
 * "n new lines" to jump back. Search highlights matches and steps through them (Enter / Shift Enter).
 */
export function LogViewer({
  lines,
  streaming = false,
  label,
  height = 'h-64',
  className
}: {
  lines: readonly string[]
  streaming?: boolean
  /** The log's accessible name: "Draft generation log". */
  label: string
  /** A height class for the scroll area. */
  height?: string
  className?: string
}): ReactElement {
  const box = useRef<HTMLDivElement>(null)
  const [state, dispatch] = useReducer(follow, { stuck: true, pausedAt: null })
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [hit, setHit] = useState(0)
  const shown = lines.length > MAX_LINES ? lines.slice(-MAX_LINES) : lines
  const offset = lines.length - shown.length
  const hits = useMemo(() => findLines(shown, query), [shown, query])
  const fresh = unseen(state, lines.length)

  // follow the end while stuck; runs before paint so the view never flashes a scrolled-up frame
  useLayoutEffect(() => {
    const el = box.current
    if (el && state.stuck) el.scrollTop = el.scrollHeight
  }, [lines.length, state.stuck])

  useEffect(() => {
    const i = hits[hit]
    if (i === undefined) return
    box.current
      ?.querySelector<HTMLElement>(`[data-line="${i}"]`)
      ?.scrollIntoView({ block: 'center' })
  }, [hit, hits])

  const step = (d: 1 | -1): void => {
    if (hits.length) setHit((h) => (h + d + hits.length) % hits.length)
  }
  const closeSearch = (): void => {
    setSearching(false)
    setQuery('')
  }

  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-border-default bg-surface-sunken',
        className
      )}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          e.preventDefault()
          setSearching(true)
        }
      }}
    >
      <div className="flex h-(--density-control) shrink-0 items-center gap-1 border-b border-border-subtle bg-surface-panel pr-1 pl-3">
        <span className="min-w-0 flex-1 truncate text-sm text-fg-secondary">
          {label}
          <span className="ml-2 font-mono text-xs text-fg-muted tabular-nums">
            {lines.length.toLocaleString('en-US')} lines
          </span>
        </span>
        {searching ? (
          <span className="flex min-w-0 items-center gap-1">
            <Search aria-hidden className="size-3.5 shrink-0 text-fg-muted" />
            <input
              autoFocus
              type="search"
              aria-label="Search the log"
              placeholder="Search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setHit(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  step(e.shiftKey ? -1 : 1)
                } else if (e.key === 'Escape') {
                  e.stopPropagation()
                  closeSearch()
                }
              }}
              className="h-(--density-control-sm) w-32 min-w-0 rounded-md border border-border-strong bg-surface-sunken px-2 font-mono text-sm text-fg outline-hidden placeholder:text-fg-muted focus-visible:border-focus"
            />
            <span
              aria-live="polite"
              className="w-14 shrink-0 text-right text-xs text-fg-muted tabular-nums"
            >
              {query.trim() ? (hits.length ? `${hit + 1} of ${hits.length}` : 'No matches') : ''}
            </span>
            <IconAction
              label="Previous match"
              icon={ChevronUp}
              size="xs"
              disabled={!hits.length}
              onClick={() => step(-1)}
            />
            <IconAction
              label="Next match"
              icon={ChevronDown}
              size="xs"
              disabled={!hits.length}
              onClick={() => step(1)}
            />
            <IconAction label="Close search" icon={X} size="xs" onClick={closeSearch} />
          </span>
        ) : (
          <IconAction
            label="Search the log"
            tip="Search (Ctrl F)"
            icon={Search}
            size="xs"
            onClick={() => setSearching(true)}
          />
        )}
        <CopyButton text={lines.join('\n')} label="Copy log" size="xs" />
      </div>
      <div
        ref={box}
        role="log"
        aria-label={label}
        aria-busy={streaming}
        tabIndex={0}
        onScroll={(e) =>
          dispatch({
            type: 'scroll',
            nearBottom: isNearBottom(e.currentTarget),
            total: lines.length
          })
        }
        className={cn(
          'min-h-0 overflow-auto py-1.5 font-mono text-sm leading-5 select-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
          height
        )}
      >
        {offset > 0 && (
          <div className="px-3 pb-1 text-fg-muted">
            Showing the last {MAX_LINES.toLocaleString('en-US')} of{' '}
            {lines.length.toLocaleString('en-US')} lines. Copy log has all of them.
          </div>
        )}
        {shown.length === 0 && (
          <div className="px-3 text-fg-muted">
            {streaming ? 'Waiting for output…' : 'No output.'}
          </div>
        )}
        {shown.map((line, i) => {
          const tone = lineTone(line)
          const current = hits[hit] === i
          return (
            <div
              key={offset + i}
              data-line={i}
              className={cn(
                'flex gap-3 px-3 whitespace-pre-wrap break-all',
                tone === 'error' && 'bg-danger-subtle text-danger-text',
                tone === 'warning' && 'text-warning-text',
                !tone && 'text-fg-secondary',
                current && 'bg-selection'
              )}
            >
              <span
                aria-hidden
                className="w-10 shrink-0 text-right text-fg-muted tabular-nums select-none"
              >
                {offset + i + 1}
              </span>
              <span className="min-w-0">
                {query.trim()
                  ? splitMatches(line, query).map((p, j) =>
                      p.hit ? (
                        <mark key={j} className="rounded-xs bg-warning-subtle text-fg">
                          {p.text}
                        </mark>
                      ) : (
                        p.text
                      )
                    )
                  : line || ' '}
              </span>
            </div>
          )
        })}
      </div>
      {!state.stuck && (
        <Button
          size="xs"
          variant="secondary"
          className="absolute right-3 bottom-3 h-(--density-control-sm) shadow-md"
          onClick={() => dispatch({ type: 'jump' })}
        >
          <ArrowDown aria-hidden />
          {fresh > 0
            ? `${fresh.toLocaleString('en-US')} new line${fresh === 1 ? '' : 's'}`
            : 'Jump to bottom'}
        </Button>
      )}
    </div>
  )
}
