// Transcript text items: the user's message, the assistant's reply, system notes, and the chips
// attachments and context arrive as.
import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react'
import {
  FileText,
  GitFork,
  LoaderCircle,
  Pencil,
  RotateCcw,
  X,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Prose } from '@/shared/ui/code/Prose'
import { CopyButton } from '@/shared/ui/common/CopyButton'
import { formatFullDateTime, useRelativeTime } from '@/shared/ui/common/time'
import { IconAction, Tip } from '@/shared/ui/common/Tip'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { Button } from '@/shared/ui/primitives/button'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import { Textarea } from '@/shared/ui/primitives/textarea'

export type Attachment = { path: string; url?: string; uploading?: boolean }

export interface MessageBubbleEditState {
  /** File rewind preview for this turn; undefined while loading. */
  preview?: { files: string[]; unavailable: string | null }
  submitting?: boolean
  error?: string
  /** Focus the editor textarea on mount (defaults to true; disable in static kit specimens). */
  autoFocus?: boolean
  onSubmit(text: string, undoFiles: boolean): void
  onCancel(): void
}

const IMAGE = /\.(png|jpe?g|webp|gif)$/i
const base = (p: string): string => p.split(/[\\/]/).pop() ?? p

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }): ReactElement {
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full border border-border-default bg-surface-overlay text-fg-secondary shadow-sm transition-colors duration-(--dur-fast) hover:text-fg focus-visible:outline-2 focus-visible:outline-focus pointer-coarse:size-6"
      >
        <X aria-hidden className="size-2.5" strokeWidth={2.5} />
      </button>
    </Tip>
  )
}

/** A file attached to a message: an image thumbnail or the file name; × removes it before sending. */
export function AttachmentChip({
  file,
  onRemove
}: {
  file: Attachment
  onRemove?: () => void
}): ReactElement {
  const name = base(file.path)
  return (
    <span
      aria-busy={file.uploading || undefined}
      className="relative inline-flex h-12 max-w-40 shrink-0 items-center rounded-md border border-border-default bg-surface-sunken text-sm"
    >
      <Tip label={file.path}>
        <span
          role="group"
          tabIndex={0}
          aria-label={file.path}
          className="flex h-full max-w-full min-w-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-focus"
        >
          {file.url && IMAGE.test(file.path) ? (
            <img src={file.url} alt={name} className="h-full max-w-full rounded-md object-cover" />
          ) : (
            <span className="flex min-w-0 items-center gap-1.5 px-2">
              {file.uploading ? (
                <LoaderCircle
                  aria-hidden
                  className="size-3.5 shrink-0 text-fg-muted motion-safe:animate-spin"
                />
              ) : (
                <FileText aria-hidden className="size-3.5 shrink-0 text-fg-muted" />
              )}
              <span className="truncate">{name}</span>
              {file.uploading && <span className="sr-only">uploading</span>}
            </span>
          )}
        </span>
      </Tip>
      {onRemove && <RemoveButton label={`Remove ${name}`} onClick={onRemove} />}
    </span>
  )
}

/** Context that goes with the next message: selected parts, attached refs. */
export function ContextChip({
  icon: Icon,
  children,
  title,
  onRemove,
  removeLabel = 'Remove'
}: {
  icon: LucideIcon
  children: ReactNode
  /** The full context sent, as the tooltip. */
  title?: string
  onRemove?: () => void
  removeLabel?: string
}): ReactElement {
  return (
    <span className="relative inline-flex h-(--density-control-sm) max-w-full min-w-0 items-center gap-1.5 rounded-md border border-accent-subtle-border bg-accent-subtle px-2 text-sm text-fg">
      <Icon aria-hidden className="size-3.5 shrink-0 text-accent-text" />
      {title ? (
        <Tip label={<span className="whitespace-pre-line">{title}</span>}>
          <span
            role="group"
            tabIndex={0}
            aria-label={title}
            className="truncate rounded-sm focus-visible:outline-2 focus-visible:outline-focus"
          >
            {children}
          </span>
        </Tip>
      ) : (
        <span className="truncate">{children}</span>
      )}
      {onRemove && <RemoveButton label={removeLabel} onClick={onRemove} />}
    </span>
  )
}

