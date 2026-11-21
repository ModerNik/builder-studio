// WCAG 2.2 contrast of the colour tokens in main.css, both themes: text 4.5:1, UI parts and focus 3:1.
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(__dirname, 'main.css'), 'utf8').replace(/\r\n/g, '\n')

/** Custom properties of the top-level `selector {` blocks (not the ones inside @media). */
function props(selector: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [, body] of css.matchAll(new RegExp(`^${selector} \\{\\n([\\s\\S]*?)^\\}`, 'gm')))
    for (const [, k, v] of body.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)) out[k] = v.trim()
  return out
}
const light = props(':root')
const themes = { light, dark: { ...light, ...props('\\.dark') } }

/* OKLCH -> sRGB (Ottosson), alpha composited over the background, then WCAG relative luminance */
function srgb(L: number, C: number, h: number): number[] {
  const a = C * Math.cos((h * Math.PI) / 180)
  const b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ]
    .map((v) => Math.min(1, Math.max(0, v)))
    .map((v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
}
function parse(value: string): { rgb: number[]; alpha: number } {
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)(%?))?\s*\)$/.exec(value)
  if (!m) throw new Error(`not an oklch() colour: ${value}`)
  return { rgb: srgb(+m[1], +m[2], +m[3]), alpha: m[4] == null ? 1 : m[5] ? +m[4] / 100 : +m[4] }
}
const luminance = (rgb: number[]): number => {
  const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(fg: string, bg: string): number {
  const B = parse(bg)
  const F = parse(fg)
  if (B.alpha < 1) throw new Error(`background must be opaque: ${bg}`)
  const x = luminance(F.rgb.map((c, i) => c * F.alpha + B.rgb[i] * (1 - F.alpha)))
  const y = luminance(B.rgb)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/* the pairs: [foreground, background, minimum] */
const SURF = [
  'surface-sunken',
  'surface-bg',
  'surface-panel',
  'surface-raised',
  'surface-overlay',
  'surface-hover'
]
const SEM = ['success', 'warning', 'danger', 'info']
const DIFF = ['added', 'removed', 'changed']
const pairs: [string, string, number][] = []
const on = (fgs: string[], bgs: string[], min: number): void => {
  for (const f of fgs) for (const b of bgs) pairs.push([f, b, min])
}
on(
  [
    'fg',
    'fg-secondary',
    'fg-muted',
    'accent-text',
    ...SEM.map((k) => `${k}-text`),
    ...DIFF.map((k) => `diff-${k}-fg`),
    'lint-hint'
  ],
  SURF,
  4.5
)
on(['fg', 'fg-secondary', 'fg-muted'], ['surface-viewer'], 4.5)
on(['axis-x', 'axis-y', 'axis-z'], ['surface-viewer', 'surface-panel', 'surface-bg'], 4.5)
on(['fg'], ['selection-bg', 'surface-active'], 4.5)
on(['fg-inverse'], ['surface-inverse'], 4.5)
on(['fg-inverse'], ['axis-x', 'axis-y', 'axis-z'], 4.5) // the axis gizmo's letters
on(['accent-text'], ['accent-subtle-bg'], 4.5)
on(['accent-on-solid'], ['accent-solid', 'accent-solid-hover', 'accent-solid-active'], 4.5)
for (const k of [...SEM, 'neutral']) on([`${k}-on-solid`], [`${k}-solid`, `${k}-solid-hover`], 4.5)
for (const k of SEM) on([`${k}-text`], [`${k}-subtle-bg`], 4.5)
for (const k of DIFF) on([`diff-${k}-fg`], [`diff-${k}-bg`], 4.5)
for (const s of ['idle', 'queued', 'running', 'awaiting-approval', 'done', 'failed', 'cancelled'])
  on([`state-${s}-fg`], [`state-${s}-bg`, 'surface-panel', 'surface-raised'], 4.5)
for (const p of ['open', 'selected', 'resolved']) on([`pin-${p}-text`], [`pin-${p}-fill`], 4.5)
on(['border-strong', 'focus-ring', 'accent-solid', 'danger-solid'], SURF, 3)
on(
  ['diff-added-mark', 'diff-removed-mark', 'diff-changed-mark', 'focus-ring'],
  ['surface-viewer'],
  3
)
on(['pin-selected-ring'], ['pin-selected-fill'], 3)
// shadcn names, as the kit and current screens use them
on(
  ['foreground', 'muted-foreground', 'card-foreground', 'popover-foreground'],
  ['background', 'card', 'popover', 'muted'],
  4.5
)
on(['primary-foreground'], ['primary'], 4.5)
on(['destructive-foreground'], ['destructive'], 4.5)
on(['sidebar-foreground'], ['sidebar', 'sidebar-accent'], 4.5)
on(['ring', 'input'], ['background', 'card', 'popover'], 3)
on(['ok', 'warn'], ['background', 'card'], 4.5)

describe.each(Object.entries(themes))('%s theme', (_, roles) => {
  const get = (name: string): string => {
    let v = roles[name]
    for (let hops = 0; v?.startsWith('var('); hops++) {
      if (hops > 8) throw new Error(`reference loop at --${name}`)
      v = roles[v.slice(6, -1)]
    }
    if (v == null) throw new Error(`missing token --${name}`)
    return v
  }
  it('meets the contrast minimums', () => {
    const misses = pairs
      .map(([f, b, min]) => ({
        pair: `${f} on ${b}`,
        ratio: +contrast(get(f), get(b)).toFixed(2),
        min
      }))
      .filter((p) => p.ratio < p.min)
    expect(misses).toEqual([])
  })
})
