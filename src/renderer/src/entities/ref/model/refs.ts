// Reference board helpers: the board's query and adds, and what a message to the agent says about the refs
// attached to it.
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { Ref, RefAdd } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'

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

/** A dropped or pasted text: a web link, or null. */
export const asLink = (s: string): string | null => {
  const t = s.trim().split(/\r?\n/)[0]
  return /^https?:\/\/\S+$/.test(t) ? t : null
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

/** The image files among these, as refs to add; a pasted screenshot (image.png) gets a findable name. */
export const refImages = async (files: Iterable<File>, now = Date.now()): Promise<RefAdd[]> =>
  Promise.all(
    [...files]
      .filter((f) => f.type.startsWith('image/'))
      .map(async (f) => ({
        kind: 'image' as const,
        name:
          f.name && f.name !== 'image.png'
            ? f.name
            : `pasted-${now}.${f.type.split('/')[1] || 'png'}`,
        data: new Uint8Array(await f.arrayBuffer()),
        note: ''
      }))
  )

/** What a drop or paste adds: its images, else a lone link, else nothing. */
export async function dropped(files: Iterable<File>, text: string): Promise<RefAdd[]> {
  const images = await refImages(files)
  if (images.length) return images
  const link = asLink(text)
  return link ? [{ kind: 'link', url: link, note: '' }] : []
}
