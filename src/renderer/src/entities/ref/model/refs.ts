// Reference board helpers: queries, live chat-attachment sync, drag/paste parsing, and search/formatting.
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { create } from 'zustand'
import type { Ref, RefAdd } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'

export const EMPTY_REF_IDS: readonly string[] = []

/** References queued to go along with the next assistant message, synced between Refs board and Chat. */
export const useChatRefs = create<{
  byBuild: Record<string, string[]>
  toggle: (build: string, id: string) => void
  set: (build: string, ids: string[]) => void
  remove: (build: string, id: string) => void
  clear: (build: string) => void
}>((set) => ({
  byBuild: {},
  toggle: (build, id) =>
    set((s) => {
      if (!build) return s
      const cur = s.byBuild[build] ?? []
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      return { byBuild: { ...s.byBuild, [build]: next } }
    }),
  set: (build, ids) => set((s) => (build ? { byBuild: { ...s.byBuild, [build]: ids } } : s)),
  remove: (build, id) =>
    set((s) => {
      const cur = s.byBuild[build]
      if (!cur || !cur.includes(id)) return s
      return { byBuild: { ...s.byBuild, [build]: cur.filter((x) => x !== id) } }
    }),
  clear: (build) =>
    set((s) => {
      if (!build || !(build in s.byBuild)) return s
      const next = { ...s.byBuild }
      delete next[build]
      return { byBuild: next }
    })
}))

export const refPath = (build: string, r: Ref): string => `builds/${build}/refs/${r.file}`

/** A block for the end of a prompt: image paths for the agent to Read, links, notes; '' for none. */
export function refsText(build: string, refs: Ref[]): string {
  if (!refs.length) return ''
  const line = (r: Ref): string => {
    const note = r.note ? `: ${r.note}` : ''
    if (r.kind === 'image') return `- image ${refPath(build, r)}${note}`
    if (r.kind === 'link') return `- link ${r.url}${note}`
    return `- note: ${r.note}`
  }
  return `References from the board (builds/${build}/refs/index.json; Read the images):\n${refs.map(line).join('\n')}`
}

/** A lone http(s) web link from plain text, or null. */
export const asLink = (s: string): string | null => {
  const lines = s
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length !== 1) return null
  return /^https?:\/\/\S+$/.test(lines[0]) ? lines[0] : null
}

/** Extracts the first http(s) URL from an RFC 2483 `text/uri-list` payload (skipping `#` comments). */
export function parseUriList(uriList: string): string | null {
  for (const raw of uriList.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (/^https?:\/\/\S+$/.test(line)) return line
  }
  return null
}

export const useRefs = (build: string): UseQueryResult<Ref[]> =>
  useQuery({ queryKey: ['refs', build], queryFn: () => studio.refs.list(build), enabled: !!build })

export const refreshRefs = (build: string): Promise<void> =>
  queryClient.invalidateQueries({ queryKey: ['refs', build] })

/** Adds each ref in turn; the failures come back as messages, the rest are on the board. */
export async function addRefs(build: string, refs: RefAdd[]): Promise<string[]> {
  const failed: string[] = []
  for (const r of refs)
    await studio.refs.add(build, r).catch((e: unknown) => failed.push(String(e)))
  await refreshRefs(build)
  return failed
}

/** Image files among `files`, disambiguating duplicate names (including multiple pasted screenshots). */
export const refImages = async (files: Iterable<File>, now = Date.now()): Promise<RefAdd[]> => {
  const imgs = [...files].filter((f) => f.type.startsWith('image/'))
  const seen = new Map<string, number>()
  return Promise.all(
    imgs.map(async (f) => {
      const ext = f.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
      const base = f.name && f.name !== 'image.png' ? f.name : `pasted-${now}.${ext}`
      const count = (seen.get(base) ?? 0) + 1
      seen.set(base, count)
      const name = count === 1 ? base : base.replace(/(\.[^.]+)$/, `-${count}$1`)
      return {
        kind: 'image' as const,
        name,
        data: new Uint8Array(await f.arrayBuffer()),
        note: ''
      }
    })
  )
}

/** What a drop or paste adds: its images, else a web link (from uri-list or plain text), else nothing. */
export async function dropped(
  files: Iterable<File>,
  text: string,
  uriList = ''
): Promise<RefAdd[]> {
  const images = await refImages(files)
  if (images.length) return images
  const link = parseUriList(uriList) ?? asLink(text)
  return link ? [{ kind: 'link', url: link, note: '' }] : []
}

export type DragKind =
  | { kind: 'images'; count: number }
  | { kind: 'link'; count: 0 }
  | { kind: 'unsupported'; count: number }
  | null

/** Classifies a drag-over DataTransfer so the overlay never mislabels non-image files as a link. */
export function classifyDrag(dt: {
  items: Iterable<{ kind: string; type: string }>
  types: readonly string[]
}): DragKind {
  const items = [...dt.items]
  const files = items.filter((i) => i.kind === 'file')
  if (files.length > 0) {
    const images = files.filter((i) => i.type.startsWith('image/') || i.type === '')
    return images.length > 0
      ? { kind: 'images', count: images.length }
      : { kind: 'unsupported', count: files.length }
  }
  if (dt.types.includes('text/uri-list') || dt.types.includes('text/plain')) {
    return { kind: 'link', count: 0 }
  }
  return null
}

/** Clean hostname and readable path for a link card. */
export function formatLinkDisplay(url: string): { host: string; path: string } {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./i, '')
    const rawPath = decodeURIComponent(u.pathname + u.search).replace(/\/$/, '')
    return { host, path: rawPath === '/' ? '' : rawPath }
  } catch {
    return { host: url.replace(/^https?:\/\//i, ''), path: '' }
  }
}

/** Compact date label, e.g. "Nov 5" (or "Nov 5, 2025" for earlier years). */
export function formatShortDate(iso: string, now = new Date()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso.slice(0, 10)
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' })
  })
}

/** Whether a ref matches a free-text filter query. */
export function matchesRefQuery(r: Ref, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [r.note, r.title, r.url, r.file].some((v) => v?.toLowerCase().includes(q))
}
