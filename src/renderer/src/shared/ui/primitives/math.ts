// Pure helpers behind NumberField and Pagination; kept free of React and path aliases so they unit-test in node.

export type Limits = { min?: number; max?: number; step?: number }

/** Clamps to [min, max] and rounds to the step's decimals, so 0.1 + 0.2 stays 0.3. */
export function clampNumber(value: number, { min = -Infinity, max = Infinity, step = 1 }: Limits): number {
  const decimals = (String(step).split('.')[1] ?? '').length
  return Number(Math.min(max, Math.max(min, value)).toFixed(decimals))
}

/** Reads typed text: accepts a comma as the decimal mark and a leading minus; null when not a number. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.').replace(/\s/g, '')
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null
  return Number(t)
}

/** The pages to show: first, last, the current one and its neighbours, with null for a gap. */
export function pageWindow(page: number, count: number): (number | null)[] {
  const keep = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count))
  const sorted = [...keep].sort((a, b) => a - b)
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? [null, p] : [p]))
}
