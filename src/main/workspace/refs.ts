// builds/<name>/refs/: the build's reference board. index.json lists the links, notes and images; the images sit
// beside it as <id>.<ext>. Plain files, so the agent reads them like any other part of the build.
import { randomBytes } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { RefsIndexSchema, type Ref, type RefAdd, type RefUpdate } from '@shared/api'
import { writeAtomic } from './paths'

export const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif']
const MAX_IMAGE = 25 * 1024 * 1024

function readStoredRefs(dir: string): Ref[] {
  const f = join(dir, 'index.json')
  if (!existsSync(f)) return []
  return RefsIndexSchema.parse(JSON.parse(readFileSync(f, 'utf8'))).refs
}

export function listRefs(dir: string): Ref[] {
  return readStoredRefs(dir).map((r) => {
    if (r.kind !== 'image') return r
    const missing = !r.file || !existsSync(join(dir, r.file))
    return missing ? { ...r, missing: true } : r
  })
}

function save(dir: string, refs: Ref[]): void {
  mkdirSync(dir, { recursive: true })
  const f = join(dir, 'index.json')
  const stored = refs.map((r) => {
    const clean = { ...r }
    delete clean.missing
    return clean
  })
  writeAtomic(f, JSON.stringify({ refs: stored }, null, 2) + '\n')
}

function parseWebUrl(raw: string): string {
  const u = new URL(raw.trim())
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error(`not a web link: ${raw}`)
  return u.toString()
}

/** Adds one ref and returns it. Images keep only their extension from `name`; links must be http(s). */
export function addRef(dir: string, a: RefAdd, now = new Date()): Ref {
  const refs = readStoredRefs(dir)
  const id = `${now.toISOString().replace(/\D/g, '').slice(0, 14)}-${randomBytes(4).toString('hex')}`
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
    ref = { ...base, kind: 'link', url: parseWebUrl(a.url) }
  } else {
    if (!base.note) throw new Error('an empty note')
    ref = { ...base, kind: 'note' }
  }
  save(dir, [...refs, ref])
  return ref
}

/** Updates a saved ref's note, link URL, or title; refuses blank notes on note-kind refs. */
export function updateRef(dir: string, id: string, patch: RefUpdate): Ref {
  const refs = readStoredRefs(dir)
  const current = refs.find((r) => r.id === id)
  if (!current) throw new Error(`no ref ${id}`)
  const next: Ref = { ...current }
  if (patch.note !== undefined) {
    const trimmed = patch.note.trim()
    if (current.kind === 'note' && !trimmed) throw new Error('a note cannot be empty')
    next.note = trimmed
  }
  if (patch.url !== undefined && current.kind === 'link') {
    next.url = parseWebUrl(patch.url)
  }
  if (patch.title !== undefined && current.kind === 'image') {
    const trimmed = patch.title.trim()
    if (trimmed) next.title = trimmed
  }
  save(
    dir,
    refs.map((r) => (r.id === id ? next : r))
  )
  return next.kind === 'image' && (!next.file || !existsSync(join(dir, next.file)))
    ? { ...next, missing: true }
    : next
}

export function setRefNote(dir: string, id: string, note: string): void {
  updateRef(dir, id, { note })
}

/** Drops the ref from the index; its image goes to the Recycle Bin. */
export async function removeRef(
  dir: string,
  id: string,
  trash: (p: string) => Promise<void>
): Promise<void> {
  const refs = readStoredRefs(dir)
  const r = refs.find((r) => r.id === id)
  if (!r) throw new Error(`no ref ${id}`)
  if (r.file && existsSync(join(dir, r.file))) await trash(join(dir, r.file))
  save(
    dir,
    refs.filter((x) => x.id !== id)
  )
}

/** A file the user attached to an agent message, kept in builds/<name>/attachments/; returns its file name. */
export function addAttachment(
  dir: string,
  name: string,
  data: Uint8Array,
  now = new Date()
): string {
  if (data.byteLength > MAX_IMAGE) throw new Error(`${name} is over 25 MB`)
  const safe =
    name
      .replace(/[^\w.-]+/g, '_')
      .replace(/^\.+/, '')
      .slice(-80) || 'file'
  const file = `${now.toISOString().replace(/\D/g, '').slice(0, 14)}-${safe}`
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), data)
  return file
}

/** Attachment paths split into images the model sees inline and other files it is told to Read. */
export function splitAttachments(paths: string[]): { images: string[]; files: string[] } {
  const image = (p: string): boolean =>
    IMAGE_EXT.includes(/\.(\w+)$/.exec(p)?.[1].toLowerCase() ?? '')
  return { images: paths.filter(image), files: paths.filter((p) => !image(p)) }
}

export const filesText = (files: string[]): string =>
  files.length ? `\n\nAttached files (Read them):\n${files.map((f) => `- ${f}`).join('\n')}` : ''

export const imageType = (p: string): string => {
  const ext = /\.(\w+)$/.exec(p)?.[1].toLowerCase()
  return `image/${ext === 'jpg' ? 'jpeg' : ext}`
}
