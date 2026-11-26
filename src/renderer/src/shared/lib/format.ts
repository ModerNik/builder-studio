import type { ReactNode } from 'react'
import { DEFAULT_LINT_RULES, LINT_RULES, type LintRule, type LintRuleToggles } from '@shared/api'

// palette is a count of distinct states, not a problem
export const INFO = new Set(['palette'])
export const LINT_LABELS: Record<string, string> = { gravity: 'falls (gravity)' }

/** Whether a lint count key counts as an active problem under `rules`. */
export function isLintRuleEnabled(
  key: string,
  rules: Partial<LintRuleToggles> = DEFAULT_LINT_RULES
): boolean {
  if (INFO.has(key)) return false
  if (key in DEFAULT_LINT_RULES)
    return rules[key as LintRule] ?? DEFAULT_LINT_RULES[key as LintRule]
  return true
}

export function hasEnabledLintRule(rules: Partial<LintRuleToggles> = DEFAULT_LINT_RULES): boolean {
  return LINT_RULES.some((rule) => rules[rule] ?? DEFAULT_LINT_RULES[rule])
}

export function lintProblems(
  counts: Record<string, number>,
  rules: Partial<LintRuleToggles> = DEFAULT_LINT_RULES
): number {
  return Object.entries(counts).reduce((n, [k, v]) => (isLintRuleEnabled(k, rules) ? n + v : n), 0)
}

/** A state without its prefix and its default-looking properties, roughly mcb.dump.short. */
export const short = (state: string): string => state.replace(/^minecraft:/, '')

/** Markdown emphasis and code ticks off, for one-line previews. */
export const plain = (md: string): string => md.replace(/\*\*|__|`/g, '')

/** Text of a heading's children, for its id. */
export const text = (c: ReactNode): string =>
  typeof c === 'string' || typeof c === 'number'
    ? String(c)
    : Array.isArray(c)
      ? c.map(text).join('')
      : c && typeof c === 'object' && 'props' in c
        ? text((c.props as { children?: ReactNode }).children)
        : ''
