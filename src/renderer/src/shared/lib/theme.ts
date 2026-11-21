// The light/dark class on <html>, and token colours for code that needs a JS colour (three.js, canvas).
// Main sets nativeTheme.themeSource from Settings → Appearance, so prefers-color-scheme is the user's choice;
// public/theme.js applies it before first paint, this keeps it in step afterwards.
import { useSyncExternalStore } from 'react'

const media = matchMedia('(prefers-color-scheme: dark)')
media.addEventListener('change', (e) =>
  document.documentElement.classList.toggle('dark', e.matches)
)

const subscribe = (onChange: () => void): (() => void) => {
  const watch = new MutationObserver(onChange)
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => watch.disconnect()
}
const current = (): 'dark' | 'light' =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light'

/** The theme on screen; re-renders when it changes. */
export const useResolvedTheme = (): 'dark' | 'light' => useSyncExternalStore(subscribe, current)

let pixel: CanvasRenderingContext2D | null = null
/** A token's current value as `rgb(r,g,b)` (three.js cannot parse oklch); call again after a theme change. */
export function cssColor(token: string): string {
  pixel ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
  pixel.clearRect(0, 0, 1, 1)
  pixel.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  pixel.fillRect(0, 0, 1, 1)
  const [r, g, b] = pixel.getImageData(0, 0, 1, 1).data
  return `rgb(${r},${g},${b})`
}
