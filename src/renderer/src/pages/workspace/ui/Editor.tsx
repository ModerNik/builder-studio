// The Workspace Editor dock (G6.1 A): Edit, Parts, Checks and Materials tabs for the open version.
import { useState, type ReactElement, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight, LocateFixed, MessageSquarePlus, Play, ScanSearch } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import { Input } from '@/shared/ui/primitives/input'
import { Tabs, TabsContent } from '@/shared/ui/primitives/tabs'
import { EditorTabs } from '@/widgets/workbench-shell/ui/EditorTabs'
import { Alert, InlineNotice } from '@/shared/ui/feedback/Alert'
import { ErrorState } from '@/shared/ui/feedback/ErrorState'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
import { BlockChip, Swatch } from '@/shared/ui/data/values'
import { Tip } from '@/shared/ui/common/Tip'
import { cn } from '@/shared/lib/utils'
import { pickPart } from '@/entities/parts/model/parts'
import {
  CHECK_COLORS,
  checkLabel,
  groupMaterials,
  partCentre,
  partLabel,
  partSources,
  shiftedChecks,
  type BuildVersion
} from '@/entities/build/model/workspace'
import type { VersionAnalysis } from '@/pages/workspace/model/analysis'
import type { Cell } from '@/entities/viewer/ui/BuildViewer'
import type { PartInfo } from '@shared/api'
import { INFO, lintProblems } from '@/shared/lib/format'
import { useBlockColor } from '@/entities/build/model/blocks'
import type { Section } from '@/entities/availability/model/setupIssues'
import type { BlockEditor } from '@/widgets/block-editor/model/editor'
import { EditPane } from '@/widgets/block-editor/ui/EditPane'

export type EditorTab = 'edit' | 'parts' | 'checks' | 'materials'

