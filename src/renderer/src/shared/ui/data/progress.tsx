// Sequences: the design log's round timeline, the setup stepper and the export checklist.
import type { ReactElement, ReactNode } from 'react'
import { Tip } from '@/shared/ui/common/Tip'
import {
  Check,
  Circle,
  CircleMinus,
  ImageOff,
  LoaderCircle,
  TriangleAlert,
  X,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export type Round = {
  n: number
  title: string
  date?: string
  /** URL of the round's preview sheet. */
  sheet?: string
  /** One-line gist: the pick, how many pins. */
  gist?: string
}

/** Review rounds newest first on a rail, each with its sheet; clicking one jumps to it. */
export function Timeline({
  rounds,
  current,
  onSelect,
  className
}: {
  rounds: Round[]
  current?: number
  onSelect?: (n: number) => void
  className?: string
}): ReactElement {
  return (
    <ol className={cn('relative flex flex-col gap-1', className)}>
      <span
        aria-hidden
        className="absolute top-3 bottom-3 left-[0.4375rem] w-px bg-border-default"
      />
      {rounds.map((r) => {
        const active = r.n === current
        const body = (
          <>
            <span
              aria-hidden
              className={cn(
                'relative z-[1] mt-1 size-[0.9375rem] shrink-0 rounded-full border-2 bg-surface-panel',
                active ? 'border-accent-solid bg-accent-solid' : 'border-border-strong'
              )}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 font-mono text-sm text-fg-muted tabular-nums">{r.n}</span>
                <span className="min-w-0 truncate font-medium">{r.title}</span>
                {r.date && (
                  <span className="ml-auto shrink-0 font-mono text-xs text-fg-muted tabular-nums">
                    {r.date}
                  </span>
                )}
              </span>
              {r.gist && <span className="text-sm text-fg-secondary">{r.gist}</span>}
              {r.sheet ? (
                <img
                  src={r.sheet}
                  alt={`Preview sheet of round ${r.n}`}
                  loading="lazy"
                  className="aspect-[16/7] w-full rounded-md border border-border-subtle bg-surface-viewer object-cover object-left-top"
                />
              ) : (
                <span className="flex aspect-[16/7] w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-default bg-surface-sunken text-sm text-fg-muted">
                  <ImageOff aria-hidden className="size-3.5" /> No sheet for this round
                </span>
              )}
            </span>
          </>
        )
        return (
          <li key={r.n}>
            {onSelect ? (
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(r.n)}
                className={cn(
                  'flex w-full gap-3 rounded-lg p-2 pl-0 text-left transition-colors duration-(--dur-fast) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus',
                  active && 'bg-surface-hover'
                )}
              >
                {body}
              </button>
            ) : (
              <div className="flex gap-3 p-2 pl-0">{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export type StepStatus = 'done' | 'current' | 'upcoming' | 'skipped' | 'error'
export type Step = {
  id: string
  label: string
  detail?: string
  status: StepStatus
  optional?: boolean
}

const STEP: Record<StepStatus, { icon: LucideIcon | null; dot: string; spoken: string }> = {
  done: {
    icon: Check,
    dot: 'border-accent-solid bg-accent-solid text-accent-on-solid',
    spoken: 'done'
  },
  current: {
    icon: null,
    dot: 'border-accent-solid bg-surface-panel text-accent-text',
    spoken: 'current step'
  },
  upcoming: {
    icon: null,
    dot: 'border-border-strong bg-surface-panel text-fg-muted',
    spoken: 'not started'
  },
  skipped: {
    icon: CircleMinus,
    dot: 'border-border-default bg-surface-sunken text-fg-muted',
    spoken: 'skipped'
  },
  error: {
    icon: TriangleAlert,
    dot: 'border-danger-solid bg-danger-subtle text-danger-text',
    spoken: 'needs attention'
  }
}

/**
 * Steps of a flow (the setup wizard): done, current, upcoming, skipped and error, each with an optional mark.
 * vertical is the rail beside a step's content; horizontal sits above it and drops labels when narrow.
 * compact (vertical only) is the 72px rail: dots and numbers, each step's name in its tooltip.
 */
export function Stepper({
  steps,
  orientation = 'vertical',
  onSelect,
  label = 'Steps',
  compact = false,
  className
}: {
  steps: Step[]
  orientation?: 'vertical' | 'horizontal'
  /** Vertical only: names move into tooltips (the rail at tablet width). */
  compact?: boolean
  /** Makes steps that are not upcoming clickable. */
  onSelect?: (id: string) => void
  label?: string
  className?: string
}): ReactElement {
  const vertical = orientation === 'vertical'
  return (
    <nav aria-label={label} className={cn(!vertical && '@container', className)}>
      <ol className={cn('flex', vertical ? 'flex-col' : 'items-start')}>
        {steps.map((s, i) => {
          const look = STEP[s.status]
          const Icon = look.icon
          const last = i === steps.length - 1
          const clickable = onSelect && s.status !== 'upcoming' && s.status !== 'current'
          const dot = (
            <span
              aria-hidden
              className={cn(
                'relative z-[1] grid size-6 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold tabular-nums',
                look.dot
              )}
            >
              {Icon ? <Icon className="size-3.5" strokeWidth={2.5} /> : i + 1}
            </span>
          )
          const text = (
            <span
              className={cn(
                'flex min-w-0 flex-col',
                !vertical && 'hidden items-center text-center @lg:flex',
                vertical && compact && 'sr-only'
              )}
            >
              <span
                className={cn(
                  'truncate',
                  s.status === 'current' ? 'font-medium text-fg' : 'text-fg-secondary',
                  s.status === 'skipped' && 'text-fg-muted line-through decoration-fg-muted/60',
                  s.status === 'error' && 'text-danger-text'
                )}
              >
                {s.label}
              </span>
              {(s.optional || s.detail) && (
                <span className="truncate text-sm text-fg-muted">
                  {[s.optional && 'Optional', s.detail].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
          )
          const inner = (
            <>
              {dot}
              {text}
              <span className="sr-only">, {look.spoken}</span>
            </>
          )
          const cell = cn(
            'flex min-w-0 gap-2.5 rounded-md text-left',
            vertical
              ? compact
                ? 'justify-center p-1.5'
                : 'items-start py-1.5 pr-2'
              : 'flex-col items-center px-1',
            clickable &&
              'cursor-pointer transition-colors duration-(--dur-fast) hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus'
          )
          return (
            <li
              key={s.id}
              aria-current={s.status === 'current' ? 'step' : undefined}
              className={cn(
                'relative flex min-w-0',
                vertical ? 'pb-2' : 'flex-1 justify-center',
                vertical && compact && 'justify-center'
              )}
            >
              {!last && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute',
                    vertical
                      ? compact
                        ? 'top-9 bottom-0 left-1/2 w-0.5 -translate-x-1/2'
                        : 'top-8 bottom-0 left-[0.6875rem] w-0.5'
                      : 'top-[0.6875rem] left-1/2 h-0.5 w-full',
                    s.status === 'done' ? 'bg-accent-solid' : 'bg-border-default'
                  )}
                />
              )}
              {withTip(
                clickable ? (
                  <button type="button" className={cell} onClick={() => onSelect(s.id)}>
                    {inner}
                  </button>
                ) : (
                  <span className={cell}>{inner}</span>
                ),
                vertical && compact
                  ? [s.label, s.optional && 'Optional', s.detail].filter(Boolean).join(' · ')
                  : null
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

const withTip = (el: ReactElement, tip: string | null): ReactElement =>
  tip ? (
    <Tip label={tip} side="right">
      {el}
    </Tip>
  ) : (
    el
  )

export type CheckStatus = 'idle' | 'running' | 'done' | 'failed' | 'skipped' | 'warning'

const CHECK: Record<CheckStatus, { icon: LucideIcon; cls: string; spoken: string }> = {
  idle: { icon: Circle, cls: 'text-fg-muted', spoken: 'Not run' },
  running: {
    icon: LoaderCircle,
    cls: 'text-state-running motion-safe:animate-spin',
    spoken: 'Running'
  },
  done: { icon: Check, cls: 'text-success-text', spoken: 'Passed' },
  failed: { icon: X, cls: 'text-danger-text', spoken: 'Failed' },
  skipped: { icon: CircleMinus, cls: 'text-fg-muted', spoken: 'Skipped' },
  warning: { icon: TriangleAlert, cls: 'text-warning-text', spoken: 'Needs attention' }
}

/**
 * One line of a checklist (Export, Diagnostics, Setup's tools): status icon, an optional step number, label,
 * mono detail and its action. Without `n` it is an unnumbered requirement or tool. With
 * `onSelect` the label and detail are a button that opens the step's detail pane; `selected` marks it.
 */
export function ChecklistRow({
  n,
  label,
  status,
  detail,
  action,
  selected,
  onSelect
}: {
  /** The step number, for ordered steps (Export); leave it out for a list of requirements or tools. */
  n?: number
  label: string
  status: CheckStatus
  /** What the step found or wrote: counts, a path. Mono. */
  detail?: ReactNode
  action?: ReactNode
  selected?: boolean
  onSelect?: () => void
}): ReactElement {
  const look = CHECK[status]
  const Icon = look.icon
  const Main = onSelect ? 'button' : 'div'
  return (
    <li
      aria-busy={status === 'running' || undefined}
      className={cn(
        'relative flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-border-subtle py-2.5 last:border-0',
        onSelect &&
          'px-2 transition-colors duration-fast ease-standard can-hover:hover:bg-surface-hover',
        selected && 'bg-surface-active can-hover:hover:bg-surface-active'
      )}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute inset-y-1 start-0 w-0.5 rounded-full bg-accent-solid"
        />
      )}
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', look.cls)} strokeWidth={2.25} />
      <Main
        {...(onSelect && {
          type: 'button' as const,
          onClick: onSelect,
          'aria-current': selected ? ('true' as const) : undefined
        })}
        className={cn(
          'min-w-0 flex-[1_1_12rem]',
          onSelect &&
            'focus-ring -my-1 cursor-pointer rounded-sm py-1 text-start after:absolute after:inset-0 after:content-[""]'
        )}
      >
        <span className={cn('block', status === 'skipped' && 'text-fg-muted')}>
          {n != null && (
            <span className="mr-2 font-mono text-sm text-fg-muted tabular-nums">{n}</span>
          )}
          {label}
          <span className="sr-only">: {look.spoken}</span>
        </span>
        {detail && (
          <span
            className={cn(
              'mt-0.5 block font-mono text-sm break-words text-fg-secondary select-text',
              status === 'failed' && 'text-danger-text'
            )}
          >
            {detail}
          </span>
        )}
      </Main>
      {action && <div className="relative z-1 ml-7 flex shrink-0 gap-1.5 @sm:ml-0">{action}</div>}
    </li>
  )
}

/** The list a ChecklistRow sits in; container-aware, so actions wrap under the label when narrow. */
export function Checklist({
  label,
  children,
  className
}: {
  label: string
  children: ReactNode
  className?: string
}): ReactElement {
  return (
    <div className={cn('@container', className)}>
      <ol aria-label={label}>{children}</ol>
    </div>
  )
}
