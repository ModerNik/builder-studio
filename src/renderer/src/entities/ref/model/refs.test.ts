import { expect, test, vi } from 'vitest'
import { asLink, dropped, refImages, refsText } from './refs'
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

test('only a lone http(s) url counts as a link', () => {
  expect(asLink(' https://a.b/c \n')).toBe('https://a.b/c')
  expect(asLink('see https://a.b')).toBeNull()
  expect(asLink('javascript:alert(1)')).toBeNull()
})

test('a drop adds its images, else a lone link', async () => {
  const png = new File([new Uint8Array([1])], 'image.png', { type: 'image/png' })
  const txt = new File(['x'], 'a.txt', { type: 'text/plain' })
  const [image] = await refImages([png, txt], 7)
  expect(image).toMatchObject({ kind: 'image', name: 'pasted-7.png' })
  expect(await dropped([txt], 'https://a.b/c')).toEqual([
    { kind: 'link', url: 'https://a.b/c', note: '' }
  ])
  expect(await dropped([], 'hello')).toEqual([])
})
