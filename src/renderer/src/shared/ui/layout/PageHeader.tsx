// A screen's header: back link, title, meta, an optional field and actions. It wraps rather than squeezes,
// so a field (Review's round question) keeps a usable width and drops to its own row when room runs out.
import type { ReactElement, ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { IconButton } from '@/shared/ui/common/parts'

export function PageHeader({
  title,
  description,
  meta,
  back,
  field,
  actions,
  level = 1,
  className
}: {
  title: ReactNode
  description?: ReactNode
  /** Small facts beside the title: the build name, a "waiting" chip. */
  meta?: ReactNode
  back?: { label: string; onClick: () => void }
  /** A field that belongs in the header, e.g. the round's question. At least 20rem wide, or on its own row. */
  field?: ReactNode
  actions?: ReactNode
  level?: 1 | 2
  className?: string
}): ReactElement {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <header className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {back && <IconButton icon={ArrowLeft} label={back.label} onClick={back.onClick} />}
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <Heading className={cn('truncate font-semibold', level === 1 ? 'text-lg' : 'text-md')}>
              {title}
            </Heading>
            {meta && (
              <div className="flex items-center gap-2 text-sm text-fg-secondary">{meta}</div>
            )}
          </div>
          {description && <p className="max-w-prose text-sm text-fg-secondary">{description}</p>}
        </div>
      </div>
      {field && <div className="min-w-0 flex-[1_1_20rem]">{field}</div>}
      {actions && (
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>
      )}
    </header>
  )
}