export function Editor({
  tab,
  onTab,
  a,
  build,
  edit,
  onShowNewest,
  version,
  engine,
  jobCounts,
  canDraft,
  onDraft,
  canCheck,
  onCheck,
  onLocate,
  onAsk
}: {
  tab: EditorTab
  onTab: (tab: EditorTab) => void
  a: VersionAnalysis
  build: string
  edit: BlockEditor
  onShowNewest: () => void
  version: BuildVersion | null
  /** The build tools are ready. */
  engine: boolean
  jobCounts?: Record<string, number>
  canDraft: boolean
  onDraft: () => void
  canCheck: boolean
  onCheck: () => void
  onLocate: (cell: Cell) => void
  onAsk: () => void
}): ReactElement {
  const pane = 'min-h-0 flex-1 overflow-y-auto p-3 data-[state=inactive]:hidden'
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => onTab(v as EditorTab)}
      className="flex h-full min-h-0 flex-col gap-0"
    >
      <EditorTabs />
      <TabsContent value="edit" forceMount className={pane}>
        {edit.blocked === null ? (
          <EditPane editor={edit} build={build} />
        ) : (
          <EditNotice blocked={edit.blocked} onShowNewest={onShowNewest} />
        )}
      </TabsContent>
      <TabsContent value="parts" forceMount className={pane}>
        <PaneHead title="Parts">
          {a.partList && (
            <span className="text-sm text-fg-secondary tabular-nums">
              {a.names.length} of {a.partList.length} selected
              {a.names.length > 0 && (
                <Button variant="link" className="ms-2 text-sm" onClick={() => a.setSelected([])}>
                  Clear
                </Button>
              )}
            </span>
          )}
        </PaneHead>
        {!engine ? (
          <SetupHint text="Parts need the build tools." section="tools" />
        ) : version && !version.parts ? (
          <div className="space-y-3">
            <p className="text-fg-secondary">
              This version was made before parts were recorded. Builds that use Canvas and c.op
              record them on their next draft.
            </p>
            <Button variant="outline" disabled={!canDraft} onClick={onDraft}>
              <Play aria-hidden="true" /> Generate draft
            </Button>
          </div>
        ) : a.parts.isFetching && !a.parts.data ? (
          <LoadingState label="Reading parts" rows={5} />
        ) : a.parts.error ? (
          <ErrorState title="Parts could not be read." error={a.parts.error} />
        ) : a.partList ? (
          <PartsList
            parts={a.partList}
            selected={a.selected}
            onChange={a.setSelected}
            colors={a.partsView ? a.colors.data?.colors : undefined}
            onLocate={onLocate}
            onAsk={onAsk}
          />
        ) : (
          <p className="text-fg-secondary">
            {version
              ? 'The recorded parts no longer match this file. Generate a new draft to record them again.'
              : 'Select a version to see its parts.'}
          </p>
        )}
      </TabsContent>
      <TabsContent value="checks" forceMount className={pane}>
        <PaneHead title="Build checks">
          <Button size="sm" variant="outline" disabled={!canCheck} onClick={onCheck}>
            <ScanSearch aria-hidden="true" /> Check build
          </Button>
        </PaneHead>
        {!engine ? (
          <SetupHint text="Build checks need the build tools." section="tools" />
        ) : version && !a.auto ? (
          <AnalysisRequest size={version.size} onRun={a.analyze} />
        ) : (
          <ChecksList a={a} jobCounts={jobCounts} onLocate={onLocate} />
        )}
      </TabsContent>
      <TabsContent value="materials" forceMount className={pane}>
        <PaneHead title="Material list">
          {a.bill.data && (
            <span className="text-sm text-fg-secondary tabular-nums">
              {a.bill.data.total.toLocaleString()} blocks
            </span>
          )}
        </PaneHead>
        {!engine ? (
          <SetupHint text="Counting materials needs the build tools." section="tools" />
        ) : version && !a.auto ? (
          <AnalysisRequest size={version.size} onRun={a.analyze} />
        ) : a.bill.isFetching ? (
          <LoadingState label="Counting materials" rows={6} />
        ) : a.bill.error ? (
          <ErrorState title="Materials could not be counted." error={a.bill.error} />
        ) : a.bill.data ? (
          <Materials states={a.bill.data.top} />
        ) : (
          <p className="text-fg-secondary">Select a version to see its materials.</p>
        )}
      </TabsContent>
    </Tabs>
  )
}

function PaneHead({ title, children }: { title: string; children?: ReactNode }): ReactElement {
  return (
    <div className="mb-3 flex min-h-(--density-control) flex-wrap items-center justify-between gap-2">
      <h2 className="font-medium">{title}</h2>
      {children}
    </div>
  )
}

/** Why the Edit tab cannot edit right now, and the way there. */
function EditNotice({
  blocked,
  onShowNewest
}: {
  blocked: NonNullable<BlockEditor['blocked']>
  onShowNewest: () => void
}): ReactElement | null {
  if (blocked === 'no-version') return null
  if (blocked === 'loading') return <LoadingState label="Loading blocks" rows={3} />
  if (blocked === 'no-tools')
    return <SetupHint text="Editing blocks needs the build tools." section="tools" />
  if (blocked === 'unreadable')
    return (
      <Alert tone="danger">
        This build&apos;s hand edits (data/edits.json) could not be read, so editing is off to keep
        them as they are. Reopen the build once the file is fixed.
      </Alert>
    )
  return (
    <Alert
      tone="info"
      action={
        <Button size="sm" variant="outline" onClick={onShowNewest}>
          Show newest
        </Button>
      }
    >
      Blocks are edited on the newest version. This one shows its file as it was made.
    </Alert>
  )
}

/** Points at the Settings section that fixes it. */
export function SetupHint({ text, section }: { text: string; section: Section }): ReactElement {
  return (
    <Alert
      tone="info"
      action={
        <Button size="sm" variant="outline" asChild>
          <Link to="/settings" search={{ section }}>
            Open Settings
          </Link>
        </Button>
      }
    >
      {text}
    </Alert>
  )
}

