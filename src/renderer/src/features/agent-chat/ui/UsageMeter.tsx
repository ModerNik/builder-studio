import type { ReactElement } from 'react'
import { OctagonAlert, TriangleAlert } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { cn } from '@/shared/lib/utils'
import { Tip } from '@/shared/ui/common/Tip'
import { CONTEXT_AMBER, CONTEXT_RED, contextTone, formatTokens } from '../model/logic'

/**
 * The assistant's meter line: session status, context tokens on a thin bar with the amber (150k) and
 * red (200k) marks, Compact once it is amber, the sign-in kind, parallel variants and the session cost.
 * The tone shows as an icon and a word as well as colour.
 */
export function UsageMeter({
  status,
  tokens,
  max,
  cost,
  auth,
  variants = 0,
  onCompact,
  compactDisabled,
  className
}: {
  /** The session's status as the provider reports it: "ready", "working", "off". */
  status: string
  tokens?: number
  max?: number
  /** USD as the CLI reports it; null when the provider does not report one. */
  cost?: number | null
  /** How the CLI is signed in, as the app names it: "auth: ANTHROPIC_API_KEY". */
  auth?: string
  /** Variant sessions working in parallel. */
  variants?: number
  onCompact?: () => void
  compactDisabled?: boolean
  className?: string
}): ReactElement {
  const tone = tokens === undefined ? 'ok' : contextTone(tokens)
  const scale = Math.max(max ?? CONTEXT_RED, CONTEXT_RED, tokens ?? 0)
  const pct = (n: number): string => `${Math.min(100, (n / scale) * 100)}%`
  const Icon = tone === 'danger' ? OctagonAlert : tone === 'warning' ? TriangleAlert : null
  return (
    <div
      className={cn(
        'flex h-(--density-control-sm) shrink-0 items-center gap-3 border-t border-border-subtle bg-surface-panel px-2 font-mono text-xs text-fg-muted tabular-nums',
        className
      )}
    >
      {/* named, as auth is: a bare "off" says nothing */}
      <span className="shrink-0 text-fg-secondary">session: {status}</span>
      {tokens !== undefined && (
        <Tip
          label={`Context: ${tokens.toLocaleString('en-US')} of ${(max ?? scale).toLocaleString('en-US')} tokens. Amber from 150k, red from 200k; Compact summarizes the session.`}
        >
          <span
            role="meter"
            tabIndex={0}
            aria-label="Context used"
            aria-valuemin={0}
            aria-valuemax={max ?? scale}
            aria-valuenow={tokens}
            aria-valuetext={`${formatTokens(tokens)} tokens${tone === 'danger' ? ', over the limit' : tone === 'warning' ? ', near the limit' : ''}`}
            className={cn(
              'flex min-w-0 items-center gap-1.5 rounded-sm focus-visible:outline-2 focus-visible:outline-focus',
              tone === 'warning' && 'text-warning-text',
              tone === 'danger' && 'text-danger-text'
            )}
          >
            {Icon && <Icon aria-hidden className="size-3 shrink-0" />}
            <span className="shrink-0">ctx {formatTokens(tokens)}</span>
            <span
              aria-hidden
              className="relative h-1 w-16 shrink-0 rounded-full bg-surface-active max-xs:hidden"
            >
              <span
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full transition-[width] duration-(--dur-slow)',
                  tone === 'danger'
                    ? 'bg-danger-solid'
                    : tone === 'warning'
                      ? 'bg-warning-solid'
                      : 'bg-fg-muted'
                )}
                style={{ width: pct(tokens) }}
              />
              <span
                className="absolute -top-0.5 h-2 w-px bg-warning-solid"
                style={{ left: pct(CONTEXT_AMBER) }}
              />
              <span
                className="absolute -top-0.5 h-2 w-px bg-danger-solid"
                style={{ left: pct(CONTEXT_RED) }}
              />
            </span>
            {max !== undefined && (
              <span className="shrink-0 text-fg-muted max-xs:hidden">/ {formatTokens(max)}</span>
            )}
          </span>
        </Tip>
      )}
      {onCompact && tone !== 'ok' && (
        <Button
          size="xs"
          variant="ghost"
          className="h-5 px-1.5 font-sans pointer-coarse:h-(--density-control-sm)"
          disabled={compactDisabled}
          onClick={onCompact}
        >
          Compact
        </Button>
      )}
      <span className="flex-1" />
      {auth && <span className="truncate max-sm:hidden">{auth}</span>}
      {variants > 0 && (
        <Tip label="Parallel variant sessions working now">
          <span
            tabIndex={0}
            className="shrink-0 rounded-sm text-accent-text focus-visible:outline-2 focus-visible:outline-focus"
          >
            +{variants} variant{variants > 1 ? 's' : ''}
            <span className="sr-only">: parallel variant sessions working now</span>
          </span>
        </Tip>
      )}
      {cost === null ? (
        <span className="shrink-0">cost unavailable</span>
      ) : (
        cost !== undefined && (
          <Tip label="total_cost_usd as the CLI reports it (notional on a subscription plan)">
            <span
              tabIndex={0}
              className="shrink-0 rounded-sm text-fg-secondary focus-visible:outline-2 focus-visible:outline-focus"
            >
              ${cost.toFixed(2)}
            </span>
          </Tip>
        )
      )}
    </div>
  )
}
