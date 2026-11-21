// A toolbar of groups (one tab stop, arrow keys inside). `wrap` lets groups flow onto more rows; `overflow`
// keeps one row and moves the groups that do not fit, from the end, into a More menu, measured by the
// toolbar's own width so it works the same in a dock, a sheet or a full window.
import { Fragment, useRef, type ComponentProps, type ReactElement, type ReactNode } from 'react'
import { DropdownMenu, Toolbar as RToolbar } from 'radix-ui'
import { Ellipsis } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { remPx, tokenPx, useFit } from '@/shared/lib/layout'
import { chromeButton, menuContent } from '@/shared/ui/common/styles'

export interface ToolbarGroup {
  id: string
  /** Names the group for screen readers and heads it in the More menu. */
  label: string
  content: ReactNode
  /** The group as `DropdownMenu.Item`s, shown in More when the group does not fit. */
  overflow: ReactNode
}

export function ToolbarButton({
  className,
  ...props
}: ComponentProps<typeof RToolbar.Button>): ReactElement {
  return (
    <RToolbar.Button
      className={cn(chromeButton, 'h-(--density-control) px-2.5 text-base', className)}
      {...props}
    />
  )
}

function Groups({ groups }: { groups: ToolbarGroup[] }): ReactElement {
  return (
    <>
      {groups.map((g, i) => (
        <Fragment key={g.id}>
          {i > 0 && <RToolbar.Separator className="mx-1 h-5 w-px shrink-0 bg-border-subtle" />}
          <div role="group" aria-label={g.label} className="flex shrink-0 items-center gap-1">
            {g.content}
          </div>
        </Fragment>
      ))}
    </>
  )
}

export function Toolbar({
  label,
  groups,
  end,
  mode = 'overflow',
  className
}: {
  label: string
  groups: ToolbarGroup[]
  /** Always shown at the far end (e.g. the primary action); never moves into More. */
  end?: ReactNode
  mode?: 'wrap' | 'overflow'
  className?: string
}): ReactElement {
  const box = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  // the More button plus a separator (mx-1 each side, 1px wide)
  const fit =
    useFit(box, measure, {
      moreWidth: tokenPx('--density-icon-button', 36) + 0.5 * remPx() + 1
    }) ?? groups.length
  const shown = mode === 'wrap' ? groups : groups.slice(0, fit)
  const hidden = mode === 'wrap' ? [] : groups.slice(fit)
  return (
    <RToolbar.Root
      aria-label={label}
      className={cn(
        'relative flex min-w-0 items-center gap-2',
        mode === 'wrap' && 'flex-wrap',
        className
      )}
    >
      <div
        ref={box}
        className={cn(
          'flex min-w-0 flex-1 items-center',
          mode === 'wrap' ? 'flex-wrap gap-y-1' : 'overflow-hidden'
        )}
      >
        <Groups groups={shown} />
        {hidden.length > 0 && (
          <>
            <RToolbar.Separator className="mx-1 h-5 w-px shrink-0 bg-border-subtle" />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <RToolbar.Button
                  aria-label={`More: ${hidden.map((g) => g.label).join(', ')}`}
                  className={cn(chromeButton, 'size-(--density-icon-button)')}
                >
                  <Ellipsis aria-hidden="true" />
                </RToolbar.Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={4} className={menuContent}>
                  {hidden.map((g, i) => (
                    <DropdownMenu.Group key={g.id}>
                      {i > 0 && <DropdownMenu.Separator className="my-1 h-px bg-border-subtle" />}
                      <DropdownMenu.Label className="px-2 pt-1.5 pb-1 text-xs text-fg-muted">
                        {g.label}
                      </DropdownMenu.Label>
                      {g.overflow}
                    </DropdownMenu.Group>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </>
        )}
      </div>
      {end && <div className="flex shrink-0 items-center gap-2">{end}</div>}
      {mode === 'overflow' && (
        // an invisible copy of every group, measured to decide how many fit; its own root keeps it out of roving focus,
        // and the clipping wrapper keeps its full width from scrolling the page
        <div className="invisible absolute inset-0 overflow-hidden">
          <RToolbar.Root
            ref={measure}
            aria-hidden="true"
            inert
            className="absolute top-0 left-0 flex w-max items-center"
          >
            {groups.map((g, i) => (
              <div
                key={g.id}
                className={cn(
                  'flex shrink-0 items-center gap-1',
                  i > 0 && 'pl-[calc(var(--spacing)*2+1px)]'
                )}
              >
                {g.content}
              </div>
            ))}
          </RToolbar.Root>
        </div>
      )}
    </RToolbar.Root>
  )
}
