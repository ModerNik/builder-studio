// Compact add popovers for the reference board: Add link (URL + optional note) and Add note (multi-line).
import { useState, type ReactElement } from 'react'
import { Link2, StickyNote } from 'lucide-react'
import type { RefAdd } from '@shared/api'
import { Button } from '@/shared/ui/primitives/button'
import { Field } from '@/shared/ui/primitives/field'
import { Input } from '@/shared/ui/primitives/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { asLink } from '@/entities/ref/model/refs'

export function AddLinkPopover({ onAdd }: { onAdd: (ref: RefAdd) => Promise<void> }): ReactElement {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    const raw = url.trim()
    const normalized = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw
    const valid = asLink(normalized)
    if (!valid) {
      setError('Enter a valid http:// or https:// web address.')
      return
    }
    setBusy(true)
    try {
      await onAdd({ kind: 'link', url: valid, note: note.trim() })
      setUrl('')
      setNote('')
      setError(null)
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Link2 aria-hidden />
          Add link
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-84 p-3">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Field label="Link URL" error={error ?? undefined}>
            <Input
              autoFocus
              placeholder="https://…"
              value={url}
              aria-invalid={!!error}
              onChange={(e) => {
                setUrl(e.target.value)
                if (error) setError(null)
              }}
            />
          </Field>
          <Field label="Note" hint="Optional">
            <Input
              placeholder="What to take from this link…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!url.trim() || busy}>
              {busy ? 'Adding…' : 'Add link'}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

export function AddNotePopover({ onAdd }: { onAdd: (ref: RefAdd) => Promise<void> }): ReactElement {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    const trimmed = note.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await onAdd({ kind: 'note', note: trimmed })
      setNote('')
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <StickyNote aria-hidden />
          Add note
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-84 p-3">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Field label="Reference note">
            <Textarea
              autoFocus
              rows={4}
              placeholder="Palette idea, proportions, architectural detail…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault()
                  void submit()
                }
              }}
            />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!note.trim() || busy}>
              {busy ? 'Adding…' : 'Add note'}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
