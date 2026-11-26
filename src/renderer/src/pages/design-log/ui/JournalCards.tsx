// Presentational cards for the Structured Build Journal: Status summary, Brief/Decisions sections,
// collapsible Review round cards with clickable sheets and clean pin rows, and Export cards.
import type { ReactElement } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  MapPin,
  Rocket,
  StickyNote
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/shared/ui/primitives/collapsible'
import { Prose } from '@/shared/ui/code/Prose'
import { buildUrl } from '@/shared/lib/urls'
import { formatShortDate } from '@/entities/ref/model/refs'
import type { JournalEntry, JournalSection, StatusRow } from '../model/designLog'

export function StatusSummaryCard({ rows }: { rows: StatusRow[] }): ReactElement | null {
  if (!rows.length) return null
  return (
    <section
      id="section-status"
      aria-labelledby="status-heading"
      className="scroll-mt-4 rounded-lg border border-border-default bg-surface-raised p-4 focus:outline-none"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="status-heading" className="text-sm font-semibold text-fg">
          Status
        </h2>
        <span className="text-xs text-fg-muted">Updated by assistant</span>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn('flex min-w-0 flex-col gap-1', row.value.length > 60 && 'sm:col-span-2')}
          >
            <dt className="text-xs font-medium text-fg-muted">{row.label}</dt>
            <dd className="min-w-0 text-sm text-fg">
              {row.parts ? (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {row.parts.map((part) => (
                    <Badge key={part} variant="secondary">
                      <Check aria-hidden />
                      {part}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="break-words">{row.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function BriefPromptCard({ onWrite }: { onWrite: () => void }): ReactElement {
  return (
    <section
      aria-label="Brief"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border-default bg-surface-panel px-4 py-3"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <FileText aria-hidden className="size-4 shrink-0 text-fg-muted" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">No brief written yet</p>
          <p className="text-xs text-fg-muted">
            Capture the build’s purpose, style, and palette so every session stays aligned.
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onWrite}>
        Write brief
      </Button>
    </section>
  )
}

export function SectionCard({ section }: { section: JournalSection }): ReactElement {
  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-title`}
      className="scroll-mt-4 rounded-lg border border-border-default bg-surface-raised p-4 focus:outline-none sm:p-5"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id={`${section.id}-title`} className="text-md font-semibold text-fg">
          {section.title}
        </h2>
        {section.date && (
          <span className="shrink-0 font-mono text-xs text-fg-muted tabular-nums">
            {formatShortDate(section.date)}
          </span>
        )}
      </div>
      <Prose variant="docs" className="max-w-none">
        {section.body}
      </Prose>
    </section>
  )
}

export function RoundCard({
  entry,
  open,
  onOpenChange,
  onOpenSheet
}: {
  entry: Extract<JournalEntry, { kind: 'round' }>
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenSheet: (sheetPath: string) => void
}): ReactElement {
  const hasDetail = Boolean(
    entry.sheet || entry.notes || entry.pins.length || entry.body || entry.approved.length
  )
  const dateLabel = entry.date ? formatShortDate(entry.date) : null
  const pinCount = entry.pins.length

  return (
    <article
      id={entry.id}
      aria-labelledby={`${entry.id}-title`}
      className="scroll-mt-4 overflow-hidden rounded-lg border border-border-default bg-surface-raised focus:outline-none"
    >
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            disabled={!hasDetail}
            className={cn(
              'focus-ring flex w-full items-start gap-2.5 px-4 py-3 text-start transition-colors duration-fast ease-standard',
              hasDetail && 'cursor-pointer can-hover:hover:bg-surface-hover'
            )}
          >
            {hasDetail ? (
              open ? (
                <ChevronDown aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
              ) : (
                <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
              )
            ) : (
              <span aria-hidden className="mt-0.5 size-4 shrink-0" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                <Badge variant="outline" className="font-mono">
                  R{entry.round}
                </Badge>
                <h3
                  id={`${entry.id}-title`}
                  className="min-w-0 flex-1 text-base font-medium text-fg"
                >
                  {entry.title}
                </h3>
                {dateLabel && (
                  <span className="shrink-0 font-mono text-xs text-fg-muted tabular-nums">
                    {dateLabel}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {entry.pick && (
                  <Badge variant="accent">
                    <Check aria-hidden />
                    Picked {entry.pick}
                  </Badge>
                )}
                {!entry.pick && entry.fileCount && entry.fileCount > 0 ? (
                  <Badge variant="secondary">
                    {entry.fileCount} {entry.fileCount === 1 ? 'option' : 'options'}
                  </Badge>
                ) : null}
                {pinCount > 0 && (
                  <Badge variant="secondary">
                    <MapPin aria-hidden />
                    {pinCount} {pinCount === 1 ? 'pin' : 'pins'}
                  </Badge>
                )}
                {entry.approved.map((part) => (
                  <Badge key={part} variant="success">
                    <Check aria-hidden />
                    {part}
                  </Badge>
                ))}
                {entry.archived && <Badge variant="outline">Archived</Badge>}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        {hasDetail && (
          <CollapsibleContent>
            <div className="flex flex-col gap-4 border-t border-border-subtle px-4 py-3.5">
              {entry.sheet && (
                <button
                  type="button"
                  onClick={() => onOpenSheet(entry.sheet!)}
                  aria-label={`Inspect preview sheet for round ${entry.round}`}
                  className="focus-ring group/sheet relative block w-full cursor-zoom-in overflow-hidden rounded-md border border-border-default bg-surface-viewer transition-[border-color] duration-fast can-hover:hover:border-border-strong"
                >
                  <img
                    src={buildUrl(entry.sheet)}
                    alt={`Preview sheet for round ${entry.round}`}
                    loading="lazy"
                    className="max-h-56 w-full object-contain"
                  />
                </button>
              )}

              {entry.notes && (
                <p className="text-sm leading-5 whitespace-pre-wrap text-fg">{entry.notes}</p>
              )}

              {entry.pins.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-fg-muted">Pins</p>
                  <ul className="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle bg-surface-panel">
                    {entry.pins.map((pin) => (
                      <li
                        key={`${pin.n}-${pin.file}-${pin.location}`}
                        className="flex flex-col gap-0.5 px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-mono text-xs font-medium text-accent-text tabular-nums">
                            #{pin.n}
                          </span>
                          <span className="font-mono text-xs text-fg-muted">
                            {pin.file} · {pin.location}
                            {pin.state ? ` · ${pin.state}` : ''}
                          </span>
                        </div>
                        {pin.text && <p className="text-sm text-fg">{pin.text}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {entry.body && (
                <Prose variant="log" className="max-w-none">
                  {entry.body}
                </Prose>
              )}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </article>
  )
}

export function ExportCard({
  entry
}: {
  entry: Extract<JournalEntry, { kind: 'export' }>
}): ReactElement {
  const dateLabel = entry.date ? formatShortDate(entry.date) : null
  return (
    <article
      id={entry.id}
      aria-labelledby={`${entry.id}-title`}
      className="scroll-mt-4 rounded-lg border border-border-default bg-surface-raised p-4 focus:outline-none"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-success-subtle text-success-text"
        >
          <Rocket className="size-3.5" />
        </span>
        <h3 id={`${entry.id}-title`} className="min-w-0 flex-1 text-base font-medium text-fg">
          {entry.title}
        </h3>
        {entry.archived && <Badge variant="outline">Archived</Badge>}
        {dateLabel && (
          <span className="shrink-0 font-mono text-xs text-fg-muted tabular-nums">{dateLabel}</span>
        )}
      </div>
      {entry.body && (
        <Prose variant="log" className="max-w-none">
          {entry.body}
        </Prose>
      )}
    </article>
  )
}

export function JournalNoteCard({
  entry
}: {
  entry: Extract<JournalEntry, { kind: 'note' }>
}): ReactElement {
  const dateLabel = entry.date ? formatShortDate(entry.date) : null
  return (
    <article
      id={entry.id}
      aria-labelledby={`${entry.id}-title`}
      className="scroll-mt-4 rounded-lg border border-border-default bg-surface-raised p-4 focus:outline-none"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <StickyNote aria-hidden className="size-4 shrink-0 text-fg-muted" />
        <h3 id={`${entry.id}-title`} className="min-w-0 flex-1 text-base font-medium text-fg">
          {entry.title}
        </h3>
        {entry.archived && <Badge variant="outline">Archived</Badge>}
        {dateLabel && (
          <span className="shrink-0 font-mono text-xs text-fg-muted tabular-nums">{dateLabel}</span>
        )}
      </div>
      {entry.body && (
        <Prose variant="log" className="max-w-none">
          {entry.body}
        </Prose>
      )}
    </article>
  )
}
