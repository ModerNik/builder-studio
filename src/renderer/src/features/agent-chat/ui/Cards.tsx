// What the assistant asks the builder: a plan to approve and a tool call to permit; and its working status.
import { useId, type ReactElement, type ReactNode } from 'react'
import { ListTodo, ShieldAlert, ShieldQuestion } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { cn } from '@/shared/lib/utils'
import { Prose } from '@/shared/ui/code/Prose'
import { formatElapsed, useElapsed } from '@/shared/ui/common/time'
import { Tip } from '@/shared/ui/common/Tip'

/** A plan the assistant proposes (Claude's plan mode, or Codex plan text), with its decision buttons. */
export function PlanCard({
  plan,
  onApprove,
  onKeepPlanning,
  approveLabel = 'Approve plan',
  className
}: {
  plan: string
  onApprove: () => void
  /** Omit for Codex, whose plans are text: only "Implement plan" applies. */
  onKeepPlanning?: () => void
  approveLabel?: string
  className?: string
}): ReactElement {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-lg border border-accent-subtle-border bg-surface-raised p-3',
        className
      )}
    >
      <h3 id={id} className="flex items-center gap-1.5 text-base font-medium text-accent-text">
        <ListTodo aria-hidden className="size-3.5" /> Plan
      </h3>
      <Prose variant="chat">{plan}</Prose>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <Button size="sm" className="h-(--density-control-sm)" onClick={onApprove}>
          {approveLabel}
        </Button>
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
    </section>
  )
}

export type PermitDecision = 'allow' | 'allow-auto' | 'always' | 'deny'

/**
 * The assistant asks before a tool call: what it wants to run, then Allow once, Allow and switch to Auto,
 * Always (stores the rule for this build) and Deny. A guard means the call can never be allowed for good.
 */
export function PermissionCard({
  tool,
  title,
  subagent = false,
  children,
  rule,
  guard,
  canSwitchToAuto = false,
  onDecide,
  className
}: {
  /** The tool's display name: "Bash", "studio · log_round". */
  tool: string
  /** The provider's one-line description of the call. */
  title?: string
  subagent?: boolean
  /** What it would run: a command block, a diff. */
  children?: ReactNode
  /** The Always rule, e.g. `Bash(python builds/x/build.py check)`. */
  rule?: string
  /** Why this call asks every time: "git push", "a path outside the workspace". */
  guard?: string
  canSwitchToAuto?: boolean
  onDecide: (d: PermitDecision) => void
  className?: string
}): ReactElement {
  const id = useId()
  const Icon = guard ? ShieldAlert : ShieldQuestion
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-lg border border-warning-subtle-border bg-warning-subtle p-3',
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3
          id={id}
          className="flex min-w-0 flex-wrap items-center gap-1.5 text-base font-medium wrap-anywhere text-fg"
        >
          <Icon aria-hidden className="size-4 shrink-0 text-warning-text" />
          Allow {tool}?
          {subagent && <span className="font-normal text-fg-secondary">· from a subagent</span>}
        </h3>
        {title && <p className="pl-5.5 text-sm wrap-anywhere text-fg-secondary">{title}</p>}
      </div>
      {children}
      {guard && (
        <p className="flex items-start gap-1.5 text-base text-danger-text">
          Always is off for this call: {guard}.
        </p>
      )}
      <div className="flex min-w-0 flex-wrap gap-1.5">
        <Button size="sm" className="h-(--density-control-sm)" onClick={() => onDecide('allow')}>
          Allow once
        </Button>
        {canSwitchToAuto && (
          <Tip label="Allow this, then let the assistant decide on its own; risky calls still ask">
            <Button
              size="sm"
              variant="outline"
              className="h-(--density-control-sm)"
              onClick={() => onDecide('allow-auto')}
            >
              Allow and switch to Auto
            </Button>
          </Tip>
        )}
        {rule && !guard && (
          <Tip
            label={
              <>
                Stores <code className="font-mono">{rule}</code> for this build in settings.json
              </>
            }
          >
            <Button
              size="sm"
              variant="outline"
              className="h-(--density-control-sm) max-w-full min-w-0"
              onClick={() => onDecide('always')}
            >
              Always <span className="truncate font-mono text-sm">{rule}</span>
            </Button>
          </Tip>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-(--density-control-sm)"
          onClick={() => onDecide('deny')}
        >
          Deny
        </Button>
      </div>
    </section>
  )
}

/** A command or input the assistant wants to run, inside a PermissionCard. */
export function CommandPreview({ children }: { children: string }): ReactElement {
  return (
    <pre className="max-h-48 overflow-auto rounded-md border border-border-subtle bg-surface-sunken p-2 font-mono text-sm break-words whitespace-pre-wrap text-fg select-text">
      {children}
    </pre>
  )
}

/**
 * "Editing…" while the assistant is on a turn: the working dot, a shimmering label and the elapsed time.
 * Under reduced motion the dot and label hold still; the words carry the state.
 */
export function WorkingIndicator({
  label,
  startedAt,
  className
}: {
  /** What it is doing: "Thinking", "Editing build.py", "Running build.py". */
  label: string
  startedAt: number
  className?: string
}): ReactElement {
  const s = useElapsed(startedAt)
  return (
    <div role="status" className={cn('flex items-center gap-2.5 px-1.5 py-0.5 text-sm', className)}>
      <span aria-hidden className="working-dot" />
      <span className="shimmer font-medium">{label}…</span>
      {s > 0 && (
        <span aria-hidden className="font-mono text-xs text-fg-muted tabular-nums">
          {formatElapsed(s)}
        </span>
      )}
    </div>
  )
}
