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

/** Compact relative timestamp for chat messages ("just now", "5m ago", "2h ago", "3d ago", or short date). */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (diffSec < 45) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  const d = new Date(timestamp)
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' })
  }).format(d)
}

/** Full local date and time for timestamp hover tooltips, e.g. "Nov 27, 2026, 2:45 PM". */
export function formatFullDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(timestamp))
}

/** Ticking relative timestamp string (updates every 30s). */
export function useRelativeTime(timestamp: number | undefined): string | null {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (timestamp === undefined) return
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [timestamp])
  return timestamp === undefined ? null : formatRelativeTime(timestamp, now)
}
