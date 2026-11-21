import type { ReactElement, ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import type { Settings } from '@shared/api'

/** What every step gets from Setup: the saved settings merged with the unsaved draft. */
export interface StepProps {
  form: Settings
  patch: (p: Partial<Settings>) => void
  act: (fn: () => Promise<void>) => void
  save: () => Promise<void>
}

/** The step's eyebrow, heading and lead; the heading takes focus on every step change. */
export function StepHeader({
  eyebrow,
  title,
  children
}: {
  eyebrow?: string
  title: string
  children?: ReactNode
}): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      {eyebrow && (
        <p
          className={cn(
            'text-sm font-medium',
            eyebrow.endsWith('Required') ? 'text-accent-text' : 'text-fg-muted'
          )}
        >
          {eyebrow}
        </p>
      )}
      <h1 id="setup-heading" tabIndex={-1} className="text-2xl font-semibold outline-none">
        {title}
      </h1>
      {children && <p className="text-pretty text-fg-secondary">{children}</p>}
    </div>
  )
}
