import { useId, useState, type ReactElement, type ReactNode } from 'react'
import {
  Bot,
  ChevronRight,
  CircleX,
  FilePen,
  FileText,
  Globe,
  ListTodo,
  LoaderCircle,
  Plug,
  Search,
  Terminal,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { cn } from '@/shared/lib/utils'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { formatElapsed } from '@/shared/ui/common/time'
import { toolLook, type ToolKind } from '../model/logic'

const ICON: Record<ToolKind, LucideIcon> = {
  edit: FilePen,
  read: FileText,
  search: Search,
  run: Terminal,
  web: Globe,
  todo: ListTodo,
  agent: Bot,
  mcp: Plug,
  other: Wrench
}

export type ToolStatus = 'running' | 'done' | 'error'

/**
 * One tool call as a quiet row: icon, verb, gist, +/− line counts and its state. Clicking it opens what
 * it was given and what came back. Running shows a spinner, an error a red mark and "failed" for readers.
 */
export function ToolCallRow({
  name,
  input,
  status,
  defaultOpen = false,
  children
}: {
  /** The tool's name as the provider reports it: Edit, Bash, mcp__studio__status. */
  name: string
  input: Record<string, unknown>
  status: ToolStatus
  defaultOpen?: boolean
  /** The details: a diff, the input, the result. */
  children?: ReactNode
}): ReactElement {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const t = toolLook(name, input)
  const Icon = ICON[t.kind]
  return (
    <div className="tool-row min-w-0">
      <button
        type="button"
        aria-expanded={children ? open : undefined}
        aria-controls={children ? id : undefined}
        disabled={!children}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'group flex min-h-(--density-row) w-full min-w-0 items-center gap-2 rounded-md px-1.5 text-left text-base text-fg-secondary transition-colors duration-(--dur-fast)',
          'enabled:hover:bg-surface-hover enabled:hover:text-fg focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-default',
          status === 'error' && 'text-danger-text enabled:hover:text-danger-text'
        )}
      >
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="shrink-0">{t.verb}</span>
        <span className="min-w-0 truncate font-mono text-sm text-fg-muted">{t.gist}</span>
        <span className="flex-1" />
        {(t.added > 0 || t.removed > 0) && (
          <span className="shrink-0 font-mono text-xs tabular-nums">
            {t.added > 0 && (
              <span className="text-diff-added">
                +{t.added}
                <span className="sr-only"> lines added</span>
              </span>
            )}
            {t.added > 0 && t.removed > 0 && ' '}
            {t.removed > 0 && (
              <span className="text-diff-removed">
                −{t.removed}
                <span className="sr-only"> lines removed</span>
              </span>
            )}
          </span>
        )}
        {status === 'running' && (
          <LoaderCircle
            aria-label="running"
            className="size-3.5 shrink-0 text-state-running motion-safe:animate-spin"
          />
        )}
        {status === 'error' && <CircleX aria-label="failed" className="size-3.5 shrink-0" />}
        {children && (
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3.5 shrink-0 opacity-0 transition duration-(--dur-base) group-hover:opacity-100 group-focus-visible:opacity-100',
              open && 'rotate-90 opacity-100'
            )}
          />
        )}
      </button>
      {children && open && (
        <div
          id={id}
          className="mt-1 ml-5 flex min-w-0 flex-col gap-2 rounded-lg border border-border-subtle bg-surface-raised p-2"
        >
          {children}
        </div>
      )}
    </div>
  )
}

/** A tool's raw output, capped so a huge result never floods the panel. */
export function ToolResult({
  text,
  error = false
}: {
  text: string
  error?: boolean
}): ReactElement {
  const cut = text.length > 6000
  return (
    <pre
      className={cn(
        'max-h-60 overflow-auto rounded-md bg-surface-sunken p-2 font-mono text-sm break-words whitespace-pre-wrap text-fg-secondary select-text',
        error && 'text-danger-text'
      )}
    >
      {cut ? `${text.slice(0, 6000)}\n…` : text || '(no output)'}
    </pre>
  )
}

/**
 * A `build.py` run the assistant made: its tool row, then the result line (seconds, or where it stopped),
 * lint, and Show / Sheet to open what it wrote.
 */
export function JobCard({
  command,
  status,
  seconds,
  stoppedAt,
  lintProblems,
  wrote,
  onShow,
  onSheet,
  children
}: {
  command: string
  status: ToolStatus
  seconds?: number
  /** The stage label it stopped at, when it did not finish. */
  stoppedAt?: string
  lintProblems?: number
  /** The .litematic it wrote. */
  wrote?: string
  onShow?: () => void
  onSheet?: () => void
  children?: ReactNode
}): ReactElement {
  return (
    <div
      aria-busy={status === 'running' || undefined}
      className="min-w-0 rounded-lg border border-accent-subtle-border bg-accent-subtle/40 p-1"
    >
      <ToolCallRow name="Bash" input={{ command }} status={status}>
        {children}
      </ToolCallRow>
      <div className="flex flex-wrap items-center gap-2 px-1.5 pt-1 pb-0.5 text-base">
        <span className="font-mono text-fg-secondary tabular-nums">
          {status === 'running'
            ? 'running…'
            : seconds !== undefined
              ? formatElapsed(seconds)
              : stoppedAt
                ? `stopped at ${stoppedAt}`
                : 'no stage events'}
        </span>
        {lintProblems !== undefined &&
          (lintProblems ? (
            <StatusBadge tone="warning">
              lint {lintProblems} problem{lintProblems === 1 ? '' : 's'}
            </StatusBadge>
          ) : (
            <StatusBadge tone="success">lint 0</StatusBadge>
          ))}
        <span className="flex-1" />
        {wrote && onShow && (
          <Button
            size="xs"
            variant="outline"
            className="h-(--density-control-sm) max-w-full min-w-0"
            onClick={onShow}
          >
            <span className="truncate">Show {wrote.split('/').pop()}</span>
          </Button>
        )}
        {onSheet && (
          <Button
            size="xs"
            variant="outline"
            className="h-(--density-control-sm)"
            onClick={onSheet}
          >
            Sheet
          </Button>
        )}
      </div>
    </div>
  )
}

/** A subagent call: its row stays open and its own steps nest inside on a rail. */
export function SubagentCard({
  type,
  description,
  status,
  children,
  result
}: {
  type: string
  description: string
  status: ToolStatus
  /** The subagent's own transcript items. */
  children: ReactNode
  result?: ReactNode
}): ReactElement {
  return (
    <ToolCallRow
      name="Task"
      input={{ subagent_type: type, description }}
      status={status}
      defaultOpen
    >
      <div className="flex min-w-0 flex-col gap-1 border-l border-accent-subtle-border pl-2">
        {children}
      </div>
      {result}
    </ToolCallRow>
  )
}
