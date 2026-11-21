// Builds: every build in the workspace as a card (or a row), with what needs you on each one.
import { useState, type ReactElement, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Download, FolderOpen, LayoutGrid, List, MoreHorizontal, Plus, Search } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Chip } from '@/shared/ui/primitives/chip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger
} from '@/shared/ui/primitives/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/primitives/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/shared/ui/primitives/dropdown-menu'
import { Field } from '@/shared/ui/primitives/field'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import { Input } from '@/shared/ui/primitives/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/primitives/toggle-group'
import { Alert } from '@/shared/ui/feedback/Alert'
import { ConfirmDestructive } from '@/shared/ui/feedback/ConfirmDestructive'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { ErrorState } from '@/shared/ui/feedback/ErrorState'
import { LoadingState } from '@/shared/ui/feedback/LoadingState'
import { BuildCard } from '@/shared/ui/data/ImageCards'
import { CardGrid } from '@/shared/ui/layout/Grids'
import { PageHeader } from '@/shared/ui/layout/PageHeader'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { Tip } from '@/shared/ui/common/Tip'
import { buildUrl } from '@/shared/lib/urls'
import { useAvailability } from '@/entities/availability/model/availability'
import { useBuilds } from '@/entities/build/model/builds'
import { useJobs } from '@/entities/job/model/jobs'
import { useSettings } from '@/entities/settings/model/settings'
import { useReview } from '@/entities/review/model/review'
import {
  STATE_LABEL,
  buildMeta,
  buildState,
  shownBuilds,
  useGalleryDialog,
  type BuildState,
  type Sort
} from '@/entities/build/model/gallery'
import type { BuildSummary } from '@shared/api'
import { plain } from '@/shared/lib/format'
import { ImportDialog } from '@/features/import-projects/ui/ImportProjects'
import { SchematicFileField } from '@/features/import-schematic/ui/ImportSchematic'
import { useFixIssue } from '@/entities/availability/model/setupFix'
import { MinecraftVersionSelect } from '@/entities/settings/ui/MinecraftVersionSelect'
import { openSetup, useDeleteBuild, useNewBuild, useRenameBuild } from '../model/buildActions'

const TONE: Record<BuildState, 'accent' | 'warning' | 'neutral' | 'success'> = {
  running: 'accent',
  review: 'warning',
  progress: 'neutral',
  exported: 'success'
}
const STATES = ['all', 'running', 'progress', 'review', 'exported'] as const

