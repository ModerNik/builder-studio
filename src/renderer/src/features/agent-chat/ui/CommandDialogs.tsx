import { useEffect, useRef, type ReactElement } from 'react'
import type { AgentRewindPoint, AgentRewindPreview, AgentState } from '@shared/api'
import { Button } from '@/shared/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/primitives/dialog'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/primitives/radio-group'
import { InlineNotice } from '@/shared/ui/feedback/Alert'

export function RewindDialog({
  points,
  point,
  onPoint,
  preview,
  loading,
  error,
  running,
  onClose,
  onRewind
}: {
  points: AgentRewindPoint[]
  point: string
  onPoint(id: string): void
  preview?: AgentRewindPreview
  loading: boolean
  error?: string
  running: boolean
  onClose(): void
  onRewind(files: string[] | null): void
}): ReactElement {
  const selectedRef = useRef<HTMLLabelElement>(null)
  const scrolled = useRef(false)
  useEffect(() => {
    if (!scrolled.current && point && points.length > 0 && selectedRef.current) {
      scrolled.current = true
      selectedRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [point, points.length])
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !running) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rewind conversation</DialogTitle>
          <DialogDescription>
            Choose a turn to continue from just before it in a new thread. The original conversation
            stays in your history.
          </DialogDescription>
        </DialogHeader>
        {loading && (
          <p role="status" className="text-sm text-fg-secondary">
            Loading turns…
          </p>
        )}
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
        {!loading && !error && points.length === 0 && (
          <p className="text-sm text-fg-secondary">There are no turns to rewind.</p>
        )}
        <RadioGroup
          aria-label="Rewind to before this turn"
          value={point}
          onValueChange={onPoint}
          disabled={running}
          className="max-h-52 gap-1 overflow-auto"
        >
          {points.map((p) => (
            <label
              key={p.id}
              ref={p.id === point ? selectedRef : undefined}
              className="flex min-h-(--density-row) cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-hover"
            >
              <RadioGroupItem value={p.id} />
              <span className="line-clamp-2 min-w-0 text-sm break-words">
                {p.text || 'Message with attachments'}
              </span>
            </label>
          ))}
        </RadioGroup>
        {point && (
          <div aria-live="polite" className="space-y-1 text-sm text-fg-secondary">
            {!preview ? (
              <p>Checking file checkpoints…</p>
            ) : preview.unavailable ? (
              <p>File rewind unavailable. {preview.unavailable}</p>
            ) : preview.files.length > 0 ? (
              <>
                <p>Build files to restore. This includes changes made while these turns ran.</p>
                <ul className="max-h-28 overflow-auto font-mono text-xs break-all">
                  {preview.files.map((file) => (
                    <li key={file}>{file}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>No build files changed in these turns.</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={!point || running} onClick={() => onRewind(null)}>
            Conversation only
          </Button>
          <Button
            variant="destructive"
            disabled={!point || !preview || !!preview.unavailable || running}
            onClick={() => {
              if (preview) onRewind(preview.files)
            }}
          >
            Conversation and files
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ContextDialog({
  context,
  onClose
}: {
  context: AgentState['context']
  onClose(): void
}): ReactElement {
  const format = (tokens: number): string => tokens.toLocaleString()
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Context usage</DialogTitle>
          <DialogDescription>Tokens in the current conversation window.</DialogDescription>
        </DialogHeader>
        {context ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            <dt>Used</dt>
            <dd className="text-right font-mono">
              {format(context.tokens)} / {format(context.max)}
            </dd>
            <dt>Remaining</dt>
            <dd className="text-right font-mono">
              {format(Math.max(0, context.max - context.tokens))}
            </dd>
            {context.categories
              ?.filter((c) => c.tokens > 0)
              .map((c) => (
                <div className="contents text-fg-secondary" key={c.name}>
                  <dt>{c.name}</dt>
                  <dd className="text-right font-mono">{format(c.tokens)}</dd>
                </div>
              ))}
          </dl>
        ) : (
          <p className="text-sm text-fg-secondary">
            Context usage is unavailable. Send a message to update it.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
