// Documentation: the bundled pages/docs/content/*.md in a page list and a rendered article, with "On this page" from 1280px.
// Links between pages stay in the viewer; web links open in the browser (main's window open handler).
// Anchor jumps scroll the article pane only, never the window.
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'
import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import type { Components } from 'react-markdown'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Link } from '@/shared/ui/primitives/link'
import { Prose } from '@/shared/ui/code/Prose'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { PageHeader } from '@/shared/ui/layout/PageHeader'
import { PageOutline } from '@/shared/ui/layout/PageOutline'
import { SideNavLayout } from '@/shared/ui/layout/SideNavLayout'
import { jumpToHeading, useHeadingInView } from '@/shared/ui/layout/outline'
import { INDEX, PAGES, docTitle, outline, slug } from '@/pages/docs/model/docs'
import { text } from '@/shared/lib/format'

function heading(Tag: 'h1' | 'h2' | 'h3' | 'h4') {
  return function Heading({ children }: { children?: ReactNode }): ReactElement {
    return (
      <Tag id={slug(text(children))} className="scroll-mt-4">
        {children}
      </Tag>
    )
  }
}

export function Docs(): ReactElement {
  const { page = INDEX, at } = useSearch({ from: '/docs' })
  const docs = useLoaderData({ from: '/docs' })
  const navigate = useNavigate()
  const article = useRef<HTMLDivElement>(null)
  const md = docs[page]
  const items = md ? outline(md) : []
  const current = useHeadingInView(
    article,
    items.map((h) => h.id)
  )
  useEffect(() => {
    if (at && document.getElementById(at)) jumpToHeading(at)
    else article.current?.scrollTo(0, 0)
  }, [page, at])

  const go = (href: string): void => {
    const [file, anchor] = href.split('#')
    if (!file || file === page) jumpToHeading(anchor)
    else void navigate({ to: '/docs', search: { page: file, at: anchor } })
  }
  const components: Components = {
    h1: heading('h1'),
    h2: heading('h2'),
    h3: heading('h3'),
    h4: heading('h4'),
    a: ({ href = '', children }) =>
      /^[a-z]+:/i.test(href) ? (
        <Link href={href} external>
          {children}
        </Link>
      ) : (
        <Link
          href={href}
          onClick={(e) => {
            e.preventDefault()
            go(href)
          }}
        >
          {children}
        </Link>
      )
  }

  return (
    <SideNavLayout
      label="Documentation pages"
      items={PAGES.map((p) => ({ id: p, label: p === INDEX ? 'Overview' : docTitle(docs, p) }))}
      value={page}
      onChange={(p) => void navigate({ to: '/docs', search: { page: p }, replace: true })}
      className="h-full px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10"
    >
      <div ref={article} className="h-full overflow-auto pb-12">
        <div className="mx-auto flex max-w-wide gap-10">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <PageHeader
              level={2}
              title="Documentation"
              back={{
                label: 'Back to Settings',
                onClick: () => void navigate({ to: '/settings', search: { section: 'advanced' } })
              }}
            />
            {md ? (
              <Prose variant="docs" components={components}>
                {md}
              </Prose>
            ) : (
              <EmptyState
                icon={FileQuestion}
                size="page"
                title="This page isn’t in the documentation"
                action={
                  <Button
                    variant="outline"
                    onClick={() => void navigate({ to: '/docs', search: {}, replace: true })}
                  >
                    Open the overview
                  </Button>
                }
              />
            )}
          </div>
          <PageOutline
            items={items}
            current={current}
            onJump={jumpToHeading}
            className="sticky top-0 w-56 shrink-0 self-start pt-2 max-xl:hidden"
          />
        </div>
      </div>
    </SideNavLayout>
  )
}