type Layout = 'grid' | 'list'
const layoutKey = (workspace: string): string => `gallery-layout:${workspace}`
const readLayout = (workspace: string): Layout => {
  try {
    return localStorage.getItem(layoutKey(workspace)) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export function Gallery(): ReactElement {
  const settings = useSettings().data
  const builds = useBuilds()
  const navigate = useNavigate()
  const jobs = useJobs((s) => s.jobs)
  const drafts = useReview((s) => s.drafts)
  const dialog = useGalleryDialog((s) => s.open)
  const setDialog = (open: 'new' | 'import' | null): void => useGalleryDialog.setState({ open })
  const [query, setQuery] = useState('')
  const [state, setState] = useState<BuildState | 'all'>('all')
  const [sort, setSort] = useState<Sort>('changed')
  const workspace = settings?.workspace ?? ''
  const [layout, setLayoutState] = useState<Layout>(() => readLayout(workspace))
  const setLayout = (l: Layout): void => {
    setLayoutState(l)
    try {
      localStorage.setItem(layoutKey(workspace), l)
    } catch {
      // a remembered layout is a convenience
    }
  }
  const [renaming, setRenaming] = useState<string | null>(null)
  const [doomed, setDoomed] = useState<string | null>(null)

  const running = new Set(jobs.filter((j) => j.state === 'running').map((j) => j.spec.build))
  const reviews = new Set(
    Object.entries(drafts)
      .filter(([, d]) => d.requestId)
      .map(([b]) => b)
  )
  const stateOf = (b: BuildSummary): BuildState => buildState(b, running, reviews)
  const all = builds.data ?? []
  const shown = shownBuilds(all, { query, state, sort, stateOf })
  const count = (s: BuildState | 'all'): number =>
    s === 'all' ? all.length : all.filter((b) => stateOf(b) === s).length
  const open = (name: string): void => void navigate({ to: '/build/$name', params: { name } })
  const path = <span className="font-mono">{workspace}</span>

  const header = (
    <PageHeader
      title="Builds"
      meta={
        workspace && (
          <span className="text-sm text-fg-secondary">
            {builds.isLoading ? (
              <>Scanning builds… in {path}</>
            ) : all.length ? (
              <>
                {all.length} {all.length === 1 ? 'build' : 'builds'} in {path}
              </>
            ) : (
              <>No builds yet in {path}</>
            )}
          </span>
        )
      }
      actions={
        <span className="flex gap-2 max-sm:hidden">
          <Button variant="outline" onClick={() => setDialog('import')}>
            <Download aria-hidden />
            Import builds…
          </Button>
          <NewBuildButton onClick={() => setDialog('new')} />
        </span>
      }
    />
  )

  let body: ReactNode
  if (settings && !workspace)
    body = (
      <EmptyState
        icon={FolderOpen}
        size="page"
        title="No workspace set yet"
        action={
          <Button variant="primary" onClick={openSetup}>
            Open setup
          </Button>
        }
      >
        Builder Studio keeps your builds in a workspace folder. Choose one to start.
      </EmptyState>
    )
  else if (builds.isError)
    body = (
      <ErrorState
        layout="centered"
        title="Can’t open the workspace folder"
        error={builds.error}
        onRetry={() => void builds.refetch()}
        action={
          <Button
            variant="primary"
            onClick={() => void navigate({ to: '/settings', search: { section: 'general' } })}
          >
            Choose another folder…
          </Button>
        }
      >
        <span className="font-mono">{workspace}</span>. The folder was moved or renamed, or its
        drive isn’t connected. Your builds are not deleted.
      </ErrorState>
    )
  else if (builds.isLoading) body = <LoadingState label="Scanning builds" layout="cards" rows={8} />
  else if (!all.length)
    body = (
      <EmptyState
        icon={Plus}
        size="page"
        title="Start your first build"
        action={<NewBuildButton onClick={() => setDialog('new')} />}
        secondary={
          <Button variant="outline" onClick={() => setDialog('import')}>
            Import builds…
          </Button>
        }
      >
        A build is a folder in builds\ with a generator script, a design log and a README. Name it,
        then describe it to the assistant or edit build.py.
      </EmptyState>
    )
  else
    body = (
      <>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Input
            aria-label="Filter builds by name"
            placeholder="Filter by name"
            leading={<Search aria-hidden />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={query ? () => setQuery('') : undefined}
            className="w-full sm:w-70"
          />
          <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
            {STATES.map((s) => (
              <Chip key={s} selected={state === s} onClick={() => setState(s)}>
                {s === 'all' ? 'All' : STATE_LABEL[s]} {count(s)}
              </Chip>
            ))}
          </div>
          <div className="flex-1" />
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger aria-label="Sort builds" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="changed">Last changed</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <SegmentedControl
            aria-label="Layout"
            value={layout}
            onValueChange={(v) => v && setLayout(v as Layout)}
          >
            <SegmentedControlItem value="grid" aria-label="Grid">
              <LayoutGrid aria-hidden />
            </SegmentedControlItem>
            <SegmentedControlItem value="list" aria-label="List">
              <List aria-hidden />
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
        {!shown.length ? (
          <EmptyState
            icon={Search}
            variant="no-results"
            title={query ? `No builds match “${query}”` : 'No builds in this filter'}
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('')
                  setState('all')
                }}
              >
                Clear filter
              </Button>
            }
          >
            Searching {all.length} builds by name. Status filter:{' '}
            {state === 'all' ? 'All' : STATE_LABEL[state]}.
          </EmptyState>
        ) : layout === 'grid' ? (
          <CardGrid min="15rem">
            {shown.map((b) => (
              <Card
                key={b.name}
                build={b}
                state={stateOf(b)}
                onOpen={() => open(b.name)}
                onRename={() => setRenaming(b.name)}
                onDelete={() => setDoomed(b.name)}
              />
            ))}
          </CardGrid>
        ) : (
          <ul className="flex flex-col">
            {shown.map((b) => (
              <li key={b.name}>
                <Card
                  layout="row"
                  build={b}
                  state={stateOf(b)}
                  onOpen={() => open(b.name)}
                  onRename={() => setRenaming(b.name)}
                  onDelete={() => setDoomed(b.name)}
                />
              </li>
            ))}
          </ul>
        )}
      </>
    )

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-wide flex-1 flex-col gap-4 px-4 pt-6 pb-8 sm:px-8">
        {header}
        <EngineBanner />
        {body}
      </div>
      {/* only beside a list: the empty and error states carry their own action */}
      {all.length > 0 && (
        <div className="sticky bottom-0 border-t border-border-default bg-surface px-4 py-3 sm:hidden">
          <NewBuildButton className="w-full" onClick={() => setDialog('new')} />
        </div>
      )}
      <NewBuildDialog
        open={dialog === 'new'}
        onOpenChange={(o) => setDialog(o ? 'new' : null)}
        taken={all.map((b) => b.name)}
      />
      <ImportDialog
        open={dialog === 'import'}
        onOpenChange={(o) => setDialog(o ? 'import' : null)}
      />
      {renaming && (
        <RenameDialog
          name={renaming}
          taken={all.map((b) => b.name)}
          onClose={() => setRenaming(null)}
        />
      )}
      <DeleteBuild name={doomed} onClose={() => setDoomed(null)} />
    </div>
  )
}

