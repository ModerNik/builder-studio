import { useState, type ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/shared/ui/primitives/dialog'
import { Field } from '@/shared/ui/primitives/field'
import { Input } from '@/shared/ui/primitives/input'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { Guidance, LONG, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Overlays', title: 'Dialog' }

function Demo({
  size,
  label,
  long = false,
  phone
}: {
  size: 'sm' | 'default' | 'lg' | 'full'
  label: string
  long?: boolean
  phone?: 'centred' | 'sheet'
}): ReactElement {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">{label}</Button>
      </DialogTrigger>
      <DialogContent size={size} phone={phone}>
        <DialogHeader>
          <DialogTitle>New build</DialogTitle>
          <DialogDescription>
            Creates builds/&lt;name&gt;/ in your workspace with a starter build.py.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <Field label="Name" hint="Lower-case letters, digits, - and _" required>
            <Input autoFocus defaultValue="watchtower" />
          </Field>
          <Field label="Brief">
            <Textarea placeholder="What should the assistant build?" />
          </Field>
          {long &&
            Array.from({ length: 12 }, (_, i) => (
              <p key={i} className="text-fg-secondary">
                {LONG}
              </p>
            ))}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Create build</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Untriggered(): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open from state
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Import builds</DialogTitle>
            <DialogDescription>Opened by state, as the Gallery and Ctrl+K do.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function DialogSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="sm (384px)">
          <Demo size="sm" label="Small" />
        </Specimen>
        <Specimen label="default (max-w-dialog, 480px)">
          <Demo size="default" label="Default" />
        </Specimen>
        <Specimen label="lg (max-w-dialog-lg, 720px)">
          <Demo size="lg" label="Large" />
        </Specimen>
        <Specimen label="long content scrolls inside">
          <Demo size="default" label="Long content" long />
        </Specimen>
        <Specimen label="lg, a full-height sheet on phone (Import builds); narrow the window below 640px">
          <Demo size="lg" label="Sheet on phone" phone="sheet" />
        </Specimen>
        <Specimen label="full">
          <Demo size="full" label="Full" />
        </Specimen>
        <Specimen label="opened without a trigger (a key, a menu, a store); focus still comes back">
          <Untriggered />
        </Specimen>
      </Specimens>
      <Guidance>
        Focus moves into the dialog (to autoFocus, else the first control), Tab cycles inside it,
        Esc or the close button closes it and focus returns to what had it before, trigger or not.
        It is aria-modal, so app shortcuts other than Ctrl+K wait until it closes. Footer order:
        Cancel, then the primary action last; on phones the primary action stacks on top.
      </Guidance>
    </div>
  )
}
