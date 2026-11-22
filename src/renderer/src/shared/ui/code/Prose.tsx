import { memo, type ReactElement } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/shared/lib/utils'
import { Link } from '@/shared/ui/primitives/link'
import '@/shared/ui/common/composites.css'

const GFM = [remarkGfm]
const VARIANT = { docs: 'prose-docs', chat: 'prose-chat', log: 'prose-log' } as const

// The window blocks navigation away from the app, so a plain link does nothing: web links open in the
// browser (target _blank reaches the main process's window-open handler), anything else stays put.
const LINKS: Components = {
  a: ({ href = '', children }) =>
    /^https?:/i.test(href) ? (
      <Link href={href} external>
        {children}
      </Link>
    ) : (
      <Link href={href} onClick={(e) => e.preventDefault()}>
        {children}
      </Link>
    )
}

/**
 * Markdown in the kit's prose styles. docs: DESIGN.md and help pages; chat: assistant replies and plans;
 * log: design-log rounds and other dense notes. Memoised, so a streaming transcript only re-parses the
 * message that changed.
 */
export const Prose = memo(function Prose({
  children,
  variant = 'chat',
  components,
  className
}: {
  children: string
  variant?: keyof typeof VARIANT
  components?: Components
  className?: string
}): ReactElement {
  return (
    <div className={cn('prose', VARIANT[variant], className)}>
      <Markdown remarkPlugins={GFM} components={components ? { ...LINKS, ...components } : LINKS}>
        {children}
      </Markdown>
    </div>
  )
})
