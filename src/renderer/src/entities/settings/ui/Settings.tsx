// The settings page's building blocks: a section with its title and lead, a panel of rows, a row, and a
// copyable snippet for commands and config the user pastes elsewhere.
import type { ReactElement, ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { CopyButton } from '@/shared/ui/common/CopyButton'

export function SettingsSection({
  id,
  title,
  lead,
  children,
  className
}: {
  id: string
  title: string
  lead?: ReactNode
  children: ReactNode
  className?: string
}): ReactElement {
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-4', className)}>
      <header className="flex flex-col gap-1">
        <h2 id={id} className="scroll-mt-6 text-xl text-fg">
          {title}
        </h2>
        {lead && <p className="max-w-prose text-pretty text-fg-secondary">{lead}</p>}
      </header>
      {children}
    </section>
  )
}

/** Rows on a raised panel, divided by hairlines; rows stack label over control when it is narrow. */
export function SettingsPanel({
  title,
  children,
  className
}: {
  /** A small heading above the panel, for a group of rows. */
  title?: string
  children: ReactNode
  className?: string
}): ReactElement {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {title && <h3 className="text-sm font-medium text-fg-secondary">{title}</h3>}
      <div className="@container divide-y divide-border-subtle rounded-lg border border-border-default bg-surface-raised">
        {children}
      </div>
    </div>
  )
}

/** One setting: what it is and why it matters on the left, its control on the right (below when narrow). */
export function SettingsRow({
  title,
  detail,
  mono = false,
  htmlFor,
  children,
  below,
  disabled = false
}: {
  title: ReactNode
  detail?: ReactNode
  /** The detail is a path or value: mono and broken anywhere. */
  mono?: boolean
  /** The control's id, so clicking the title focuses it. */
  htmlFor?: string
  children?: ReactNode
  /** Full-width content under the row: an error, a snippet. */
  below?: ReactNode
  disabled?: boolean
}): ReactElement {
  const Title = htmlFor ? 'label' : 'span'
  return (
    <div className={cn('flex flex-col gap-3 p-4', disabled && 'text-fg-disabled')}>
      <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center @lg:gap-6">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <Title
            htmlFor={htmlFor}
            className={cn('font-medium wrap-anywhere', disabled ? 'text-fg-disabled' : 'text-fg')}
          >
            {title}
          </Title>
          {detail && (
            <span
              className={cn(
                disabled ? 'text-fg-disabled' : 'text-fg-secondary',
                mono ? 'font-mono text-sm wrap-anywhere select-text' : 'text-pretty wrap-anywhere'
              )}
            >
              {detail}
            </span>
          )}
        </span>
        {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
      </div>
      {below}
    </div>
  )
}

/** A command or config to paste elsewhere, with its copy button. */
export function CopySnippet({
  code,
  label,
  className
}: {
  code: string
  /** What it is, for the copy button and screen readers: "MCP command". */
  label: string
  className?: string
}): ReactElement {
  const multi = code.includes('\n')
  return (
    <div
      className={cn(
        'relative flex min-w-0 rounded-md border border-border-subtle bg-surface-sunken',
        multi ? 'items-start' : 'items-center',
        className
      )}
    >
      <pre
        aria-label={label}
        tabIndex={0}
        className={cn(
          'min-w-0 flex-1 overflow-x-auto px-3 py-2 font-mono text-sm text-fg select-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
          multi ? 'max-h-60' : 'whitespace-pre'
        )}
      >
        {code}
      </pre>
      <CopyButton
        text={code}
        label={`Copy ${label.charAt(0).toLowerCase()}${label.slice(1)}`}
        size="xs"
        className="m-1"
      />
    </div>
  )
}
