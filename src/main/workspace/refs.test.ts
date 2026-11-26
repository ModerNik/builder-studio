import { existsSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { expect, it } from 'vitest'
import {
  addAttachment,
  addRef,
  listRefs,
  removeRef,
  setRefNote,
  splitAttachments,
  updateRef
} from './refs'

it('keeps links, notes and images in refs/index.json, images beside it', async () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'studio-refs-')), 'refs')
  expect(listRefs(dir)).toEqual([])
  const img = addRef(dir, {
    kind: 'image',
    name: 'Screenshot 1.PNG',
    data: new Uint8Array([1, 2, 3]),
    note: ' gate '
  })
  expect(img).toMatchObject({
    kind: 'image',
    file: `${img.id}.png`,
    title: 'Screenshot 1.PNG',
    note: 'gate'
  })
  expect([...readFileSync(join(dir, img.file!))]).toEqual([1, 2, 3])
  const link = addRef(dir, { kind: 'link', url: 'https://example.com/a b', note: '' })
  const note = addRef(dir, { kind: 'note', note: 'darker roofs' })
  expect(listRefs(dir).map((r) => r.url ?? r.note)).toEqual([
    'gate',
    'https://example.com/a%20b',
    'darker roofs'
  ])

  expect(() =>
    addRef(dir, { kind: 'image', name: 'x.exe', data: new Uint8Array(), note: '' })
  ).toThrow(/not an image/)
  expect(() => addRef(dir, { kind: 'link', url: 'file:///c:/x', note: '' })).toThrow(
    /not a web link/
  )
  expect(() => addRef(dir, { kind: 'note', note: '  ' })).toThrow(/empty/)

  setRefNote(dir, img.id, 'north gate')
  expect(listRefs(dir)[0].note).toBe('north gate')

  // updateRef updates link URL + note and refuses empty note-kind updates or bad URLs
  const updatedLink = updateRef(dir, link.id, {
    url: 'https://minecraft.wiki/w/Castle',
    note: 'tower silhouette'
  })
  expect(updatedLink.url).toBe('https://minecraft.wiki/w/Castle')
  expect(updatedLink.note).toBe('tower silhouette')
  expect(() => updateRef(dir, link.id, { url: 'javascript:alert(1)' })).toThrow(/not a web link/)
  expect(() => updateRef(dir, note.id, { note: '   ' })).toThrow(/cannot be empty/)

  // removing the image file on disk flags it as missing without writing `missing` into index.json
  unlinkSync(join(dir, img.file!))
  expect(listRefs(dir).find((r) => r.id === img.id)?.missing).toBe(true)
  setRefNote(dir, img.id, 'still annotated')
  expect(JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')).refs[0]).not.toHaveProperty(
    'missing'
  )

  const trashed: string[] = []
  await removeRef(dir, img.id, async (p) => void trashed.push(p))
  expect(trashed).toEqual([]) // already gone on disk
  expect(listRefs(dir)).toHaveLength(2)

  // an index edited to point outside refs/ is refused, not followed
  writeFileSync(
    join(dir, 'index.json'),
    JSON.stringify({ refs: [{ id: 'x', kind: 'image', added: '', note: '', file: '../../a.png' }] })
  )
  expect(() => listRefs(dir)).toThrow()
  expect(existsSync(join(dir, 'index.json'))).toBe(true)
})

it('stores any attachment under a stamped, safe name and caps it at 25 MB', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'studio-attach-')), 'attachments')
  const now = new Date('2026-11-01T12:34:56Z')
  const file = addAttachment(dir, '../My plan (v2).txt', new Uint8Array([7]), now)
  expect(file).toBe('20261101123456-_My_plan_v2_.txt')
  expect([...readFileSync(join(dir, file))]).toEqual([7])
  expect(addAttachment(dir, '...', new Uint8Array(), now)).toBe('20261101123456-file')
  expect(() => addAttachment(dir, 'big.png', new Uint8Array(25 * 1024 * 1024 + 1), now)).toThrow(
    /over 25 MB/
  )
})

it('splits attachments into inline images and files to Read', () => {
  expect(
    splitAttachments(['builds/a/attachments/1-shot.PNG', 'builds/a/attachments/2-notes.txt', 'x'])
  ).toEqual({
    images: ['builds/a/attachments/1-shot.PNG'],
    files: ['builds/a/attachments/2-notes.txt', 'x']
  })
})
