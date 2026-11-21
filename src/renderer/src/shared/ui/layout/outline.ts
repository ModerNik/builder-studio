// Scroll-spy for PageOutline: which heading is "in view" in a scrolling pane, and the jump that scrolls
// only that pane.
import { useEffect, useState, type RefObject } from 'react'

export interface OutlineItem {
  id: string
  title: string
  level: 2 | 3 | 4
}

/**
 * The current heading: the last one whose top has passed `line` px below the pane's top, else the first.
 * `tops` are the headings' tops relative to the pane, in document order.
 */
export function headingAt(ids: string[], tops: number[], line: number): string | undefined {
  let current = ids[0]
  tops.forEach((t, i) => {
    if (t <= line) current = ids[i]
  })
  return current
}

/** Tracks the heading in view inside `pane` (the element that scrolls) as it scrolls or resizes. */
export function useHeadingInView(
  pane: RefObject<HTMLElement | null>,
  ids: string[]
): string | undefined {
  const [current, setCurrent] = useState<string>()
  const key = ids.join('\n')
  useEffect(() => {
    const box = pane.current
    if (!box || !key) return
    const list = key.split('\n')
    const update = (): void => {
      const top = box.getBoundingClientRect().top
      const tops = list.map(
        (id) =>
          (box.querySelector(`#${CSS.escape(id)}`)?.getBoundingClientRect().top ?? Infinity) - top
      )
      // at the very bottom the last heading may never reach the line, so it wins there
      const end = box.scrollTop + box.clientHeight >= box.scrollHeight - 2
      setCurrent(
        end && box.scrollTop > 0 ? list.at(-1) : headingAt(list, tops, box.clientHeight / 4)
      )
    }
    update()
    box.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(box)
    return () => {
      box.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [pane, key])
  return current
}

/** Scrolls only the nearest scrolling pane to the heading and focuses it, never the window. */
export function jumpToHeading(id: string): void {
  const el = document.getElementById(id)
  if (!el) return
  // container: 'nearest' is not in TypeScript's DOM types yet
  el.scrollIntoView({ block: 'start', container: 'nearest' } as ScrollIntoViewOptions)
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
}