function AnalysisRequest({ size, onRun }: { size: number; onRun: () => void }): ReactElement {
  return (
    <div className="space-y-3">
      <p className="text-fg-secondary">
        This is a large file ({(size / 1e6).toFixed(1)} MB). Checking it and counting materials may
        take a while.
      </p>
      <Button variant="outline" onClick={onRun}>
        Analyze this version
      </Button>
    </div>
  )
}

/** The ops that built this version, biggest first, with the code that opened the selected ones. */
function PartsList({
  parts,
  selected,
  onChange,
  colors,
  onLocate,
  onAsk
}: {
  parts: PartInfo[]
  selected: string[]
  onChange: (selected: string[]) => void
  colors?: Record<string, string>
  onLocate: (cell: Cell) => void
  onAsk: () => void
}): ReactElement {
  const colorOf = useBlockColor()
  const [filter, setFilter] = useState('')
  const q = filter.trim().toLowerCase()
  const rows = [...parts]
    .sort((a, b) => b.blocks - a.blocks)
    .filter((p) => partLabel(p.name).toLowerCase().includes(q))
  const chosen = parts.filter((p) => selected.includes(p.name))
  const sources = [...new Set(chosen.flatMap(partSources))]
  return (
    <div className="space-y-3">
      <Input
        type="search"
        placeholder="Filter parts"
        aria-label="Filter parts"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      {rows.length ? (
        <ul aria-label="Parts" className="-mx-1">
          {rows.map((p) => {
            const on = selected.includes(p.name)
            const label = partLabel(p.name)
            const where = partSources(p)
            const name = (
              <button
                type="button"
                onClick={() => onChange(pickPart(selected, p.name, false))}
                className="focus-ring min-w-0 flex-1 truncate rounded-sm text-start"
              >
                {label}
              </button>
            )
            return (
              <li
                key={p.name}
                className={cn(
                  'flex min-h-(--density-row) items-center gap-2 rounded-md px-1',
                  on ? 'bg-accent-subtle' : 'can-hover:hover:bg-surface-hover'
                )}
              >
                <Checkbox
                  checked={on}
                  aria-label={`Select ${label}`}
                  onCheckedChange={() => onChange(pickPart(selected, p.name, true))}
                />
                {colors?.[p.name] && <Swatch color={colorOf(colors[p.name])} />}
                {where.length ? <Tip label={where.join('\n')}>{name}</Tip> : name}
                <span className="font-mono text-sm text-fg-secondary tabular-nums">
                  {p.blocks.toLocaleString()}
                </span>
                <IconButton
                  size="icon-sm"
                  label={`Locate ${label} in 3D`}
                  onClick={() => onLocate(partCentre(p))}
                >
                  <LocateFixed aria-hidden="true" />
                </IconButton>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-fg-secondary">No parts match.</p>
      )}
      {chosen.length > 0 && (
        <section className="space-y-2 border-t border-border-subtle pt-3">
          <h3 className="text-xs font-medium text-fg-secondary">
            Build code for {chosen.length === 1 ? 'this part' : `${chosen.length} parts`}
          </h3>
          {sources.length ? (
            <ul className="space-y-0.5 font-mono text-sm break-all">
              {sources.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">No build code recorded for these parts.</p>
          )}
          <Button variant="outline" onClick={onAsk}>
            <MessageSquarePlus aria-hidden="true" /> Ask agent about{' '}
            {chosen.length === 1 ? 'this part' : `${chosen.length} parts`}
          </Button>
        </section>
      )}
    </div>
  )
}

function ChecksList({
  a,
  jobCounts,
  onLocate
}: {
  a: VersionAnalysis
  jobCounts?: Record<string, number>
  onLocate: (cell: Cell) => void
}): ReactElement {
  const colorOf = useBlockColor()
  const { lint } = a
  if (lint.isFetching) return <LoadingState label="Checking this version" rows={4} />
  if (lint.error)
    return <ErrorState title="This version could not be checked." error={lint.error} />
  if (!lint.data) return <p className="text-fg-secondary">Select a version to see its checks.</p>
  const counts = jobCounts ?? lint.data.counts
  const problems = lintProblems(counts)
  return (
    <div className="space-y-4">
      <InlineNotice tone={problems ? 'warning' : 'success'}>
        {problems ? `${problems.toLocaleString()} potential issues` : 'No issues found'}
      </InlineNotice>
      <dl className="space-y-1">
        {Object.entries(counts)
          .filter(([key]) => key !== 'floating')
          .map(([key, n]) => (
            <div key={key} className="flex items-baseline justify-between gap-3 text-sm">
              <dt className="text-fg-secondary">{checkLabel(key)}</dt>
              <dd
                className={cn(
                  'font-mono tabular-nums',
                  !INFO.has(key) && n > 0 && 'text-warning-text'
                )}
              >
                {n.toLocaleString()}
              </dd>
            </div>
          ))}
      </dl>
      {shiftedChecks(lint.data.counts, jobCounts).length > 0 && (
        <p className="text-sm text-fg-muted">
          Some issues were found during generation. Their locations may differ in the saved version.
        </p>
      )}
      {a.where.map(([key, rows]) => (
        <section key={key} className="space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ background: `var(${CHECK_COLORS[key] ?? '--fg'})` }}
            />
            {checkLabel(key)}
          </h3>
          <ul className="-mx-1">
            {rows.map(([state, count, cell], i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onLocate(cell)}
                  aria-label={`${state} at ${cell.join(' ')}${count > 1 ? `, ${count} times` : ''}: show in 3D`}
                  className="focus-ring flex min-h-(--density-row) w-full items-center gap-2 rounded-md px-1 text-start can-hover:hover:bg-surface-hover"
                >
                  <BlockChip state={state} color={colorOf(state)} className="min-w-0 flex-1" />
                  <span className="font-mono text-sm text-fg-secondary tabular-nums">
                    {cell.join(' ')}
                  </span>
                  {count > 1 && <span className="text-sm text-fg-muted">×{count}</span>}
                  <LocateFixed aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Materials({ states }: { states: [string, number][] }): ReactElement {
  const colorOf = useBlockColor()
  const [shown, setShown] = useState<string | null>(null)
  const blocks = groupMaterials(states)
  const row = 'flex min-h-(--density-row) w-full items-center gap-2 rounded-md px-1 text-start'
  return (
    <ul aria-label="Materials" className="-mx-1 divide-y divide-border-subtle">
      {blocks.map(([id, block]) => {
        const inner = (
          <>
            <Swatch color={colorOf(id)} />
            <span className="min-w-0 flex-1 font-mono text-sm break-all">{id}</span>
            <span className="font-mono text-sm text-fg-secondary tabular-nums">
              {block.n.toLocaleString()}
            </span>
          </>
        )
        return (
          <li key={id}>
            {block.states.length ? (
              <button
                type="button"
                onClick={() => setShown((value) => (value === id ? null : id))}
                aria-expanded={shown === id}
                className={cn(row, 'focus-ring can-hover:hover:bg-surface-hover')}
              >
                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    'size-4 shrink-0 text-fg-muted transition-transform duration-fast',
                    shown === id && 'rotate-90'
                  )}
                />
                {inner}
              </button>
            ) : (
              <div className={row}>
                <span className="size-4 shrink-0" />
                {inner}
              </div>
            )}
            {shown === id && (
              <ul className="mb-2 ms-7 space-y-1 border-s border-border-subtle ps-3">
                {block.states.map(([props, n]) => (
                  <li key={props} className="flex gap-2 font-mono text-sm text-fg-secondary">
                    <span className="min-w-0 flex-1 break-words">{props}</span>
                    <span className="tabular-nums">{n.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
