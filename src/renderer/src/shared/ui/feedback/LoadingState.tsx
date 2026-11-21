import { useEffect, useState, type ReactElement } from 'react'
import { cn } from '@/shared/lib/utils'

const bone = 'rounded-sm bg-surface-hover motion-safe:animate-pulse'

function Lines({ n, last = '60%' }: { n: number; last?: string }): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className={cn(bone, 'h-2.5')}
          style={{ width: i === n - 1 ? last : '100%' }}
        />
      ))}
    </div>
  )
}

const LAYOUTS = {
  /** Rows of a list: parts, sessions, settings. */
  list: (rows: number) => (
    <div className="flex flex-col divide-y divide-border-subtle">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-(--density-row) items-center gap-2 px-2">
          <span className={cn(bone, 'size-3.5 rounded-full')} />
          <span className={cn(bone, 'h-2.5')} style={{ width: `${40 + ((i * 17) % 35)}%` }} />
          <span className="flex-1" />
          <span className={cn(bone, 'h-2.5 w-10')} />
        </div>
      ))}
    </div>
  ),
  /** Gallery tiles: a preview area and two lines. */
  cards: (rows: number) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-border-subtle p-2">
          <span className={cn(bone, 'aspect-video w-full rounded-md')} />
          <Lines n={2} />
        </div>
      ))}
    </div>
  ),
  /** A heading, a block of text and a key/value table. */
  detail: (rows: number) => (
    <div className="flex flex-col gap-4">
      <span className={cn(bone, 'h-4 w-1/3')} />
      <Lines n={3} last="45%" />
      <div className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <span key={i} className="contents">
            <span className={cn(bone, 'h-2.5 w-20')} />
            <span className={cn(bone, 'h-2.5')} style={{ width: `${30 + ((i * 23) % 50)}%` }} />
          </span>
        ))}
      </div>
    </div>
  ),
  /** The assistant transcript: a user bubble, a reply and tool rows. */
  transcript: (rows: number) => (
    <div className="flex flex-col gap-3">
      <span className={cn(bone, 'ml-auto h-8 w-1/2 rounded-lg')} />
      <Lines n={3} />
      {Array.from({ length: Math.max(1, rows - 3) }, (_, i) => (
        <span key={i} className={cn(bone, 'h-2.5')} style={{ width: `${35 + ((i * 13) % 25)}%` }} />
      ))}
    </div>
  )
}

/**
 * A skeleton of the content that is coming, named for screen readers; after `longAfter` ms it adds
 * a line saying it is still working and why it can take a while.
 */
export function LoadingState({
  label,
  layout = 'list',
  rows = 4,
  longAfter = 6000,
  longMessage,
  className
}: {
  /** What is loading, as a sentence: "Loading builds". */
  label: string
  layout?: keyof typeof LAYOUTS
  rows?: number
  longAfter?: number
  /** Shown after a long wait: what is slow and what the user can do. */
  longMessage?: string
  className?: string
}): ReactElement {
  const [long, setLong] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setLong(true), longAfter)
    return () => clearTimeout(timer)
  }, [longAfter])
  return (
    <div role="status" aria-busy="true" className={cn('flex flex-col gap-3', className)}>
      <span className="sr-only">{label}…</span>
      <div aria-hidden>{LAYOUTS[layout](rows)}</div>
      {long && (
        <p className="text-sm text-fg-secondary">
          {longMessage ?? `Still working: ${label.charAt(0).toLowerCase()}${label.slice(1)}.`}
        </p>
      )}
    </div>
  )
}
