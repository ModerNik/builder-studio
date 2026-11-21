import { useEffect, useState } from 'react'

/** Seconds as "42s", "3m 05s" or "1h 02m". */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`
}

/** Whole seconds since `startedAt` (ms), ticking each second while `live`. */
export function useElapsed(startedAt: number | undefined, live = true): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!live || startedAt === undefined) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [live, startedAt])
  return startedAt === undefined ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000))
}
