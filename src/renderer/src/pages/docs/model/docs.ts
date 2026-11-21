// ../content/*.md, bundled at build time for Settings → Advanced → Documentation (ui/Docs.tsx). The index is in the
// app's first chunk, for the page list; the other pages' text loads when the Docs page opens (loadDocs).
import index from '../content/README.md?raw'

const files = import.meta.glob<string>(['../content/*.md', '!../content/README.md'], {
  query: '?raw',
  import: 'default'
})
const names = Object.keys(files).map((path) => path.slice(path.lastIndexOf('/') + 1))

export const INDEX = 'README.md'

/** The index first, then pages in the order the index links them, then any it doesn't link. */
export const PAGES = [
  ...new Set([
    INDEX,
    ...[...index.matchAll(/\]\(([\w.-]+\.md)\)/g)].map((m) => m[1]),
    ...[...names].sort()
  ])
].filter((page) => page === INDEX || names.includes(page))

/** Every page's Markdown by file name: the /docs route's loader, so the page renders with all of it. */
export const loadDocs = async (): Promise<Record<string, string>> => {
  const pages = await Promise.all(Object.values(files).map((load) => load()))
  return { [INDEX]: index, ...Object.fromEntries(names.map((name, i) => [name, pages[i]])) }
}

export const docTitle = (docs: Record<string, string>, page: string): string =>
  /^# (.+)$/m.exec(docs[page] ?? '')?.[1] ?? page

/** GitHub's heading anchor, so `page.md#anchor` links work the same here and on GitHub. */
export const slug = (heading: string): string =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\- ]/g, '')
    .replace(/ /g, '-')

/** A page's h2–h4 for "On this page", with the ids the rendered headings get; code blocks are skipped. */
export const outline = (md: string): { id: string; title: string; level: 2 | 3 | 4 }[] =>
  [...md.replace(/```[\s\S]*?```/g, '').matchAll(/^(#{2,4}) (.+)$/gm)].map((m) => {
    const title = m[2].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '')
    return { id: slug(title), title, level: m[1].length as 2 | 3 | 4 }
  })