function MessageBubbleEditor({
  initialText,
  attachments,
  editing,
  className
}: {
  initialText: string
  attachments?: Attachment[]
  editing: MessageBubbleEditState
  className?: string
}): ReactElement {
  const [draft, setDraft] = useState(initialText)
  const [undoFiles, setUndoFiles] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const undoId = useId()

  const shouldAutoFocus = editing.autoFocus !== false
  useEffect(() => {
    if (!shouldAutoFocus) return
    const el = textareaRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [shouldAutoFocus])

  const preview = editing.preview
  const canUndoFiles = Boolean(preview && !preview.unavailable && preview.files.length > 0)
  const effectiveUndo = canUndoFiles && undoFiles
  const canSubmit = draft.trim().length > 0 && preview !== undefined && !editing.submitting

  const submit = (): void => {
    if (!canSubmit) return
    editing.onSubmit(draft.trim(), effectiveUndo)
  }

  return (
    <div
      className={cn(
        'ml-auto flex w-full max-w-[92%] flex-col gap-2 rounded-lg border border-border-default bg-surface-raised p-2.5',
        className
      )}
    >
      <Textarea
        ref={textareaRef}
        aria-label="Edit message"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={editing.submitting}
        rows={3}
        className="max-h-60 min-h-20 resize-y"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            if (!editing.submitting) editing.onCancel()
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            submit()
          }
        }}
      />
      {attachments?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <AttachmentChip key={a.path} file={a} />
          ))}
        </div>
      ) : null}
      <div aria-live="polite" className="space-y-1 text-xs text-fg-secondary">
        {!preview ? (
          <p className="text-fg-muted">Checking build file changes…</p>
        ) : preview.unavailable ? (
          <p className="text-fg-muted">
            Build file undo unavailable; only the conversation will rewind.
          </p>
        ) : preview.files.length > 0 ? (
          <div className="space-y-1.5 rounded-md border border-border-subtle bg-surface-sunken p-2">
            <label
              htmlFor={undoId}
              className="flex cursor-pointer items-center gap-2 text-sm text-fg"
            >
              <Checkbox
                id={undoId}
                checked={undoFiles}
                disabled={editing.submitting}
                onCheckedChange={(checked) => setUndoFiles(checked === true)}
              />
              <span>
                Undo changes to {preview.files.length}{' '}
                {preview.files.length === 1 ? 'build file' : 'build files'}
              </span>
            </label>
            <ul className="max-h-24 overflow-auto pl-6 font-mono text-xs text-fg-secondary break-all">
              {preview.files.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {editing.error && <InlineNotice tone="danger">{editing.error}</InlineNotice>}
      <div className="flex items-center justify-end gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={editing.submitting}
          onClick={editing.onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          variant={effectiveUndo ? 'destructive' : 'default'}
          disabled={!canSubmit}
          onClick={submit}
        >
          {editing.submitting
            ? effectiveUndo
              ? 'Undoing and resending…'
              : 'Resending…'
            : effectiveUndo
              ? 'Resend & undo files'
              : 'Resend'}
        </Button>
      </div>
    </div>
  )
}

function MessageTimestamp({ timestamp }: { timestamp?: number }): ReactElement | null {
  const relative = useRelativeTime(timestamp)
  if (timestamp === undefined || !relative) return null
  return (
    <Tip label={formatFullDateTime(timestamp)}>
      <time
        dateTime={new Date(timestamp).toISOString()}
        tabIndex={0}
        className="focus-ring cursor-default rounded-sm px-1 font-mono text-2xs text-fg-muted tabular-nums select-none"
      >
        {relative}
      </time>
    </Tip>
  )
}

/** The user's message: right-aligned, plain text as typed, with attachments and hover/focus quick actions. */
export function MessageBubble({
  children,
  attachments,
  timestamp,
  copyable = true,
  onEdit,
  onFork,
  onRewind,
  actionsDisabled = false,
  editing,
  className
}: {
  children: string
  attachments?: Attachment[]
  timestamp?: number
  copyable?: boolean
  onEdit?: () => void
  onFork?: () => void
  onRewind?: () => void
  actionsDisabled?: boolean
  editing?: MessageBubbleEditState
  className?: string
}): ReactElement {
  if (editing)
    return (
      <MessageBubbleEditor
        initialText={children}
        attachments={attachments}
        editing={editing}
        className={className}
      />
    )
  const hasActions = copyable || !!onEdit || !!onFork || !!onRewind
  return (
    <div
      className={cn(
        'group/message ml-auto flex w-fit max-w-[85%] flex-col items-end gap-0.5',
        className
      )}
    >
      <div className="flex w-fit max-w-full flex-col gap-1.5 rounded-lg rounded-br-sm bg-surface-active px-3 py-2">
        <span className="sr-only">You said:</span>
        <div className="min-w-0 max-w-full break-words whitespace-pre-wrap select-text">
          {children}
        </div>
        {attachments?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <AttachmentChip key={a.path} file={a} />
            ))}
          </div>
        ) : null}
      </div>
      {(hasActions || timestamp !== undefined) && (
        <div className="flex items-center gap-1">
          {hasActions && (
            <div
              role="toolbar"
              aria-label="Message actions"
              className="flex items-center gap-0.5 opacity-0 transition-opacity duration-(--dur-fast) group-focus-within/message:opacity-100 group-hover/message:opacity-100 pointer-coarse:opacity-100"
            >
              {onEdit && (
                <IconAction
                  size="xs"
                  icon={Pencil}
                  label="Edit message"
                  tip="Edit and resend from here"
                  disabled={actionsDisabled}
                  onClick={onEdit}
                />
              )}
              {onFork && (
                <IconAction
                  size="xs"
                  icon={GitFork}
                  label="Fork from here"
                  tip="Fork conversation after this turn"
                  disabled={actionsDisabled}
                  onClick={onFork}
                />
              )}
              {onRewind && (
                <IconAction
                  size="xs"
                  icon={RotateCcw}
                  label="Rewind to here"
                  tip="Rewind conversation to before this message"
                  disabled={actionsDisabled}
                  onClick={onRewind}
                />
              )}
              {copyable && <CopyButton size="xs" text={children} label="Copy message" />}
            </div>
          )}
          <MessageTimestamp timestamp={timestamp} />
        </div>
      )}
    </div>
  )
}

