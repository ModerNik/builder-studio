// Window caption buttons (Minimize, Maximize / Restore, Close) rendered in DOM inside the title bar
// so modals, scrims, dropdowns and tooltips always layer above them.
import type { ReactElement } from 'react'
import { cn } from '@/shared/lib/utils'
import { Tip } from '@/shared/ui/common/Tip'

const captionButton = cn(
  'inline-flex h-full w-[46px] shrink-0 items-center justify-center bg-transparent text-fg transition-colors duration-fast ease-standard',
  'outline-none focus-visible:outline-(length:--focus-width) focus-visible:-outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid'
)
const neutralButton = cn(captionButton, 'can-hover:bg-surface-hover can-press:bg-surface-active')
const closeButton = cn(
  captionButton,
  'can-hover:bg-danger-solid can-hover:text-danger-on-solid can-press:bg-danger-solid-hover can-press:text-danger-on-solid'
)

function MinimizeGlyph(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      className="size-2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <path d="M0 5h10" />
    </svg>
  )
}

function MaximizeGlyph(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      className="size-2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="0.5" y="0.5" width="9" height="9" />
    </svg>
  )
}

function RestoreGlyph(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      className="size-2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="0.5" y="2.5" width="7" height="7" />
      <path d="M2.5 2.5V0.5h7v7H7.5" />
    </svg>
  )
}

function CloseGlyph(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      className="size-2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
    </svg>
  )
}

export function WindowControls({
  maximized,
  onMinimize,
  onToggleMaximize,
  onClose,
  decorative = false,
  className
}: {
  maximized: boolean
  onMinimize?: () => void
  onToggleMaximize?: () => void
  onClose?: () => void
  /** Decorative preview inside scaled kit frames: keeps the exact appearance without tab stops. */
  decorative?: boolean
  className?: string
}): ReactElement {
  const maximizeLabel = maximized ? 'Restore' : 'Maximize'
  const maximizeIcon = maximized ? <RestoreGlyph /> : <MaximizeGlyph />

  if (decorative) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          'workbench-window-controls flex h-full shrink-0 items-stretch text-fg-muted',
          className
        )}
      >
        <span className="inline-flex h-full w-[46px] shrink-0 items-center justify-center">
          <MinimizeGlyph />
        </span>
        <span className="inline-flex h-full w-[46px] shrink-0 items-center justify-center">
          {maximizeIcon}
        </span>
        <span className="inline-flex h-full w-[46px] shrink-0 items-center justify-center">
          <CloseGlyph />
        </span>
      </div>
    )
  }

  return (
    <div
      role="group"
      aria-label="Window controls"
      className={cn('workbench-window-controls flex h-full shrink-0 items-stretch', className)}
    >
      <Tip label="Minimize">
        <button type="button" aria-label="Minimize" onClick={onMinimize} className={neutralButton}>
          <MinimizeGlyph />
        </button>
      </Tip>
      <Tip label={maximizeLabel}>
        <button
          type="button"
          aria-label={maximizeLabel}
          onClick={onToggleMaximize}
          className={neutralButton}
        >
          {maximizeIcon}
        </button>
      </Tip>
      <Tip label="Close">
        <button type="button" aria-label="Close" onClick={onClose} className={closeButton}>
          <CloseGlyph />
        </button>
      </Tip>
    </div>
  )
}
