// A labelled specimen on the kit page; `resizable` lets the reader drag its width to see container breakpoints.
import type { ReactElement, ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

export function Specimen({
  label,
  resizable,
  className,
  children
}: {
  label: string
  resizable?: boolean
  className?: string
  children: ReactNode
}): ReactElement {
  return (
    <figure className="mb-6">
      <figcaption className="mb-2 text-sm text-fg-secondary">
        {label}
        {resizable && <span className="text-fg-muted"> · drag the corner to resize</span>}
      </figcaption>
      <div
        className={cn(
          'rounded-lg border border-border-subtle bg-surface p-3',
          resizable && 'max-w-full min-w-[18.75rem] resize-x overflow-auto',
          className
        )}
      >
        {children}
      </div>
    </figure>
  )
}
