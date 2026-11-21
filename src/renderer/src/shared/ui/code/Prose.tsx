import { memo, type ReactElement } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/shared/lib/utils'
import '@/shared/ui/common/composites.css'

const GFM = [remarkGfm]
const VARIANT = { docs: 'prose-docs', chat: 'prose-chat', log: 'prose-log' } as const

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
      <Markdown remarkPlugins={GFM} components={components}>
        {children}
      </Markdown>
    </div>
  )
})
