// The app frame (S3 Workbench): title bar, the build's screen tabs and Assistant dock, status bar. App pages
// (Builds, Settings, Documentation, Labs) get the same title bar and status bar with no tabs; the Assistant
// is their only dock.
// The app-wide listeners (review requests, show / show_sheet, the MCP status report, toasts) are in
// ../model/subscriptions.
import { useEffect, useState, type ReactElement } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { DropdownMenu } from 'radix-ui'
import { MessageCircle, BookOpen, FlaskConical, Settings as SettingsIcon } from 'lucide-react'
import { Toaster } from '@/shared/ui/primitives/sonner'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut
} from '@/shared/ui/primitives/command'
import { WorkbenchShell } from '@/widgets/workbench-shell/ui/WorkbenchShell'
import { PanelToggle } from '@/widgets/workbench-shell/ui/PanelToggle'
import { TitleBar, type Crumb } from '@/widgets/workbench-shell/ui/TitleBar'
import {
  StatusBar,
  type AssistantState,
  type StatusJob
} from '@/widgets/workbench-shell/ui/StatusBar'
import { IconButton } from '@/shared/ui/common/parts'
import { menuItem } from '@/shared/ui/common/styles'
import { useWorkbench } from '@/widgets/workbench-shell/model/context'
import type { WorkbenchPanel } from '@/widgets/workbench-shell/ui/Dock'
import { formatElapsed, useElapsed } from '@/shared/ui/common/time'
import { useAvailability } from '@/entities/availability/model/availability'
import { useBuilds } from '@/entities/build/model/builds'
import { PART_LABEL, cancelJob, useJobs } from '@/entities/job/model/jobs'
import { useReview } from '@/entities/review/model/review'
import { useVariants } from '@/features/agent-chat/model/variants'
import { useAgent, useAgentPrefs } from '@/features/agent-chat/model/agent'
import { PROVIDER_TEXT } from '@/features/agent-chat/model/providers'
import { STATE_LABEL, buildState, useGalleryDialog } from '@/entities/build/model/gallery'
import { useShortcuts } from '@/shared/lib/shortcuts'
import { useScreenPanels } from '@/widgets/workbench-shell/model/screenPanels'
import { runJob, useRunOptions } from '@/entities/job/model/run'
import { AgentPanel } from '@/features/agent-chat/ui/Agent'
import { SetupChip, SetupMenuItem } from '@/entities/availability/ui/SetupChip'
import { useSetupNotices } from '@/entities/availability/model/setupFix'
import { useAppSubscriptions } from '../model/subscriptions'
import { useEdits } from '@/entities/block-edit/model/store'

const SCREENS = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'review', label: 'Review' },
  { id: 'variants', label: 'Variants' },
  { id: 'ship', label: 'Export' },
  { id: 'site', label: 'Location' },
  { id: 'refs', label: 'Refs' },
  { id: 'log', label: 'Log' }
] as const
type ScreenId = (typeof SCREENS)[number]['id']
const BUILD_ROUTE = /^\/build\/(.+?)(?:\/(review|log|ship|site|refs|variants))?$/

