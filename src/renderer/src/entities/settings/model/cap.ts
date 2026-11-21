/** Variants drafted at once: 2 to 6, whatever was saved before. */
export const clampCap = (n: unknown): number => Math.min(6, Math.max(2, Math.round(Number(n)) || 3))
