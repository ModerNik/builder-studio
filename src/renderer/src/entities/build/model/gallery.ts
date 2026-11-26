// The Gallery's data rules: a build's state, its meta line, and the filter and sort over the list.
import { create } from 'zustand'
import type { BuildSummary } from '@shared/api'

export type BuildState = 'running' | 'review' | 'progress' | 'exported'
export type Sort = 'changed' | 'name' | 'status'
export const STATE_LABEL: Record<BuildState, string> = {
  running: 'Running',
  review: 'Waiting for review',
  progress: 'In progress',
  exported: 'Exported'
}
const ORDER: Record<BuildState, number> = { running: 0, review: 1, progress: 2, exported: 3 }

/** The newest version's stem when Export shipped it; a newer draft makes the build in progress again. */
export const exportedVersion = (b: BuildSummary): string | null => {
  const newest = b.versions[0]?.path
    .split('/')
    .pop()
    ?.replace(/\.litematic$/, '')
  return newest && b.shipped.includes(newest) ? newest : null
}

/** Running beats waiting for review: a job writing the build is the newest news. */
export function buildState(
  b: BuildSummary,
  running: Set<string>,
  reviews: Set<string>
): BuildState {
  return running.has(b.name)
    ? 'running'
    : reviews.has(b.name)
      ? 'review'
      : exportedVersion(b)
        ? 'exported'
        : 'progress'
}

/** "3 min ago", "2 h ago", "4 days ago"; `now` and `ms` in milliseconds. */
export function ago(ms: number, now = Date.now()): string {
  const s = Math.max(0, (now - ms) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

/** "Review 4 · 3 versions · 12 min ago", or "Review 4 · Exported v3 · 12 min ago". */
export function buildMeta(b: BuildSummary, now = Date.now()): string {
  const round = b.rounds.at(-1)
  const n = b.versions.length
  const shipped = exportedVersion(b)
  return [
    round ? `Review ${round.n}` : 'No reviews yet',
    shipped
      ? `Exported ${shipped}`
      : n
        ? `${n} ${n === 1 ? 'version' : 'versions'}`
        : 'No versions yet',
    b.mtime ? ago(b.mtime, now) : null
  ]
    .filter(Boolean)
    .join(' · ')
}

export function shownBuilds(
  builds: BuildSummary[],
  {
    query,
    state,
    sort,
    stateOf
  }: {
    query: string
    state: BuildState | 'all'
    sort: Sort
    stateOf: (b: BuildSummary) => BuildState
  }
): BuildSummary[] {
  const q = query.trim().toLowerCase()
  const label = (b: BuildSummary): string => b.displayName || b.name
  const list = builds.filter(
    (b) =>
      (label(b).toLowerCase().includes(q) || b.name.toLowerCase().includes(q)) &&
      (state === 'all' || stateOf(b) === state)
  )
  const byName = (a: BuildSummary, b: BuildSummary): number =>
    label(a).localeCompare(label(b)) || a.name.localeCompare(b.name)
  return list.sort(
    sort === 'name'
      ? byName
      : sort === 'status'
        ? (a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)] || byName(a, b)
        : (a, b) => b.mtime - a.mtime || byName(a, b)
  )
}

/** Gallery dialogs the command palette can open from any page. */
export const useGalleryDialog = create<{ open: 'new' | 'import' | null }>(() => ({ open: null }))
