// Collection layouts, all sized by their own width: CardGrid (Gallery), Masonry (References) and
// LaneColumns (Variants), which shares the width when lanes fit and scrolls with snap when they do not.
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '@/shared/lib/utils'

/** Auto-fill cards at least `min` wide (a CSS length). */
export function CardGrid({
  min = '16rem',
  className,
  style,
  ...props
}: ComponentProps<'div'> & { min?: string }): ReactElement {
  return (
    <div
      className={cn('grid gap-4', className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))`, ...style }}
      {...props}
    />
  )
}

/** Columns about `column` wide, items of any height; children should be `break-inside-avoid` blocks. */
export function Masonry({
  column = '15rem',
  className,
  style,
  ...props
}: ComponentProps<'div'> & { column?: string }): ReactElement {
  return (
    <div
      className={cn('gap-4 *:mb-4 *:break-inside-avoid', className)}
      style={{ columnWidth: column, ...style }}
      {...props}
    />
  )
}

/** Side-by-side lanes at least `min` wide; on a narrow box each lane is most of the width and snaps. */
export function LaneColumns({
  min = '18rem',
  className,
  style,
  ...props
}: ComponentProps<'div'> & { min?: string }): ReactElement {
  return (
    <div className="@container min-w-0">
      <div
        className={cn(
          'grid snap-x snap-mandatory auto-cols-[minmax(var(--lane),1fr)] grid-flow-col gap-3 overflow-x-auto pb-2 *:snap-start',
          className
        )}
        style={{ '--lane': `min(${min}, 85cqw)`, ...style } as React.CSSProperties}
        {...props}
      />
    </div>
  )
}