export function Shell(): ReactElement {
  const [palette, setPalette] = useState(false)
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const match = BUILD_ROUTE.exec(pathname)
  const current = match ? decodeURIComponent(match[1]) : null
  const screen: ScreenId = (match?.[2] as ScreenId | undefined) ?? 'workspace'
  const builds = useBuilds().data ?? []
  const notices = useSetupNotices()
  const needsYou = useAgent((s) => Object.values(s.threads).reduce((n, t) => n + t.asks.length, 0))
  const reviewAsked = useReview((s) => !!current && !!s.drafts[current]?.requestId)
  const lanesAsking = useVariants((s) =>
    s.build === current ? Object.values(s.lanes).filter((l) => l.asks.length > 0).length : 0
  )

  useShortcuts([
    {
      keys: 'Ctrl+K',
      label: 'Search builds and commands',
      group: 'App',
      inModals: true,
      run: () => setPalette((o) => !o)
    },
    {
      keys: 'Ctrl+,',
      label: 'Settings',
      group: 'App',
      run: () => void navigate({ to: '/settings' })
    }
  ])

  useAppSubscriptions(pathname, current)

  const page = !current
  const crumbs: Crumb[] = current
    ? [
        { label: 'Builds', onSelect: () => void navigate({ to: '/' }) },
        {
          label: current,
          menu: {
            label: 'Switch build',
            items: builds.map((b) => ({ id: b.name, label: b.name })),
            value: current,
            onSelect: (name) => void navigate({ to: '/build/$name', params: { name } })
          }
        }
      ]
    : pathname.startsWith('/docs')
      ? [
          { label: 'Settings', onSelect: () => void navigate({ to: '/settings' }) },
          { label: 'Documentation' }
        ]
      : [
          {
            label: pathname.startsWith('/settings')
              ? 'Settings'
              : pathname.startsWith('/labs')
                ? 'Labs'
                : pathname.startsWith('/kit')
                  ? 'UI kit'
                  : 'Builds'
          }
        ]
  const links = [
    { to: '/labs', icon: FlaskConical, label: 'Labs: palette, kit catalog, prefabs' },
    { to: '/docs', icon: BookOpen, label: 'Documentation' },
    { to: '/settings', icon: SettingsIcon, label: 'Settings', keys: 'Ctrl+,' }
  ] as const
  const screenPanels = useScreenPanels()
  const assistant: WorkbenchPanel = {
    id: 'assistant',
    side: 'right',
    title: 'Chat',
    icon: MessageCircle,
    keys: 'Ctrl+J',
    size: '--dock-assistant',
    badge: needsYou || undefined,
    badgeLabel: `${needsYou} ${needsYou === 1 ? 'ask needs' : 'asks need'} you`,
    badgeTone: 'attention',
    content: <AgentPanel />
  }
  const panels: WorkbenchPanel[] = page ? [assistant] : [...screenPanels, assistant]

  return (
    <>
      <WorkbenchShell
        layoutId={page ? 'page' : 'build'}
        titleBar={
          <TitleBar
            crumbs={crumbs}
            panelAction={page && <PanelToggle panel={assistant} />}
            onHome={() => void navigate({ to: '/' })}
            onSearch={() => setPalette(true)}
            setup={<SetupChip notices={notices} />}
            actions={links.map((l) => (
              <IconButton
                key={l.to}
                icon={l.icon}
                label={l.label}
                keys={'keys' in l ? l.keys : undefined}
                onClick={() => void navigate({ to: l.to })}
              />
            ))}
            overflow={
              <>
                <SetupMenuItem notices={notices} />
                {links.map((l) => (
                  <DropdownMenu.Item
                    key={l.to}
                    className={menuItem}
                    onSelect={() => void navigate({ to: l.to })}
                  >
                    <l.icon aria-hidden="true" />
                    {l.label.split(':')[0]}
                  </DropdownMenu.Item>
                ))}
              </>
            }
          />
        }
        screens={
          page
            ? []
            : SCREENS.map((s) =>
                s.id === 'review' && reviewAsked
                  ? {
                      ...s,
                      badge: 'dot' as const,
                      badgeLabel: 'The agent is waiting',
                      badgeTone: 'attention' as const
                    }
                  : s.id === 'variants' && lanesAsking
                    ? {
                        ...s,
                        badge: lanesAsking,
                        badgeLabel: `${lanesAsking} ${lanesAsking === 1 ? 'lane needs' : 'lanes need'} you`,
                        badgeTone: 'attention' as const
                      }
                    : s
              )
        }
        screen={page ? '' : screen}
        onScreenChange={(id) =>
          current &&
          void (id === 'workspace'
            ? navigate({ to: '/build/$name', params: { name: current } })
            : navigate({
                to: `/build/$name/${id as Exclude<ScreenId, 'workspace'>}`,
                params: { name: current }
              }))
        }
        panels={panels}
        status={<Status current={current} activity={!!current && screen === 'workspace'} />}
        skipLabel="Skip to the page"
      >
        <AssistantBridge />
        <Outlet />
      </WorkbenchShell>
      <Palette open={palette} setOpen={setPalette} current={current} />
      <Toaster position="bottom-right" />
    </>
  )
}

/** A screen that asks for the assistant (useAgentPrefs.open) brings its dock to the front. */
function AssistantBridge(): null {
  const { dock } = useWorkbench()
  const asked = useAgentPrefs((s) => s.open)
  useEffect(() => {
    if (!asked) return
    dock({ type: 'open', id: 'assistant' })
    useAgentPrefs.setState({ open: false })
  }, [asked, dock])
  return null
}