function NewBuildButton({
  onClick,
  className
}: {
  onClick: () => void
  className?: string
}): ReactElement {
  const ok = useAvailability().data?.features.newBuild.ok
  const button = (
    <Button
      variant="primary"
      aria-disabled={!ok}
      className={className}
      onClick={() => ok && onClick()}
    >
      <Plus aria-hidden />
      New build
    </Button>
  )
  return ok ? button : <Tip label="New builds need the build engine and Git">{button}</Tip>
}

/** Named when New build is blocked: installs what is missing straight away. */
function EngineBanner(): ReactElement | null {
  const availability = useAvailability().data
  const fix = useFixIssue()
  const [hidden, setHidden] = useState(false)
  if (!availability || availability.features.newBuild.ok || hidden) return null
  const engine = !availability.requirements.engine.ok
  const git = !availability.requirements.git.ok
  return (
    <Alert
      variant="banner"
      tone="warning"
      onDismiss={() => setHidden(true)}
      action={
        <span className="flex flex-wrap gap-2">
          {engine && (
            <Button size="sm" variant="primary" onClick={() => fix('engine')}>
              Install build engine
            </Button>
          )}
          {git && (
            <Button size="sm" variant="outline" onClick={() => fix('git')}>
              Install Git
            </Button>
          )}
        </span>
      }
    >
      New builds need the build engine and Git. Opening and reviewing builds works now.
    </Alert>
  )
}

const busyReason = 'Stop the running draft to rename or delete.'

