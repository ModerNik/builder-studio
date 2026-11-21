import type { ReactNode } from 'react'

// palette is a count of distinct states, not a problem; floating parts hang in game (only gravity blocks fall)
export const INFO = new Set(['palette', 'floating'])
export const LINT_LABELS: Record<string, string> = { gravity: 'falls (gravity)' }

export function lintProblems(counts: Record<string, number>): number {
  return Object.entries(counts).reduce((n, [k, v]) => (INFO.has(k) ? n : n + v), 0)
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
