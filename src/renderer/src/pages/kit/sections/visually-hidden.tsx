import type { ReactElement } from 'react'
import { Trash2Icon } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { VisuallyHidden } from '@/shared/ui/primitives/visually-hidden'
import { Guidance } from '../specimen'

export const meta = { group: 'Display', title: 'Visually hidden' }

export default function VisuallyHiddenSection(): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <Button variant="outline" className="self-start">
        <Trash2Icon />
        Delete
        <VisuallyHidden> version 13 of watchtower</VisuallyHidden>
      </Button>
      <Guidance>
        Adds words for screen readers only: here the button reads “Delete version 13 of watchtower”. Use it for
        dialog titles the design does not show and for context a sighted user gets from layout.
      </Guidance>
    </div>
  )
}