function Card({
  build: b,
  state,
  layout = 'card',
  onOpen,
  onRename,
  onDelete
}: {
  build: BuildSummary
  state: BuildState
  layout?: 'card' | 'row'
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}): ReactElement {
  const job = useJobs((s) => s.jobs.find((j) => j.spec.build === b.name && j.state === 'running'))
  const busy = !!job
  // jobs are newest first: the build's latest job, so a later success clears the mark
  const failed = useJobs((s) => s.jobs.find((j) => j.spec.build === b.name)?.state === 'failed')
  const status =
    b.status.map(plain).find((s) => /^current/i.test(s)) ?? (b.status[0] && plain(b.status[0]))
  // the same three items in the ⋯ menu and the context menu
  const items = (
    Item: typeof DropdownMenuItem | typeof ContextMenuItem,
    Label: typeof DropdownMenuLabel | typeof ContextMenuLabel
  ): ReactNode => (
    <>
      <Item onSelect={onOpen}>Open</Item>
      <Item disabled={busy} onSelect={onRename}>
        Rename…
      </Item>
      <Item variant="destructive" disabled={busy} onSelect={onDelete}>
        Delete…
      </Item>
      {busy && <Label className="max-w-60 text-xs font-normal text-fg-muted">{busyReason}</Label>}
    </>
  )
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <BuildCard
          layout={layout}
          name={b.name}
          image={b.sheet ? buildUrl(b.sheet, Math.round(b.mtime)) : null}
          status={status ?? 'No status yet'}
          meta={buildMeta(b)}
          badge={
            (state !== 'progress' || failed) && (
              <span className="flex flex-wrap gap-1">
                {state !== 'progress' && (
                  <StatusBadge tone={TONE[state]}>{job?.stage ?? STATE_LABEL[state]}</StatusBadge>
                )}
                {failed && <StatusBadge state="failed">Last job failed</StatusBadge>}
              </span>
            )
          }
          progress={job ? null : undefined}
          progressLabel={`Working on ${b.name}`}
          onOpen={onOpen}
          menu={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label={`More actions for ${b.name}`} size="icon-sm">
                  <MoreHorizontal aria-hidden />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {items(DropdownMenuItem, DropdownMenuLabel)}
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
      </ContextMenuTrigger>
      <ContextMenuContent aria-label={b.name}>
        {items(ContextMenuItem, ContextMenuLabel)}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function NewBuildDialog({
  open,
  onOpenChange,
  taken
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  taken: string[]
}): ReactElement {
  const {
    name,
    setName,
    busy,
    failure,
    minecraftVersion,
    setSelectedVersion,
    file,
    parsed,
    rule,
    create,
    close
  } = useNewBuild(taken, onOpenChange)
  const locked = busy || file.choosing
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !locked && close()}>
      <DialogContent showCloseButton={!locked} phone="sheet">
        <DialogHeader>
          <DialogTitle>New build</DialogTitle>
          <DialogDescription>
            A starter generator, design log and README in your workspace.
          </DialogDescription>
        </DialogHeader>
        <form
          id="new-build"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const form = e.currentTarget
            void create().then((ok) => ok || form.querySelector('input')?.focus())
          }}
        >
          <Field
            label="Build name"
            hint={
              <>
                Lowercase letters, digits and _, starting with a letter.
                {parsed.success && !rule && (
                  <>
                    {' '}
                    Creates <span className="font-mono">builds\{name}\</span> with build.py,
                    DESIGN.md and a README.
                  </>
                )}
              </>
            }
            error={rule || failure || undefined}
          >
            <Input
              autoFocus
              value={name}
              disabled={busy}
              spellCheck={false}
              placeholder="my_build"
              className="font-mono"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field
            label="Minecraft target"
            hint="New versions from this build use this game version."
          >
            <MinecraftVersionSelect
              value={minecraftVersion}
              disabled={busy || file.choosing}
              onChange={(next) => {
                file.clear()
                setSelectedVersion(next)
              }}
            />
          </Field>
          <SchematicFileField file={file} optional disabled={busy} />
        </form>
        <DialogFooter>
          <Button variant="ghost" disabled={locked} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="new-build" variant="primary" loading={locked}>
            {busy ? 'Creating…' : 'Create build'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RenameDialog({
  name,
  taken,
  onClose
}: {
  name: string
  taken: string[]
  onClose: () => void
}): ReactElement {
  const { to, setTo, error, submit } = useRenameBuild(name, taken, onClose)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {name}</DialogTitle>
        </DialogHeader>
        <form
          id="rename-build"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Field
            label="New folder name"
            error={error || undefined}
            hint={`Renames the folder builds\\${name.replaceAll('/', '\\')}. Code inside that names its own folder isn’t changed.`}
          >
            <Input
              autoFocus
              value={to}
              spellCheck={false}
              className="font-mono"
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="rename-build" variant="primary" aria-disabled={!!error}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Delete keeps the knowledge: sources and DESIGN.md go to builds/_archive, only out/ (drafts and renders) is trashed. */
function DeleteBuild({
  name,
  onClose
}: {
  name: string | null
  onClose: () => void
}): ReactElement {
  const { size, archive } = useDeleteBuild(name)
  const base = name?.split('/').pop()
  const mono = (s: string): ReactElement => <span className="font-mono">{s}</span>
  return (
    <ConfirmDestructive
      open={!!name}
      onOpenChange={(o) => !o && onClose()}
      title={`Delete ${name}?`}
      action="Delete build"
      onConfirm={archive}
    >
      <p>
        The scripts, {mono('DESIGN.md')} and {mono('data\\')} move to{' '}
        {mono(`builds\\_archive\\${base}\\`)}, so they stay in Git as reference.
      </p>
      <p>
        {mono('out\\')} (drafts and renders
        {size.data !== undefined ? `, ${(size.data / 1e6).toFixed(1)} MB` : ''}) goes to the Recycle
        Bin.
      </p>
      <p>Full builds already copied to the game’s schematics folder are not touched.</p>
    </ConfirmDestructive>
  )
}
