// Plan proposal card with revision history diff, inline text-selection comments, direct edits, and revision feedback.
import { useId, useRef, useState, type ReactElement, type ReactNode } from 'react'
import {
  Check,
  GitCompareArrows,
  ListTodo,
  MessageSquarePlus,
  Pencil,
  RotateCcw,
  X
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Prose } from '@/shared/ui/code/Prose'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import { Input } from '@/shared/ui/primitives/input'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { formatPlanRevision, type PlanComment } from '../model/plans'

export interface PlanCardProps {
  plan: string
  /** 1-based revision number in the current planning sequence; shows "Rev N" badge when > 1. */
  revision?: number
  /** Previous plan text to compare against when toggling Diff. */
  previousPlan?: string
  /** Renders a unified diff view between previous and current plan text. */
  renderDiff?: (before: string, after: string) => ReactNode
  /** Omit for read-only historical plans. Receives editedPlan only when the user edited the plan text. */
  onApprove?: (editedPlan?: string) => void
  /** Omit for read-only historical plans. Sends comments and/or revision note back to the agent. */
  onRevise?: (feedback: string) => void
  /** Omit for Codex, whose plans are text: only Approve and Revise apply. */
  onKeepPlanning?: () => void
  approveLabel?: string
  className?: string
}

interface SelectionAnchor {
  quote: string
  top: number
  left: number
}

