// The Workspace screen (G6.1 A, viewer-first): toolbar, canvas, Editor and Activity. Data and labels
// live in lib/workspace.ts and lib/analysis.ts; the parts are in app/workspace/*.
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { Activity, PencilRuler } from 'lucide-react'
import type { WorkbenchPanel } from '@/widgets/workbench-shell/ui/Dock'
import { deleteVersion, useReportWorkspace } from '../model/actions'
import { cancelJob } from '@/entities/job/model/jobs'
import { buildUrl } from '@/shared/lib/urls'
import { lastOf, useJobs } from '@/entities/job/model/jobs'
import { useAvailability } from '@/entities/availability/model/availability'
import { clearShow, matchShow, useBuild, useShow } from '@/entities/build/model/builds'
import { useMinecraftPack, useSettings } from '@/entities/settings/model/settings'
import { useSaveSettings } from '@/entities/settings/model/save'
import { DEFAULT_LINTER_SETTINGS, type LintRule } from '@shared/api'
import { hasEnabledLintRule } from '@/shared/lib/format'
import { useAgentPrefs } from '@/features/agent-chat/model/agent'
import { useAskParts } from '@/entities/parts/model/parts'
import { comparisonBaseline } from '@/widgets/version-compare/model/comparison'
import { useShortcuts } from '@/shared/lib/shortcuts'
import { clearScreenPanels, setScreenPanels } from '@/widgets/workbench-shell/model/screenPanels'
import { useResolvedTheme } from '@/shared/lib/theme'
import { useVersionAnalysis } from '@/pages/workspace/model/analysis'
import { JOB_LABELS, sheetOf } from '@/entities/build/model/workspace'
import type { Cell, ViewerStats } from '@/entities/viewer/ui/BuildViewer'
import type { ViewName } from '@/entities/viewer/model/look'
import { runJob, useRunOptions } from '@/entities/job/model/run'
import { WorkspaceCompare, type ComparisonMode } from '@/widgets/version-compare/ui/Compare'
import { WorkspaceToolbar, type WorkspaceView } from './Toolbar'
import { CanvasState, SheetView, Stage3D } from './Canvas'
import { Editor, type EditorTab } from './Editor'
import { ActivityPane } from './Activity'
import { DeleteVersion, DraftSettings, StopJob, UpgradeTarget } from './dialogs'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { ImportSchematicDialog } from '@/features/import-schematic/ui/ImportSchematic'
import { useBlockEditor } from '@/widgets/block-editor/model/editor'

const EMPTY_STATS: ViewerStats = { dims: null, loadMs: 0 }
type Ping = { cell: Cell; t: number } | null

export function Workspace(): ReactElement {
  const { name } = useParams({ from: '/build/$name' })
  return <BuildWorkspace key={name} name={name} />
}

