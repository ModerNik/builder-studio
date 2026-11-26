import { expect, test, vi } from 'vitest'
import {
  asLink,
  classifyDrag,
  dropped,
  formatLinkDisplay,
  formatShortDate,
  matchesRefQuery,
  parseUriList,
  refImages,
  refsText,
  useChatRefs
} from './refs'
vi.mock('@/shared/api/studio', () => ({ studio: {}, queryClient: {} }))

test('attached refs become a block the agent can follow', () => {
  expect(refsText('gate', [])).toBe('')
  const t = refsText('gate', [
    { id: 'a', kind: 'image', added: '', note: 'arch', file: 'a.png' },
    { id: 'b', kind: 'link', added: '', note: '', url: 'https://x.org/p' },
    { id: 'c', kind: 'note', added: '', note: 'no glass' }
  ])
  expect(t.split('\n').slice(1)).toEqual([
    '- image builds/gate/refs/a.png: arch',
    '- link https://x.org/p',
    '- note: no glass'
  ])
})

test('only a lone http(s) url counts as a link; uri-list skips RFC 2483 comments', () => {
  expect(asLink(' https://a.b/c \n')).toBe('https://a.b/c')
  expect(asLink('see https://a.b')).toBeNull()
  expect(asLink('# Heading\nhttps://a.b')).toBeNull()
  expect(asLink('javascript:alert(1)')).toBeNull()
  expect(parseUriList('# Pinterest pin\r\nhttps://example.com/pin/42\r\n')).toBe(
    'https://example.com/pin/42'
  )
  expect(parseUriList('# only a comment\n')).toBeNull()
})

test('disambiguates duplicate pasted filenames and handles uri-list drops', async () => {
  const png1 = new File([new Uint8Array([1])], 'image.png', { type: 'image/png' })
  const png2 = new File([new Uint8Array([2])], 'image.png', { type: 'image/png' })
  const txt = new File(['x'], 'a.txt', { type: 'text/plain' })
  const images = await refImages([png1, png2, txt], 7)
  expect(images).toHaveLength(2)
  expect(images[0]).toMatchObject({ kind: 'image', name: 'pasted-7.png' })
  expect(images[1]).toMatchObject({ kind: 'image', name: 'pasted-7-2.png' })

  expect(await dropped([txt], '', '# title\nhttps://a.b/c')).toEqual([
    { kind: 'link', url: 'https://a.b/c', note: '' }
  ])
  expect(await dropped([], 'hello')).toEqual([])
})

test('classifies drag payloads without mislabeling non-image files as links', () => {
  expect(classifyDrag({ items: [{ kind: 'file', type: 'image/png' }], types: ['Files'] })).toEqual({
    kind: 'images',
    count: 1
  })
  expect(
    classifyDrag({ items: [{ kind: 'file', type: 'application/pdf' }], types: ['Files'] })
  ).toEqual({ kind: 'unsupported', count: 1 })
  expect(classifyDrag({ items: [], types: ['text/uri-list'] })).toEqual({
    kind: 'link',
    count: 0
  })
  expect(classifyDrag({ items: [], types: [] })).toBeNull()
})

test('formats links, dates, queries, and syncs chat ref selections per build', () => {
  expect(formatLinkDisplay('https://www.planetminecraft.com/project/castle-keep/')).toEqual({
    host: 'planetminecraft.com',
    path: '/project/castle-keep'
  })
  expect(formatShortDate('2026-11-05T12:00:00Z', new Date(2026, 10, 20))).toBe('Nov 5')
  expect(formatShortDate('2025-11-05T12:00:00Z', new Date(2026, 10, 20))).toBe('Nov 5, 2025')
  expect(
    matchesRefQuery(
      { id: '1', kind: 'link', added: '', note: 'copper roof', url: 'https://x.org/roof' },
      'COPPER'
    )
  ).toBe(true)

  useChatRefs.getState().clear('castle')
  useChatRefs.getState().toggle('castle', 'a')
  useChatRefs.getState().toggle('castle', 'b')
  expect(useChatRefs.getState().byBuild.castle).toEqual(['a', 'b'])
  useChatRefs.getState().remove('castle', 'a')
  expect(useChatRefs.getState().byBuild.castle).toEqual(['b'])
  useChatRefs.getState().clear('castle')
  expect(useChatRefs.getState().byBuild.castle).toBeUndefined()
})