function Status({
  current,
  activity
}: {
  current: string | null
  activity: boolean
}): ReactElement {
  const navigate = useNavigate()
  const { dock } = useWorkbench()
  const jobs = useJobs((s) => s.jobs)
  const job = jobs.find((j) => j.state === 'running') ?? jobs[0]
  const live = job?.state === 'running'
  const elapsed = useElapsed(job?.started, live)
  const availability = useAvailability()
  const primary = useAgent((s) => s.primary)
  const asks = useAgent((s) => Object.values(s.threads).reduce((n, t) => n + t.asks.length, 0))
  const handCount = useEdits((s) => (s.build === current ? s.history.layer.size : 0))
  const handSave = useEdits((s) => (s.build === current ? s.save : 'saved'))
  const assistant: AssistantState =
    primary.status === 'off'
      ? 'off'
      : asks
        ? 'waiting'
        : primary.status === 'idle'
          ? 'idle'
          : 'working'
  const status: StatusJob | null = job
    ? {
        label: `${job.spec.build} · ${PART_LABEL[job.spec.part]}`,
        stage: live ? job.stage : undefined,
        elapsed: formatElapsed(
          live ? elapsed : Math.round(((job.ended ?? job.started) - job.started) / 1000)
        ),
        state: job.state,
        onStop: live ? () => cancelJob(job.id) : undefined
      }
    : null
  // jobs are newest first; the build's Activity dock has the log, another build opens on its Workspace
  const recent: StatusJob[] = jobs.slice(0, 4).map((j) => ({
    label: `${j.spec.build} · ${PART_LABEL[j.spec.part]}`,
    state: j.state,
    // a running job's live clock is in the bar itself
    elapsed: j.ended ? formatElapsed(Math.round((j.ended - j.started) / 1000)) : undefined,
    onOpen: () =>
      j.spec.build === current
        ? dock({ type: 'open', id: 'activity' })
        : void navigate({ to: '/build/$name', params: { name: j.spec.build } })
  }))
  return (
    <StatusBar
      activity={activity}
      handEdits={
        handCount || handSave !== 'saved' ? { count: handCount, save: handSave } : undefined
      }
      job={status}
      recent={recent}
      needsYou={asks}
      onNeedsYou={() => useAgentPrefs.setState({ open: true })}
      engine={
        availability.data
          ? availability.data.requirements.engine.ok
            ? 'ready'
            : 'offline'
          : undefined
      }
      assistant={assistant}
      assistantName={PROVIDER_TEXT[primary.provider].name}
    />
  )
}

function Palette({
  open,
  setOpen,
  current
}: {
  open: boolean
  setOpen: (o: boolean) => void
  current: string | null
}): ReactElement {
  const navigate = useNavigate()
  const builds = useBuilds().data ?? []
  const jobs = useJobs((s) => s.jobs)
  const drafts = useReview((s) => s.drafts)
  const opts = useRunOptions((s) => (current ? s.byBuild[current] : undefined)) ?? {}
  const go = (f: () => void) => () => {
    setOpen(false)
    f()
  }
  const running = jobs.filter((j) => j.state === 'running')
  const busy = new Set(running.map((j) => j.spec.build))
  const reviews = new Set(
    Object.entries(drafts)
      .filter(([, d]) => d.requestId)
      .map(([b]) => b)
  )
  const gallery = (open: 'new' | 'import'): void => {
    void navigate({ to: '/' })
    useGalleryDialog.setState({ open })
  }
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search builds or run a command" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        {current && (
          <CommandGroup heading={current}>
            {(['proto', 'check'] as const).map((part) => (
              <CommandItem key={part} onSelect={go(() => runJob(current, part, opts))}>
                {{ proto: 'Generate draft', check: 'Check build' }[part]}: {current}
                {part === 'proto' && <CommandShortcut>Ctrl Enter</CommandShortcut>}
              </CommandItem>
            ))}
            <CommandItem
              onSelect={go(
                () => void navigate({ to: '/build/$name/ship', params: { name: current } })
              )}
            >
              Export: {current}
            </CommandItem>
          </CommandGroup>
        )}
        {running.length > 0 && (
          <CommandGroup heading="Running">
            {running.map((j) => (
              <CommandItem key={j.id} onSelect={go(() => cancelJob(j.id))}>
                Stop build activity: {j.spec.build}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Builds">
          {builds.map((b) => {
            const state = STATE_LABEL[buildState(b, busy, reviews)]
            return (
              <CommandItem
                key={b.name}
                value={`${b.name} ${state} ${b.status[0] ?? ''}`}
                onSelect={go(() => void navigate({ to: '/build/$name', params: { name: b.name } }))}
              >
                <span className="font-mono">{b.name}</span>
                <span className="text-fg-muted">· {state}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandGroup heading="Commands">
          <CommandItem onSelect={go(() => gallery('new'))}>New build…</CommandItem>
          <CommandItem onSelect={go(() => gallery('import'))}>Import builds…</CommandItem>
          <CommandItem onSelect={go(() => void navigate({ to: '/settings' }))}>
            Open Settings
            <CommandShortcut>Ctrl ,</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={go(() => void navigate({ to: '/' }))}>All builds</CommandItem>
          <CommandItem onSelect={go(() => void navigate({ to: '/labs' }))}>
            Labs: palette, kit catalog, prefabs
          </CommandItem>
          <CommandItem onSelect={go(() => void navigate({ to: '/docs' }))}>
            Documentation
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