export function PlanCard({
  plan,
  revision,
  previousPlan,
  renderDiff,
  onApprove,
  onRevise,
  onKeepPlanning,
  approveLabel = 'Approve plan',
  className
}: PlanCardProps): ReactElement {
  const id = useId()
  const proseRef = useRef<HTMLDivElement>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedText, setEditedText] = useState<string | null>(null)
  const [selection, setSelection] = useState<SelectionAnchor | null>(null)
  const [pendingQuote, setPendingQuote] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [comments, setComments] = useState<PlanComment[]>([])
  const [note, setNote] = useState('')

  const interactive = !!(onApprove || onRevise)
  const currentPlan = editedText ?? plan
  const isEdited = editedText !== null && editedText !== plan
  const canDiff = !!previousPlan && !!renderDiff
  const canRevise = comments.length > 0 || note.trim().length > 0

  const captureSelection = (): void => {
    if (!interactive || editing || showDiff || !onRevise) return
    const host = proseRef.current
    const sel = window.getSelection()
    if (!host || !sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelection(null)
      return
    }
    const range = sel.getRangeAt(0)
    if (!host.contains(range.commonAncestorContainer)) {
      setSelection(null)
      return
    }
    const quote = sel.toString().trim().replace(/\s+/g, ' ')
    if (!quote) {
      setSelection(null)
      return
    }
    const rect = range.getBoundingClientRect()
    const hostRect = host.getBoundingClientRect()
    const top = Math.max(0, rect.top - hostRect.top - 36)
    const left = Math.min(Math.max(0, rect.left - hostRect.left), Math.max(0, hostRect.width - 110))
    setSelection({ quote: quote.slice(0, 240), top, left })
  }

  const startComment = (): void => {
    if (!selection) return
    setPendingQuote(selection.quote)
    setCommentDraft('')
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  const addComment = (): void => {
    const text = commentDraft.trim()
    if (!pendingQuote || !text) return
    setComments((prev) => [...prev, { id: crypto.randomUUID(), quote: pendingQuote, text }])
    setPendingQuote(null)
    setCommentDraft('')
  }

  const submitRevision = (): void => {
    if (!onRevise || !canRevise) return
    const feedback = formatPlanRevision(comments, note)
    if (!feedback) return
    onRevise(feedback)
    setComments([])
    setNote('')
    setPendingQuote(null)
    setSelection(null)
  }

  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-lg border bg-surface-raised p-3',
        interactive ? 'border-accent-subtle-border' : 'border-border-default',
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <h3
          id={id}
          className={cn(
            'flex items-center gap-1.5 text-base font-medium',
            interactive ? 'text-accent-text' : 'text-fg-secondary'
          )}
        >
          <ListTodo aria-hidden className="size-3.5 shrink-0" />
          Plan
        </h3>
        {revision !== undefined && revision > 1 && (
          <Badge variant={interactive ? 'accent' : 'secondary'}>Rev {revision}</Badge>
        )}
        {isEdited && <Badge variant="secondary">Edited</Badge>}
        {!interactive && <Badge variant="outline">Superseded</Badge>}
        <span className="flex-1" />
        {canDiff && (
          <Button
            size="xs"
            variant={showDiff ? 'secondary' : 'ghost'}
            className="h-(--density-control-sm)"
            onClick={() => {
              setShowDiff((d) => !d)
              setEditing(false)
              setSelection(null)
            }}
          >
            <GitCompareArrows aria-hidden />
            {showDiff ? 'Plan' : 'Diff'}
          </Button>
        )}
        {interactive && (
          <Button
            size="xs"
            variant={editing ? 'secondary' : 'ghost'}
            className="h-(--density-control-sm)"
            onClick={() => {
              setEditing((e) => !e)
              setShowDiff(false)
              setSelection(null)
              setPendingQuote(null)
            }}
          >
            {editing ? <Check aria-hidden /> : <Pencil aria-hidden />}
            {editing ? 'Done' : 'Edit'}
          </Button>
        )}
      </div>

      {showDiff && previousPlan && renderDiff ? (
        <div className="min-w-0">{renderDiff(previousPlan, currentPlan)}</div>
      ) : editing ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <Textarea
            value={currentPlan}
            onChange={(e) => setEditedText(e.target.value)}
            aria-label="Edit plan markdown"
            className="max-h-96 min-h-36 font-mono text-sm"
          />
          {isEdited && (
            <div className="flex items-center justify-end">
              <Button
                size="xs"
                variant="ghost"
                className="h-(--density-control-sm)"
                onClick={() => setEditedText(null)}
              >
                <RotateCcw aria-hidden /> Reset edits
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div
          ref={proseRef}
          onMouseUp={captureSelection}
          onKeyUp={captureSelection}
          className="relative min-w-0"
        >
          <Prose variant="chat">{currentPlan}</Prose>
          {selection && (
            <div
              style={{ top: selection.top, left: selection.left }}
              className="absolute z-(--z-floating) rounded-md border border-border-default bg-surface-overlay p-0.5 shadow-md"
            >
              <Button
                size="xs"
                variant="ghost"
                className="h-(--density-control-sm)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={startComment}
              >
                <MessageSquarePlus aria-hidden /> Comment
              </Button>
            </div>
          )}
        </div>
      )}

      {pendingQuote && (
        <div className="flex min-w-0 flex-col gap-2 rounded-md border border-accent-subtle-border bg-surface-sunken p-2">
          <blockquote className="line-clamp-2 border-l-2 border-accent-solid pl-2 text-sm text-fg-secondary">
            {pendingQuote}
          </blockquote>
          <Input
            autoFocus
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                addComment()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setPendingQuote(null)
              }
            }}
            aria-label="Comment on selected plan text"
            placeholder="Write your comment on this excerpt…"
          />
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="xs"
              variant="ghost"
              className="h-(--density-control-sm)"
              onClick={() => setPendingQuote(null)}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              variant="secondary"
              className="h-(--density-control-sm)"
              disabled={!commentDraft.trim()}
              onClick={addComment}
            >
              Add comment
            </Button>
          </div>
        </div>
      )}

      {comments.length > 0 && (
        <ul aria-label="Plan comments" className="flex min-w-0 flex-col gap-1.5">
          {comments.map((c) => (
            <li
              key={c.id}
              className="flex min-w-0 items-start gap-1.5 rounded-md border border-border-subtle bg-surface-sunken p-2"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <blockquote className="line-clamp-2 border-l-2 border-accent-solid pl-2 text-xs text-fg-secondary">
                  {c.quote}
                </blockquote>
                <p className="text-sm wrap-anywhere text-fg">{c.text}</p>
              </div>
              <IconButton
                size="icon-sm"
                label="Remove comment"
                onClick={() => setComments((prev) => prev.filter((item) => item.id !== c.id))}
              >
                <X aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      {interactive && (
        <div className="flex min-w-0 flex-col gap-2 border-t border-border-subtle pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {onApprove && (
              <Button
                size="sm"
                className="h-(--density-control-sm)"
                onClick={() => onApprove(isEdited ? currentPlan : undefined)}
              >
                {isEdited ? 'Approve edited plan' : approveLabel}
              </Button>
            )}
            {onKeepPlanning && (
              <Button
                size="sm"
                variant="ghost"
                className="h-(--density-control-sm)"
                onClick={onKeepPlanning}
              >
                Keep planning
              </Button>
            )}
          </div>
          {onRevise && (
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && canRevise) {
                      e.preventDefault()
                      submitRevision()
                    }
                  }}
                  aria-label="Plan revision feedback"
                  placeholder={
                    comments.length
                      ? 'Optional note to send with comments…'
                      : 'Tell the assistant what to change…'
                  }
                  className="h-(--density-control-sm) min-w-0 flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-(--density-control-sm) shrink-0"
                  disabled={!canRevise}
                  onClick={submitRevision}
                >
                  {comments.length
                    ? `Send ${comments.length} comment${comments.length === 1 ? '' : 's'}`
                    : 'Revise'}
                </Button>
              </div>
              {!comments.length && !editing && !showDiff && (
                <p className="text-xs text-fg-muted">
                  Select any text in the plan to leave a comment.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
