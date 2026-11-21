import type { ReactElement } from 'react'
import { Spinner } from '@/shared/ui/primitives/spinner'
import { Specimen, Specimens } from '../specimen'

export const meta = { group: 'Display', title: 'Spinner' }

export default function SpinnerSection(): ReactElement {
  return (
    <Specimens>
      <Specimen label="default 16px">
        <Spinner />
      </Specimen>
      <Specimen label="muted, 12px">
        <Spinner className="size-3 text-fg-muted" />
      </Specimen>
      <Specimen label="accent, 24px">
        <Spinner className="size-6 text-accent-text" />
      </Specimen>
      <Specimen label="with text">
        <span className="flex items-center gap-2 text-sm text-fg-secondary">
          <Spinner label="Installing" />
          Installing the engine…
        </span>
      </Specimen>
    </Specimens>
  )
}
