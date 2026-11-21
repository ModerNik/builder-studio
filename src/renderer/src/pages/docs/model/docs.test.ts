import { describe, expect, it } from 'vitest'
import { INDEX, PAGES, docTitle, loadDocs, outline, slug } from './docs'

const DOCS = await loadDocs()

const anchors = (md: string): string[] =>
  [...md.replace(/```[\s\S]*?```/g, '').matchAll(/^#{1,6} (.+)$/gm)].map((m) =>
    slug(m[1].replace(/[`*]/g, ''))
  )

describe('docs', () => {
  it('lists the index first and every page once', () => {
    expect(PAGES[0]).toBe(INDEX)
    expect([...PAGES].sort()).toEqual(Object.keys(DOCS).sort())
    expect(docTitle(DOCS, INDEX)).toBe('Builder Studio documentation')
  })

  it('outlines h2 to h4 outside code blocks, with plain titles', () => {
    const md = [
      '# Page',
      '## Set [up](a.md) `git`',
      '```',
      '## not a heading',
      '```',
      '#### Deep',
      '##### Too deep'
    ].join('\n')
    expect(outline(md)).toEqual([
      { id: 'set-up-git', title: 'Set up git', level: 2 },
      { id: 'deep', title: 'Deep', level: 4 }
    ])
  })
  it('makes GitHub heading anchors', () => {
    expect(slug('Review, design log and export')).toBe('review-design-log-and-export')
    expect(slug('External agents (MCP)')).toBe('external-agents-mcp')
    expect(slug('settings.json')).toBe('settingsjson')
  })

  it('links only to pages and headings that exist', () => {
    for (const [page, md] of Object.entries(DOCS))
      for (const [, href] of md.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^[a-z]+:/i.test(href)) continue
        const [file, at] = href.split('#')
        const target = file || page
        expect(DOCS[target], `${page} → ${href}`).toBeDefined()
        if (at) expect(anchors(DOCS[target]), `${page} → ${href}`).toContain(at)
      }
  })
})