function BuildWorkspace({ name }: { name: string }): ReactElement {
  const availability = useAvailability().data
  const engine = !!availability?.features.engine.ok
  const { data: build, isLoading, error: buildError, refetch } = useBuild(name)
  const settings = useSettings().data
  const minecraftVersion =
    build?.minecraftVersion ?? settings?.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION
  const targetPack = useMinecraftPack(build ? minecraftVersion : undefined)
  const jobs = useJobs(useShallow((s) => s.jobs.filter((j) => j.spec.build === name)))
  const job = jobs[0]
  const running = job?.state === 'running'

  const [picked, setPicked] = useState<string | null>(null)
  const version = build?.versions.find((v) => v.path === picked) ?? build?.versions[0] ?? null
  const [tab, setTab] = useState<WorkspaceView>('3d')
  const [mode, setMode] = useState<ComparisonMode>('side-by-side')
  const [baseline, setBaseline] = useState<string | null>(null)
  const base = comparisonBaseline(build?.versions ?? [], version, baseline)
  const [compareVisited, setCompareVisited] = useState(false)
  if (tab === 'compare' && !compareVisited) setCompareVisited(true)
  const [view, setView] = useState<ViewName>('iso_se')
  const [stats, setStats] = useState<ViewerStats>(EMPTY_STATS)
  const [clipY, setClipY] = useState<number | null>(null)
  const [focus, setFocus] = useState<Ping>(null)
  const [editorTab, setEditorTab] = useState<EditorTab>('edit')
  const [draftOpen, setDraftOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importDraft, setImportDraft] = useState<string>()
  const [doomed, setDoomed] = useState<string | null>(null)
  const [stopAsk, setStopAsk] = useState(false)
  const [shownSheet, setShownSheet] = useState<string | null>(null)
  const importDraftFailed =
    !!importDraft &&
    job?.spec.part === 'proto' &&
    job.spec.name === importDraft &&
    (job.state === 'failed' || job.state === 'cancelled')
  useEffect(() => {
    if (importDraftFailed)
      toast.error('Part imported. Generate a draft to see it in 3D.', { id: importDraft })
  }, [importDraft, importDraftFailed])
  const moreTrigger = useRef<HTMLButtonElement>(null)
  // the Editor and Activity are shell docks; this screen draws into them through portals
  const [editorHost, setEditorHost] = useState<HTMLElement | null>(null)
  const [activityHost, setActivityHost] = useState<HTMLElement | null>(null)
  const [editorContent] = useState(() => (
    <div ref={setEditorHost} className="flex h-full min-h-0 flex-col" />
  ))
  const [activityContent] = useState(() => <div ref={setActivityHost} className="h-full min-h-0" />)
  const activityBadgeTone =
    job?.state === 'running' ? 'running' : job?.state === 'failed' ? 'danger' : undefined
  const activityBadgeLabel =
    job?.state === 'running'
      ? job.stage
        ? `${JOB_LABELS[job.spec.part]}: ${job.stage}`
        : `${JOB_LABELS[job.spec.part]} running`
      : job?.state === 'failed'
        ? `${JOB_LABELS[job.spec.part]} failed`
        : undefined
  const panels = useMemo<WorkbenchPanel[]>(
    () => [
      {
        id: 'editor',
        side: 'right',
        title: 'Editor',
        icon: PencilRuler,
        keys: 'Ctrl+I',
        size: '--dock-editor',
        defaultOpen: true,
        content: editorContent
      },
      {
        id: 'activity',
        side: 'bottom',
        title: 'Activity',
        icon: Activity,
        keys: 'Ctrl+`',
        size: '--dock-activity',
        badge: activityBadgeTone ? 'dot' : undefined,
        badgeTone: activityBadgeTone,
        badgeLabel: activityBadgeLabel,
        content: activityContent
      }
    ],
    [editorContent, activityContent, activityBadgeTone, activityBadgeLabel]
  )
  useEffect(() => {
    setScreenPanels(panels)
  }, [panels])
  useEffect(() => clearScreenPanels, [])
  const height = stats.dims?.[1] ?? 0

  // a version this session wrote opens at once
  const wrote = lastOf(job).wrote?.path
  const [previousWrite, setPreviousWrite] = useState(wrote)
  if (previousWrite !== wrote) {
    setPreviousWrite(wrote)
    if (wrote) setPicked(wrote)
  }
  // the agent showed a version or a preview sheet (MCP show / show_sheet): consume once so
  // reopening the Workspace tab later returns to 3D mode instead of replaying a stale preview
  const shown = useShow()
  const [previousShow, setPreviousShow] = useState<typeof shown | null>(null)
  if (previousShow !== shown) {
    setPreviousShow(shown)
    const match = matchShow(shown, name)
    if (match && 'path' in match) {
      setPicked(match.path)
      setTab('3d')
    } else if (match && 'sheet' in match) {
      setShownSheet(match.sheet)
      setTab('sheet')
    }
  }
  useEffect(() => {
    if (matchShow(shown, name)) clearShow(shown)
  }, [name, shown])

  const writer = jobs.find((j) => version && lastOf(j).wrote?.path === version.path)
  const jobCounts = writer && lastOf(writer).lint?.counts
  const theme = useResolvedTheme()
  const linter = settings?.linter ?? DEFAULT_LINTER_SETTINGS
  const saveSettings = useSaveSettings()
  const a = useVersionAnalysis({
    version,
    engine,
    jobCounts,
    anchor: writer?.spec.part !== 'dump' && writer?.spec.sx != null ? 'edges' : undefined,
    theme,
    linter
  })
  // hand edits draw over the newest version and are made there; other versions show their files as they are
  const edit = useBlockEditor({
    build: name,
    source: a.source,
    active: tab === '3d',
    origin: version?.origin,
    hasVersion: !!version,
    newest: !!version && version.path === build?.versions[0]?.path,
    minecraftVersion: a.minecraftVersion ?? minecraftVersion,
    pack: a.pack,
    onSelect: a.onPick,
    selectParts: a.partsView
  })
  const [previousSource, setPreviousSource] = useState(a.source)
  if (previousSource !== a.source) {
    setPreviousSource(a.source)
    setStats(EMPTY_STATS)
    setClipY(null)
    setFocus(null)
    setShownSheet(null)
  }

  useReportWorkspace(
    name,
    version?.path ?? null,
    tab === 'compare' && mode === 'changes' ? 'diff' : tab,
    a.pick,
    a.names
  )

  const run = useRunOptions((s) => s.byBuild[name]) ?? {}
  const setRun = useRunOptions((s) => s.set)
  const canDraft = !running && engine
  const canCheck = !running && engine && linter.enabled && hasEnabledLintRule(linter.rules)
  const onLinterEnabled = (enabled: boolean): void =>
    saveSettings.mutate({ linter: { ...linter, enabled } })
  const onLintRule = (rule: LintRule, enabled: boolean): void =>
    saveSettings.mutate({ linter: { ...linter, rules: { ...linter.rules, [rule]: enabled } } })
  const start = (part: 'proto' | 'check'): void =>
    void runJob(name, part, {
      ...run,
      noRender:
        part === 'proto' &&
        (run.noRender || !targetPack.data || !availability?.requirements.browser.ok)
    })
  const showView = (next: WorkspaceView, nextMode?: ComparisonMode): void => {
    setTab(next)
    if (nextMode) setMode(nextMode)
  }
  const ping = (set: (p: Ping) => void, cell: Cell): void => {
    setTab('3d')
    setClipY(null)
    set({ cell, t: performance.now() })
  }
  const askAgent = (): void => {
    if (!version) return
    useAskParts.setState({ ask: { build: name, version: version.path, parts: a.chosen } })
    useAgentPrefs.setState({ open: true })
  }

  useShortcuts([
    { keys: '1', label: '3D view', group: 'Workspace', run: () => showView('3d') },
    { keys: '2', label: 'Preview', group: 'Workspace', run: () => showView('sheet') },
    {
      keys: '3',
      label: 'Compare side by side',
      group: 'Workspace',
      run: () => showView('compare', 'side-by-side')
    },
    {
      keys: '4',
      label: 'Highlight changes',
      group: 'Workspace',
      run: () => showView('compare', 'changes')
    },
    {
      keys: 'Ctrl+Enter',
      label: 'Generate draft',
      group: 'Workspace',
      run: () => canDraft && start('proto')
    },
    running && {
      keys: 'Escape',
      label: 'Stop the running build',
      group: 'Workspace',
      run: (e) => {
        // Escape that closes a menu or popover is not a request to stop
        if (e.target instanceof Element && e.target.closest('[role=menu], [role=listbox]')) return
        setStopAsk(true)
      }
    }
  ])

  const displayName = build?.displayName || name
  const editor = (
    <Editor
      tab={editorTab}
      onTab={setEditorTab}
      a={a}
      build={displayName}
      edit={edit}
      onShowNewest={() => setPicked(null)}
      version={version}
      engine={engine}
      linter={linter}
      onLinterEnabled={onLinterEnabled}
      onLintRule={onLintRule}
      jobCounts={jobCounts}
      canDraft={canDraft}
      onDraft={() => start('proto')}
      canCheck={canCheck}
      onCheck={() => start('check')}
      onLocate={(cell) => ping(setFocus, cell)}
      onAsk={askAgent}
    />
  )
  const standIn = (
    <CanvasState
      name={displayName}
      error={buildError}
      loading={isLoading}
      missing={!build}
      empty={!version}
      onRetry={() => void refetch()}
      canDraft={canDraft}
      onDraft={() => start('proto')}
      onDraftSettings={() => setDraftOpen(true)}
    />
  )
  const sheet = shownSheet ?? (version ? sheetOf(version) : build?.sheet)
  const panel = 'flex min-h-0 flex-1 flex-col'

  return (
    <div className="flex h-full min-w-0 flex-col">
      <WorkspaceToolbar
        name={displayName}
        onUpgradeTarget={() => setUpgradeOpen(true)}
        canUpgradeTarget={!!build && !running}
        versions={build?.versions ?? []}
        version={version}
        onVersion={setPicked}
        view={tab}
        onView={(v) => showView(v)}
        mode={mode}
        onMode={setMode}
        base={base}
        onBase={setBaseline}
        canDraft={canDraft}
        onDraft={() => start('proto')}
        onDraftSettings={() => setDraftOpen(true)}
        canImport={!!build && engine && !running}
        onImport={() => setImportOpen(true)}
        canDelete={!!version && !running}
        onDelete={() => version && setDoomed(version.path)}
        moreRef={moreTrigger}
        onMenuCloseFocus={() => draftOpen || importOpen || upgradeOpen || !!doomed}
      />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col bg-surface-viewer">
            <section aria-label="3D view" className={panel} hidden={tab !== '3d'}>
              {buildError || isLoading || !build || !version ? (
                standIn
              ) : (
                <Stage3D
                  a={a}
                  view={view}
                  onViewChange={setView}
                  clipY={clipY}
                  onClip={setClipY}
                  height={height}
                  focus={focus}
                  onStats={setStats}
                  edit={edit}
                />
              )}
            </section>
            {tab === 'sheet' && (
              <section aria-label="Preview" className={panel}>
                <SheetView
                  key={sheet}
                  src={sheet ? buildUrl(sheet, Math.round(build?.mtime ?? 0)) : null}
                />
              </section>
            )}
            {compareVisited && (
              <section aria-label="Compare" className={panel} hidden={tab !== 'compare'}>
                <WorkspaceCompare
                  versions={build?.versions ?? []}
                  version={version}
                  base={base}
                  view={view}
                  clipY={clipY}
                  mode={mode}
                  onViewChange={setView}
                  active={tab === 'compare'}
                />
              </section>
            )}
          </div>
        </div>
      </div>
      {editorHost && createPortal(editor, editorHost)}
      {activityHost && createPortal(<ActivityPane job={job} stats={stats} />, activityHost)}
      <DraftSettings
        open={draftOpen}
        onOpenChange={setDraftOpen}
        value={run}
        onChange={(value) => setRun(name, value)}
        onRun={() => start('proto')}
        canRun={canDraft}
        onClosed={() => moreTrigger.current?.focus()}
      />
      <UpgradeTarget
        name={name}
        current={minecraftVersion}
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        onClosed={() => moreTrigger.current?.focus()}
      />
      <ImportSchematicDialog
        build={name}
        open={importOpen}
        onOpenChange={setImportOpen}
        onClosed={() => moreTrigger.current?.focus()}
        onImported={(draft) => {
          setImportDraft(draft)
          showView('3d')
        }}
      />
      <DeleteVersion
        path={doomed}
        onCancel={() => setDoomed(null)}
        onClosed={() => moreTrigger.current?.focus()}
        onConfirm={(path) =>
          deleteVersion(path, () => {
            if (path === picked) setPicked(null)
          })
        }
      />
      <StopJob
        what={job ? JOB_LABELS[job.spec.part] : 'Build'}
        open={stopAsk && running}
        onOpenChange={setStopAsk}
        onStop={() => job && cancelJob(job.id)}
      />
    </div>
  )
}
