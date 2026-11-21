import type { ReactElement } from 'react'
import { Link } from '@/shared/ui/primitives/link'
import { forceFocus, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Actions', title: 'Link' }

export default function LinkSection(): ReactElement {
  return (
    <Specimens>
      <Specimen label="inline">
        <p className="max-w-80">
          Read <Link href="#">Exporting schematics</Link> before your first export.
        </p>
      </Specimen>
      <Specimen label="external">
        <Link href="https://example.com" external>
          Litematica docs
        </Link>
      </Specimen>
      <Specimen label="subtle">
        <Link href="#" variant="subtle">
          Show in folder
        </Link>
      </Specimen>
      <Specimen label="focus">
        <Link href="#" className={forceFocus} tabIndex={-1}>
          Focused link
        </Link>
      </Specimen>
      <Specimen label="disabled (aria-disabled)">
        <Link aria-disabled>Not available offline</Link>
      </Specimen>
    </Specimens>
  )
}
