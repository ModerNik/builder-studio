// builds/<name>/refs/: the build's reference board. index.json lists the links, notes and images; the images sit
// beside it as <id>.<ext>. Plain files, so the agent reads them like any other part of the build.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { RefsIndexSchema, type Ref, type RefAdd } from '@shared/api'

export const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif']
const MAX_IMAGE = 25 * 1024 * 1024

export function listRefs(dir: string): Ref[] {
  const f = join(dir, 'index.json')
  return existsSync(f) ? RefsIndexSchema.parse(JSON.parse(readFileSync(f, 'utf8'))).refs : []
}

function save(dir: string, refs: Ref[]): void {
  mkdirSync(dir, { recursive: true })
  const f = join(dir, 'index.json')
  writeFileSync(f + '.tmp', JSON.stringify({ refs }, null, 2) + '\n')
  renameSync(f + '.tmp', f) // a crash mid-write never leaves half an index
}

/** Adds one ref and returns it. Images keep only their extension from `name`; links must be http(s). */
export function addRef(dir: string, a: RefAdd, now = new Date()): Ref {
  const refs = listRefs(dir)
  const id = `${now.toISOString().replace(/\D/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`
  const base = { id, added: now.toISOString(), note: a.note.trim() }
  let ref: Ref
  if (a.kind === 'image') {
    const ext = /\.(\w+)$/.exec(a.name)?.[1].toLowerCase() ?? ''
    if (!IMAGE_EXT.includes(ext))
      throw new Error(`not an image: ${a.name} (${IMAGE_EXT.join(', ')})`)
    if (a.data.byteLength > MAX_IMAGE) throw new Error(`${a.name} is over 25 MB`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${id}.${ext}`), a.data)
    ref = { ...base, kind: 'image', file: `${id}.${ext}`, title: a.name }
  } else if (a.kind === 'link') {
    const u = new URL(a.url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:')
      throw new Error(`not a web link: ${a.url}`)
    ref = { ...base, kind: 'link', url: u.toString() }
  } else {
    if (!base.note) throw new Error('an empty note')
    ref = { ...base, kind: 'note' }
  }
  save(dir, [...refs, ref])
  return ref
}

export function setRefNote(dir: string, id: string, note: string): void {
  const refs = listRefs(dir)
  if (!refs.some((r) => r.id === id)) throw new Error(`no ref ${id}`)
  save(
    dir,
    refs.map((r) => (r.id === id ? { ...r, note: note.trim() } : r))
  )
}

/** Drops the ref from the index; its image goes to the Recycle Bin. */
export async function removeRef(
  dir: string,
  id: string,
  trash: (p: string) => Promise<void>
): Promise<void> {
  const refs = listRefs(dir)
  const r = refs.find((r) => r.id === id)
  if (!r) throw new Error(`no ref ${id}`)
  if (r.file && existsSync(join(dir, r.file))) await trash(join(dir, r.file))
  save(
    dir,
    refs.filter((x) => x.id !== id)
  )
}

/** A file the user attached to an agent message, kept in builds/<name>/attachments/; returns its file name. */
export function addAttachment(dir: string, name: string, data: Uint8Array, now = new Date()): string {
  if (data.byteLength > MAX_IMAGE) throw new Error(`${name} is over 25 MB`)
  const safe = name.replace(/[^\w.-]+/g, '_').replace(/^\.+/, '').slice(-80) || 'file'
  const file = `${now.toISOString().replace(/\D/g, '').slice(0, 14)}-${safe}`
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), data)
  return file
}

/** Attachment paths split into images the model sees inline and other files it is told to Read. */
export function splitAttachments(paths: string[]): { images: string[]; files: string[] } {
  const image = (p: string): boolean => IMAGE_EXT.includes(/\.(\w+)$/.exec(p)?.[1].toLowerCase() ?? '')
  return { images: paths.filter(image), files: paths.filter((p) => !image(p)) }
}

export const filesText = (files: string[]): string =>
  files.length ? `\n\nAttached files (Read them):\n${files.map((f) => `- ${f}`).join('\n')}` : ''

export const imageType = (p: string): string => {
  const ext = /\.(\w+)$/.exec(p)?.[1].toLowerCase()
  return `image/${ext === 'jpg' ? 'jpeg' : ext}`
}