/** The assistant's reply as chat prose; while streaming it is marked busy so readers wait for the end. */
export function AssistantMessage({
  children,
  streaming = false,
  timestamp,
  copyable = true,
  className
}: {
  children: string
  streaming?: boolean
  timestamp?: number
  copyable?: boolean
  className?: string
}): ReactElement {
  const showFooter = !streaming && (copyable || timestamp !== undefined)
  return (
    <div
      aria-busy={streaming || undefined}
      className={cn('group/assistant flex min-w-0 flex-col', className)}
    >
      <Prose variant="chat">{children}</Prose>
      {showFooter && (
        <div className="mt-1 flex items-center gap-1">
          {copyable && (
            <CopyButton
              size="xs"
              text={children}
              label="Copy reply"
              className="opacity-65 transition-opacity duration-(--dur-fast) group-focus-within/assistant:opacity-100 group-hover/assistant:opacity-100 pointer-coarse:opacity-100"
            />
          )}
          <MessageTimestamp timestamp={timestamp} />
        </div>
      )}
    </div>
  )
}

/** A line from the app, not a person: session started, compacted, an error. Centred, mono, quiet. */
export function SystemNote({
  children,
  tone = 'neutral',
  className
}: {
  children: ReactNode
  tone?: 'neutral' | 'error'
  className?: string
}): ReactElement {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'flex items-center gap-3 text-center font-mono text-sm text-fg-muted before:h-px before:flex-1 before:bg-border-subtle after:h-px after:flex-1 after:bg-border-subtle',
        tone === 'error' && 'text-danger-text',
        className
      )}
    >
      <span className="min-w-0 max-w-[80%] wrap-anywhere text-balance">{children}</span>
    </p>
  )
}
