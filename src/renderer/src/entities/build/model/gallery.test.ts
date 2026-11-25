import { expect, test } from 'vitest'
import type { BuildSummary } from '@shared/api'
import { ago, buildMeta, buildState, shownBuilds, type BuildState } from './gallery'

const b = (
  name: string,
  mtime: number,
  rounds = 0,
  versions = 0,
  shipped: string[] = [],
  displayName = name
): BuildSummary => ({
  name,
  displayName,
  status: [],
  rounds: Array.from({ length: rounds }, (_, i) => ({ n: i + 1, title: '' })),
  versions: Array.from({ length: versions }, (_, i) => ({
    path: `builds/${name}/out/v${versions - i}.litematic`,
    mtime,
    size: 0
  })),
  shipped,
  mtime
})

test('a running job wins over a review request, both over Exported', () => {
  const a = b('a', 1, 0, 2, ['v2'])
  expect(buildState(a, new Set(['a']), new Set(['a']))).toBe('running')
  expect(buildState(a, new Set(), new Set(['a']))).toBe('review')
  expect(buildState(a, new Set(), new Set())).toBe('exported')
  // a newer draft than the shipped one is in progress again
  expect(buildState(b('a', 1, 0, 3, ['v2']), new Set(), new Set())).toBe('progress')
  expect(buildState(b('a', 1), new Set(), new Set())).toBe('progress')
})

test('meta line and relative time', () => {
  const now = 10_000_000
  expect(ago(now - 30_000, now)).toBe('just now')
  expect(ago(now - 5 * 60_000, now)).toBe('5 min ago')
  expect(buildMeta(b('x', now - 2 * 3600_000, 4, 1), now)).toBe('Review 4 · 1 version · 2 h ago')
  expect(buildMeta(b('x', 0), now)).toBe('No reviews yet · No versions yet')
  expect(buildMeta(b('x', 0, 2, 3, ['v3']), now)).toBe('Review 2 · Exported v3')
})

test('filters by name and state, sorts by change, name or state', () => {
  const list = [b('beta', 2), b('alpha', 1), b('gamma', 3)]
  const stateOf = (x: BuildSummary): BuildState => (x.name === 'gamma' ? 'review' : 'progress')
  const opts = { query: '', state: 'all' as const, sort: 'changed' as const, stateOf }
  expect(shownBuilds(list, opts).map((x) => x.name)).toEqual(['gamma', 'beta', 'alpha'])
  expect(shownBuilds(list, { ...opts, sort: 'name' }).map((x) => x.name)).toEqual([
    'alpha',
    'beta',
    'gamma'
  ])
  expect(shownBuilds(list, { ...opts, query: 'ET' }).map((x) => x.name)).toEqual(['beta'])
  expect(shownBuilds(list, { ...opts, state: 'review' }).map((x) => x.name)).toEqual(['gamma'])

  const titled = [
    b('slug_a', 1, 0, 0, [], 'Zebra Tower #2'),
    b('slug_b', 2, 0, 0, [], 'Alpha Castle (v1)')
  ]
  expect(shownBuilds(titled, { ...opts, sort: 'name' }).map((x) => x.name)).toEqual([
    'slug_b',
    'slug_a'
  ])
  expect(shownBuilds(titled, { ...opts, query: 'castle (v1)' }).map((x) => x.name)).toEqual([
    'slug_b'
  ])
  expect(shownBuilds(titled, { ...opts, query: 'slug_a' }).map((x) => x.name)).toEqual(['slug_a'])
})
