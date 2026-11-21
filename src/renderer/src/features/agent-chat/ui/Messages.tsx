// Transcript text items: the user's message, the assistant's reply, system notes, and the chips
// attachments and context arrive as.
import type { ReactElement, ReactNode } from 'react'
import { FileText, LoaderCircle, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Prose } from '@/shared/ui/code/Prose'
import { Tip } from '@/shared/ui/common/Tip'

export type Attachment = { path: string; url?: string; uploading?: boolean }

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

/** The user's message: right-aligned, plain text as typed, with its attachments under it. */
export function MessageBubble({
  children,
  attachments,
  className
}: {
  children: string
  attachments?: Attachment[]
  className?: string
}): ReactElement {
  return (
    <div
      className={cn(
        'ml-auto flex w-fit max-w-[85%] flex-col gap-1.5 rounded-lg rounded-br-sm bg-surface-active px-3 py-2',
        className
      )}
    >
      <span className="sr-only">You said:</span>
      <div className="break-words whitespace-pre-wrap select-text">{children}</div>
      {attachments?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <AttachmentChip key={a.path} file={a} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** The assistant's reply as chat prose; while streaming it is marked busy so readers wait for the end. */
export function AssistantMessage({
  children,
  streaming = false,
  className
}: {
  children: string
  streaming?: boolean
  className?: string
}): ReactElement {
  return (
    <div aria-busy={streaming || undefined} className={cn('min-w-0', className)}>
      <Prose variant="chat">{children}</Prose>
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
