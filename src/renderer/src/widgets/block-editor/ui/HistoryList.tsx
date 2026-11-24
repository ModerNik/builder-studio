// The edit log (DESIGN › History list): oldest first, the current row marked, undone rows struck through and
// still clickable. A click undoes or redoes to that row; Start is the build as the Workspace opened it.
import { useState, type ReactElement } from 'react'
import {
  FolderOpen,
  MoreHorizontal,
  PencilLine,
  Redo2,
  Trash2,
  Undo2,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { focusRing } from '@/shared/ui/common/styles'
import { ConfirmDestructive } from '@/shared/ui/feedback/ConfirmDestructive'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/shared/ui/primitives/dropdown-menu'
import type { Edit } from '@/entities/block-edit/model/history'
import type { SaveState } from '@/entities/block-edit/model/store'
import { toolOf } from '../model/tools'

const SAVE_WORD: Record<SaveState, string> = {
  saved: 'saved',
  saving: 'saving…',
  failed: 'not saved'
}

export function HistoryList({
  edits,
  cursor,
  onJump,
  onUndo,
  onRedo,
  handEdits,
  save = 'saved',
  onDiscard,
  build,
  className
}: {
  edits: Edit[]
  /** edits[0..cursor) are applied. */
  cursor: number
  onJump: (cursor: number) => void
  onUndo: () => void
  onRedo: () => void
  /** Cells the saved hand edits change. */
  handEdits: number
  /** Whether the hand edits are saved, saving or failed to save. */
  save?: SaveState
  onDiscard: () => void
  build: string
  className?: string
}): ReactElement {
  const [asking, setAsking] = useState(false)
  return (
    <section aria-labelledby="history-title" className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-1">
        <h3 id="history-title" className="flex-1 font-medium">
          History
        </h3>
        <IconButton
          label="Undo"
          shortcut="Ctrl+Z"
          size="icon-sm"
          disabled={!cursor}
          onClick={onUndo}
        >
          <Undo2 aria-hidden />
        </IconButton>
        <IconButton
          label="Redo"
          shortcut="Ctrl+Y"
          size="icon-sm"
          disabled={cursor === edits.length}
          onClick={onRedo}
        >
          <Redo2 aria-hidden />
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="More: Discard hand edits" size="icon-sm">
              <MoreHorizontal aria-hidden />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              disabled={!handEdits}
              onSelect={() => setAsking(true)}
            >
              <Trash2 aria-hidden /> Discard hand edits…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {(handEdits > 0 || save !== 'saved') && (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            'flex items-center gap-1.5 text-xs',
            save === 'failed' ? 'text-danger-text' : 'text-fg-secondary'
          )}
        >
          <PencilLine aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="tabular-nums">
            {handEdits.toLocaleString()} hand {handEdits === 1 ? 'edit' : 'edits'}
          </span>
          <span aria-hidden="true">·</span>
          <span>{SAVE_WORD[save]}</span>
        </p>
      )}
      {edits.length ? (
        <ol className="flex flex-col">
          <Row icon={FolderOpen} label="Start" current={cursor === 0} onClick={() => onJump(0)} />
          {edits.map((e, i) => (
            <Row
              key={i}
              icon={toolOf(e.tool).icon}
              label={e.label}
              count={e.changes.length}
              current={cursor === i + 1}
              undone={i >= cursor}
              onClick={() => onJump(i + 1)}
            />
          ))}
        </ol>
      ) : (
        <p className="text-sm text-fg-secondary">No edits yet.</p>
      )}
      <p className="text-sm text-fg-muted">
        History lasts until you close the Workspace. Hand edits are saved with the build.
      </p>
      <ConfirmDestructive
        open={asking}
        onOpenChange={setAsking}
        title={`Discard the hand edits to ${build}?`}
        action="Discard"
        onConfirm={onDiscard}
      >
        <p>
          The {handEdits.toLocaleString()} {handEdits === 1 ? 'block' : 'blocks'} you placed,
          changed or erased go back to what the build&apos;s code draws. Until you close the
          Workspace, Undo brings them back.
        </p>
      </ConfirmDestructive>
    </section>
  )
}

function Row({
  icon: Icon,
  label,
  count,
  current,
  undone,
  onClick
}: {
  icon: LucideIcon
  label: string
  count?: number
  current: boolean
  undone?: boolean
  onClick: () => void
}): ReactElement {
  return (
    <li>
      <button
        type="button"
        aria-current={current ? 'step' : undefined}
        onClick={onClick}
        className={cn(
          'relative flex min-h-(--density-row) w-full items-center gap-2 rounded-sm px-2 text-start text-sm',
          'can-hover:hover:bg-surface-hover [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-secondary',
          'aria-[current=step]:bg-surface-active aria-[current=step]:before:absolute aria-[current=step]:before:inset-y-1 aria-[current=step]:before:start-0 aria-[current=step]:before:w-0.5 aria-[current=step]:before:rounded-full aria-[current=step]:before:bg-accent-solid',
          undone && 'text-fg-muted line-through',
          focusRing
        )}
      >
        <Icon aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          {label}
          {undone && <span className="sr-only"> (undone)</span>}
        </span>
        {count !== undefined && (
          <span className="shrink-0 font-mono text-xs text-fg-muted tabular-nums">
            <span className="sr-only">, </span>
            {count.toLocaleString()}
            <span className="sr-only"> {count === 1 ? 'block' : 'blocks'}</span>
          </span>
        )}
      </button>
    </li>
  )
}
