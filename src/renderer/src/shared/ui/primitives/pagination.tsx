import * as React from 'react'
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/primitives/button'
import { pageWindow } from '@/shared/ui/primitives/math'

/** Page buttons with previous and next. Pages are 1-based. */
function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
  ...props
}: Omit<React.ComponentProps<'nav'>, 'onChange'> & {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}): React.ReactElement {
  return (
    <nav
      aria-label="Pagination"
      data-slot="pagination"
      className={cn('flex items-center gap-1', className)}
      {...props}
    >
      <Button
        variant="ghost"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon aria-hidden className="rtl:rotate-180" />
        Previous
      </Button>
      <ul className="flex items-center gap-0.5">
        {pageWindow(page, pageCount).map((p, i) =>
          p == null ? (
            <li key={`gap-${i}`} aria-hidden className="flex size-(--density-control-sm) items-center justify-center text-fg-muted">
              <MoreHorizontalIcon className="size-4" />
            </li>
          ) : (
            <li key={p}>
              <Button
                variant={p === page ? 'outline' : 'ghost'}
                size="icon-sm"
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onPageChange(p)}
                className="w-auto min-w-(--density-control-sm) px-1 font-mono tabular-nums"
              >
                {p}
              </Button>
            </li>
          )
        )}
      </ul>
      <Button
        variant="ghost"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <ChevronRightIcon aria-hidden className="rtl:rotate-180" />
      </Button>
    </nav>
  )
}

export { Pagination }
