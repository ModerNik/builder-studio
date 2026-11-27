// Dev-only live performance numbers: frame rate, long tasks, heap, React commits, per-process CPU and RAM
// from main, and WebGL counters of every live viewer and the world map. Loaded only in `npm run dev`.
import { useEffect, useState } from 'react'
import type { WebGLRenderer } from 'three'
import { studio } from '@/shared/api/studio'
import type { PerfSample } from '@shared/api'
import { mb, ms, processRows, tone, type PerfGroup, type PerfRow } from './rows'

export type { PerfGroup, PerfRow }

let commits = 0
let commitMs = 0
/** `<Profiler onRender>` for the routed screen (wired in Shell in development only). */
export function recordCommit(_id: string, _phase: string, actualDuration: number): void {
  commits++
  commitMs += actualDuration
}

interface Viewer {
  fps: number
  gl: WebGLRenderer
}
interface DevHandles {
  __viewers?: Set<Viewer>
  __worldMap?: { scene: { gl: WebGLRenderer }; streamer: object }
}

// render.calls/triangles would only show the composer's last pass, so only fps and GPU object counts
function glRow(name: string, gl: WebGLRenderer, fps?: number): PerfRow {
  const { memory, programs } = gl.info
  return {
    label: name,
    value: `${fps === undefined ? '' : `${fps} fps · `}${memory.geometries} geo · ${memory.textures} tex · ${programs?.length ?? 0} prog`
  }
}

/** Samples once a second while `open`; the frame and long-task observers run only while open. */
export function usePerfHud(open: boolean): PerfGroup[] {
  const [groups, setGroups] = useState<PerfGroup[]>([])
  useEffect(() => {
    if (!open) return
    let frames = 0
    let worst = 0
    let last = performance.now()
    let raf = requestAnimationFrame(function tick(now) {
      frames++
      worst = Math.max(worst, now - last)
      last = now
      raf = requestAnimationFrame(tick)
    })
    let longCount = 0
    let longMs = 0
    const observer =
      typeof PerformanceObserver !== 'undefined' &&
      PerformanceObserver.supportedEntryTypes?.includes('longtask')
        ? new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
              longCount++
              longMs += e.duration
            }
          })
        : null
    observer?.observe({ type: 'longtask' })
    let main: PerfSample | null = null
    let mainError = false
    const nav = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined
    const second = (): void => {
      void studio.perf
        .sample()
        .then((s) => (main = s))
        .catch(() => (mainError = true))
      const heap = (
        performance as Performance & {
          memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number }
        }
      ).memory
      const renderer: PerfRow[] = [
        { label: 'Frame rate', value: `${frames} fps`, tone: frames < 30 ? 'warn' : undefined },
        { label: 'Worst frame', value: ms(worst), tone: tone(worst, 50, 200) },
        {
          label: 'Long tasks',
          value: `${longCount} · ${ms(longMs)}`,
          tone: tone(longMs, 100, 400)
        },
        {
          label: 'React commits',
          value: `${commits} · ${ms(commitMs)}`,
          tone: tone(commitMs, 50, 200)
        },
        { label: 'JS heap', value: heap ? mb(heap.usedJSHeapSize) : 'n/a' },
        { label: 'DOM nodes', value: String(document.getElementsByTagName('*').length) }
      ]
      frames = 0
      worst = 0
      longCount = 0
      longMs = 0
      commits = 0
      commitMs = 0
      const dev = window as unknown as DevHandles
      const gpu = [...(dev.__viewers ?? [])].map((v, i) => glRow(`Viewer ${i + 1}`, v.gl, v.fps))
      if (dev.__worldMap?.scene.gl) {
        gpu.push(glRow('World map', dev.__worldMap.scene.gl))
        const stats = (
          dev.__worldMap.streamer as {
            lastStats?: { lowresLoaded: number; hiresLoaded: number; pending: number }
          }
        ).lastStats
        if (stats)
          gpu.push({
            label: 'Regions',
            value: `${stats.lowresLoaded} low · ${stats.hiresLoaded} high · ${stats.pending} pending`
          })
      }
      const bootMarks = main ? Object.entries(main.marks) : []
      const shell = performance.getEntriesByName('bs:shell-mounted')[0]
      const boot: PerfRow[] = [
        ...bootMarks.map(([label, t]) => ({ label, value: ms(t) })),
        ...(nav
          ? [
              { label: 'page DOM ready', value: ms(nav.domContentLoadedEventEnd) },
              { label: 'page load', value: ms(nav.loadEventEnd) }
            ]
          : []),
        ...(shell ? [{ label: 'shell mounted', value: ms(shell.startTime) }] : [])
      ]
      setGroups([
        { title: 'Renderer', rows: renderer },
        {
          title: 'Processes',
          rows: main
            ? processRows(main)
            : [{ label: mainError ? 'Main sampler off' : 'Waiting…', value: '' }]
        },
        ...(gpu.length ? [{ title: 'WebGL', rows: gpu }] : []),
        { title: 'Boot', rows: boot }
      ])
    }
    const timer = setInterval(second, 1000)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(timer)
      observer?.disconnect()
    }
  }, [open])
  return groups
}
