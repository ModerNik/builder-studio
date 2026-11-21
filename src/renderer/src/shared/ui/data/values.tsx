// Small read-outs of exact things: key/value lists, stats, block chips and swatches, coordinates, file paths.
import type { ReactElement, ReactNode } from 'react'
import { FolderOpen } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { CopyButton } from '@/shared/ui/common/CopyButton'
import { IconAction } from '@/shared/ui/common/Tip'
import { splitState } from './blocks'

export type KeyValue = { label: string; value: ReactNode; mono?: boolean; copy?: string }

/** Terms and values as a description list; label and value stack when the container is narrow. */
export function KeyValueList({
  items,
  className
}: {
  items: KeyValue[]
  className?: string
}): ReactElement {
  return (
    <div className={cn('@container', className)}>
      <dl className="grid grid-cols-1 gap-x-4 @xs:grid-cols-[minmax(7rem,max-content)_1fr]">
        {items.map((it) => (
          <div key={it.label} className="contents">
            <dt className="pt-1.5 text-sm text-fg-muted @xs:py-1.5">{it.label}</dt>
            <dd
              className={cn(
                'flex min-w-0 items-center gap-1 pb-1.5 text-fg @xs:py-1.5',
                it.mono && 'font-mono text-sm tabular-nums'
              )}
            >
              <span className="min-w-0 break-words">{it.value}</span>
              {it.copy && (
                <CopyButton text={it.copy} label={`Copy ${it.label.toLowerCase()}`} size="xs" />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** A number and what it counts. Numbers line up (tabular), the unit is quieter than the value. */
export function Stat({
  label,
  value,
  unit,
  detail,
  tone,
  className
}: {
  label: string
  value: number | string
  unit?: string
  detail?: ReactNode
  tone?: 'success' | 'warning' | 'danger'
  className?: string
}): ReactElement {
  const shown = typeof value === 'number' ? value.toLocaleString('en-US') : value
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      <span className="text-sm text-fg-muted">{label}</span>
      <span
        className={cn(
          'flex items-baseline gap-1 text-lg tabular-nums',
          tone === 'success' && 'text-success-text',
          tone === 'warning' && 'text-warning-text',
          tone === 'danger' && 'text-danger-text'
        )}
      >
        {shown}
        {unit && <span className="text-sm font-normal text-fg-secondary">{unit}</span>}
      </span>
      {detail && <span className="text-sm text-fg-secondary">{detail}</span>}
    </div>
  )
}

/** A block's colour; `color` comes from the measured block colours, missing means unknown (dashed outline). */
export function Swatch({
  color,
  size = 'sm',
  className
}: {
  color?: string | null
  size?: 'sm' | 'md'
  className?: string
}): ReactElement {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block shrink-0 rounded-xs border border-fg/20',
        size === 'sm' ? 'size-3' : 'size-4',
        !color && 'border-dashed border-fg-muted',
        className
      )}
      // block colours are data, not chrome, so they come in as values
      style={{ background: color ?? 'transparent' }}
    />
  )
}

/** A block: swatch, short id in mono, optionally its properties and a count. The full state is the tooltip. */
export function BlockChip({
  state,
  color,
  count,
  showProps = false,
  className
}: {
  state: string
  color?: string | null
  count?: number
  showProps?: boolean
  className?: string
}): ReactElement {
  const { id, props } = splitState(state)
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 font-mono text-sm',
        className
      )}
      title={state}
    >
      <Swatch color={color} />
      <span className="truncate">
        {id}
        {showProps && props && <span className="text-fg-muted">[{props}]</span>}
      </span>
      {count !== undefined && (
        <span className="ml-auto shrink-0 pl-2 text-fg-secondary tabular-nums">
          {count.toLocaleString('en-US')}
        </span>
      )}
    </span>
  )
}

const AXES = [
  ['x', 'text-axis-x'],
  ['y', 'text-axis-y'],
  ['z', 'text-axis-z']
] as const

/** x / y / z in mono with the axis colours, and a copy button that copies "x y z" (game command order). */
export function CoordinateReadout({
  value,
  label,
  copyLabel = 'Copy coordinates',
  className
}: {
  value: [number, number, number]
  label?: string
  copyLabel?: string
  className?: string
}): ReactElement {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      {label && <span className="text-sm text-fg-muted">{label}</span>}
      <span
        className="inline-flex items-center gap-2 font-mono text-sm tabular-nums"
        aria-label={`${label ? `${label}: ` : ''}x ${value[0]}, y ${value[1]}, z ${value[2]}`}
      >
        {AXES.map(([axis, cls], i) => (
          <span key={axis} aria-hidden>
            <span className={cls}>{axis}</span> {value[i]}
          </span>
        ))}
      </span>
      <CopyButton text={value.join(' ')} label={copyLabel} size="xs" />
    </span>
  )
}

/**
 * A file path the UI points at: the folder truncates first so the file name stays readable;
 * copy, and Show in folder when the app can reveal it.
 */
export function FileRef({
  path,
  onReveal,
  onOpen,
  className
}: {
  /** Workspace-relative or absolute path, with / or \ separators. */
  path: string
  onReveal?: () => void
  /** Makes the name a button, e.g. to show a version in the viewer. */
  onOpen?: () => void
  className?: string
}): ReactElement {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1
  const dir = path.slice(0, cut)
  const name = path.slice(cut)
  const text = (
    <>
      {dir && <span className="min-w-0 truncate text-fg-muted">{dir}</span>}
      <span className="shrink-0 text-fg">{name}</span>
    </>
  )
  return (
    <span
      className={cn('inline-flex max-w-full min-w-0 items-center gap-0.5', className)}
      title={path}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 rounded-sm font-mono text-sm hover:underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {text}
        </button>
      ) : (
        <span className="flex min-w-0 font-mono text-sm select-text">{text}</span>
      )}
      <CopyButton text={path} label="Copy path" size="xs" />
      {onReveal && (
        <IconAction label="Show in folder" icon={FolderOpen} size="xs" onClick={onReveal} />
      )}
    </span>
  )
}
