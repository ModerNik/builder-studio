import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Prose } from './Prose'

type Props = Parameters<typeof Prose>[0]
const html = (children: string, components?: Props['components']): string => {
  const props: Props = { children, components }
  return renderToStaticMarkup(createElement(Prose, props))
}

test('web links open outside the app, other links stay in place', () => {
  const web = html('[x](https://example.org/a)')
  expect(web).toContain('href="https://example.org/a"')
  expect(web).toContain('target="_blank"')
  const relative = html('[d](builds/gate/DESIGN.md)')
  expect(relative).toContain('href="builds/gate/DESIGN.md"')
  expect(relative).not.toContain('target=')
})

test("a caller's link override wins", () => {
  expect(html('[x](https://example.org)', { a: () => createElement('b', null, 'own') })).toBe(
    '<div class="prose prose-chat"><p><b>own</b></p></div>'
  )
})
