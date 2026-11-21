const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i

/** "#abc", "abc" or "#AABBCC" as "#aabbcc"; null when it is not a hex colour. */
export function normaliseHex(text: string): string | null {
  const m = HEX.exec(text.trim())
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return `#${h.toLowerCase()}`
}
