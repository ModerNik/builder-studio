// Composed cards for link and note references on the References board.
import { useState, type ReactElement } from 'react'
import { Check, Globe, MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import type { Ref, RefUpdate } from '@shared/api'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Field } from '@/shared/ui/primitives/field'
import { Input } from '@/shared/ui/primitives/input'
import { Link } from '@/shared/ui/primitives/link'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { CopyButton } from '@/shared/ui/common/CopyButton'
import { IconAction } from '@/shared/ui/common/Tip'
import { asLink, formatLinkDisplay, formatShortDate } from '@/entities/ref/model/refs'

export function LinkCard({
  refItem,
  attached,
  onToggleAttach,
  onUpdate,
  onDelete
}: {
  refItem: Ref
  attached: boolean
  onToggleAttach: () => void
  onUpdate: (patch: RefUpdate) => Promise<boolean>
  onDelete: () => void
}): ReactElement {
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState(refItem.url ?? '')
  const [note, setNote] = useState(refItem.note)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const openEdit = (): void => {
    setUrl(refItem.url ?? '')
    setNote(refItem.note)
    setError(null)
    setEditing(true)
  }

  const save = async (): Promise<void> => {
    const raw = url.trim()
    const normalized = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw
    const valid = asLink(normalized)
    if (!valid) {
      setError('Enter a valid http:// or https:// web address.')
      return
    }
    setSaving(true)
    try {
      const ok = await onUpdate({ url: valid, note: note.trim() })
      if (ok) setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <article className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-raised p-3">
        <Field label="Link URL" error={error ?? undefined}>
          <Input
            autoFocus
            value={url}
            aria-invalid={!!error}
            onChange={(e) => {
              setUrl(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false)
            }}
          />
        </Field>
        <Field label="Note">
          <Input
            placeholder="Optional note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false)
              else if (e.key === 'Enter') void save()
            }}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || !url.trim()}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </article>
    )
  }

  const { host, path } = formatLinkDisplay(refItem.url ?? '')
  return (
    <article
      className={cn(
        'group/ref flex items-start gap-3 rounded-lg border bg-surface-raised px-3.5 py-3 transition-[border-color] duration-fast ease-standard',
        attached
          ? 'border-accent-solid ring-1 ring-accent-solid/30'
          : 'border-border-default can-hover:hover:border-border-strong'
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-fg-muted"
      >
        <Globe className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={refItem.url}
            external
            className="min-w-0 max-w-full truncate text-base font-medium"
          >
            {host}
          </Link>
          {attached && (
            <Badge variant="accent">
              <Check aria-hidden />
              In chat
            </Badge>
          )}
        </div>
        {path && <p className="truncate font-mono text-xs text-fg-muted">{path}</p>}
        {refItem.note.trim() && <p className="text-sm text-fg-secondary">{refItem.note.trim()}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-fast group-focus-within/ref:opacity-100 group-hover/ref:opacity-100 pointer-coarse:opacity-100">
        <IconAction
          icon={attached ? Check : MessageSquarePlus}
          label={attached ? `Remove ${host} from chat` : `Attach ${host} to chat`}
          tip={attached ? 'Remove from chat' : 'Attach to chat'}
          size="xs"
          className={attached ? 'text-accent-text' : undefined}
          onClick={onToggleAttach}
        />
        {refItem.url && <CopyButton text={refItem.url} label={`Copy ${host}`} size="xs" />}
        <IconAction icon={Pencil} label={`Edit ${host}`} tip="Edit" size="xs" onClick={openEdit} />
        <IconAction
          icon={Trash2}
          label={`Delete ${host}`}
          tip="Delete"
          size="xs"
          onClick={onDelete}
        />
      </div>
    </article>
  )
}

export function NoteCard({
  refItem,
  attached,
  onToggleAttach,
  onSave,
  onDelete
}: {
  refItem: Ref
  attached: boolean
  onToggleAttach: () => void
  onSave: (note: string) => Promise<boolean>
  onDelete: () => void
}): ReactElement {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(refItem.note)
  const [saving, setSaving] = useState(false)

  const openEdit = (): void => {
    setDraft(refItem.note)
    setEditing(true)
  }

  const save = async (): Promise<void> => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setDraft(refItem.note)
      setEditing(false)
      return
    }
    if (trimmed === refItem.note.trim()) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const ok = await onSave(trimmed)
      if (ok) setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <article className="flex flex-col gap-2.5 rounded-lg border border-border-strong bg-surface-raised p-3">
        <Textarea
          autoFocus
          aria-label="Edit note"
          rows={Math.max(3, Math.min(10, draft.split('\n').length + 1))}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(refItem.note)
              setEditing(false)
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              void save()
            }
          }}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(refItem.note)
              setEditing(false)
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || !draft.trim()}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </article>
    )
  }

  const dateLabel = formatShortDate(refItem.added)
  return (
    <article
      className={cn(
        'group/ref flex flex-col justify-between gap-3 rounded-lg border bg-surface-raised p-3.5 transition-[border-color] duration-fast ease-standard',
        attached
          ? 'border-accent-solid ring-1 ring-accent-solid/30'
          : 'border-border-default can-hover:hover:border-border-strong'
      )}
    >
      <button
        type="button"
        onClick={openEdit}
        aria-label="Edit note"
        className="focus-ring cursor-text rounded-xs text-start text-sm leading-5 whitespace-pre-wrap break-words text-fg"
      >
        {refItem.note}
      </button>
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-muted">{dateLabel}</span>
          {attached && (
            <Badge variant="accent">
              <Check aria-hidden />
              In chat
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-fast group-focus-within/ref:opacity-100 group-hover/ref:opacity-100 pointer-coarse:opacity-100">
          <IconAction
            icon={attached ? Check : MessageSquarePlus}
            label={attached ? 'Remove note from chat' : 'Attach note to chat'}
            tip={attached ? 'Remove from chat' : 'Attach to chat'}
            size="xs"
            className={attached ? 'text-accent-text' : undefined}
            onClick={onToggleAttach}
          />
          <CopyButton text={refItem.note} label="Copy note" size="xs" />
          <IconAction icon={Pencil} label="Edit note" tip="Edit" size="xs" onClick={openEdit} />
          <IconAction icon={Trash2} label="Delete note" tip="Delete" size="xs" onClick={onDelete} />
        </div>
      </div>
    </article>
  )
}
