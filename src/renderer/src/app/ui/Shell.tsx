// The app frame (S3 Workbench): title bar, the build's screen tabs and docks (including the Assistant
// dock on build tabs that enable it). App pages (Builds, Settings, Documentation, Labs) get the same
// title bar with no tabs and no docks.
// The app-wide listeners (review requests, show / show_sheet, the MCP status report, toasts) are in
// ../model/subscriptions.
import { useEffect, useState, type ReactElement } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { DropdownMenu } from 'radix-ui'
import {
  BookOpen,
  Box,
  FlaskConical,
  GitBranch,
  Images,
  Map as MapIcon,
  MessageCircle,
  Rocket,
  ScanEye,
  ScrollText,
  Settings as SettingsIcon,
  type LucideIcon
} from 'lucide-react'
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
import { TitleBar, type Crumb } from '@/widgets/workbench-shell/ui/TitleBar'
import { IconButton } from '@/shared/ui/common/parts'
import { menuItem } from '@/shared/ui/common/styles'
import { useWorkbench } from '@/widgets/workbench-shell/model/context'
import type { WorkbenchPanel } from '@/widgets/workbench-shell/ui/Dock'
import { useBuilds } from '@/entities/build/model/builds'
import { cancelJob, useJobs } from '@/entities/job/model/jobs'
import { useReview } from '@/entities/review/model/review'
import { useVariants } from '@/features/agent-chat/model/variants'
import { useAgent, useAgentPrefs } from '@/features/agent-chat/model/agent'
import { STATE_LABEL, buildState, useGalleryDialog } from '@/entities/build/model/gallery'
import { useShortcuts } from '@/shared/lib/shortcuts'
import { useScreenPanels } from '@/widgets/workbench-shell/model/screenPanels'
import { runJob, useRunOptions } from '@/entities/job/model/run'
import { AgentPanel } from '@/features/agent-chat/ui/Agent'
import { SetupChip, SetupMenuItem } from '@/entities/availability/ui/SetupChip'
import { useSetupNotices } from '@/entities/availability/model/setupFix'
import { useAppSubscriptions } from '../model/subscriptions'
import { BUILD_ROUTE, BUILD_SCREENS, hasChatDock, type ScreenId } from '../model/screens'
import { RenderStudioPortal } from '@/features/render-studio/ui/RenderStudioPortal'
import { SheetViewerHost } from '@/features/render-studio/ui/SheetViewerLightbox'
import { openRenderStudio } from '@/features/render-studio/model/store'

const SCREEN_ICONS: Record<ScreenId, LucideIcon> = {
  workspace: Box,
  review: ScanEye,
  variants: GitBranch,
  ship: Rocket,
  site: MapIcon,
  refs: Images,
  log: ScrollText
}

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
  const labelOf = (id: string): string => builds.find((b) => b.name === id)?.displayName ?? id
  const crumbs: Crumb[] = current
    ? [
        {
          label: labelOf(current),
          menu: {
            label: 'Switch build',
            items: builds.map((b) => ({ id: b.name, label: b.displayName || b.name })),
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
  const chatEnabled = hasChatDock(current, screen)
  const panels: WorkbenchPanel[] = page
    ? []
    : chatEnabled
      ? [...screenPanels, assistant]
      : screenPanels

  return (
    <>
      <WorkbenchShell
        layoutId={page ? 'page' : 'build'}
        titleBar={
          <TitleBar
            crumbs={crumbs}
            onHome={() => void navigate({ to: '/' })}
            onSearch={() => setPalette(true)}
            setup={<SetupChip notices={notices} />}
            actions={links.map((l) => (
              <IconButton
                key={l.to}
                size="sm"
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
            : BUILD_SCREENS.map((s) =>
                s.id === 'review' && reviewAsked
                  ? {
                      id: s.id,
                      label: s.label,
                      icon: SCREEN_ICONS[s.id],
                      group: s.group,
                      badge: 'dot' as const,
                      badgeLabel: 'The agent is waiting',
                      badgeTone: 'attention' as const
                    }
                  : s.id === 'variants' && lanesAsking
                    ? {
                        id: s.id,
                        label: s.label,
                        icon: SCREEN_ICONS[s.id],
                        group: s.group,
                        badge: lanesAsking,
                        badgeLabel: `${lanesAsking} ${lanesAsking === 1 ? 'lane needs' : 'lanes need'} you`,
                        badgeTone: 'attention' as const
                      }
                    : { id: s.id, label: s.label, icon: SCREEN_ICONS[s.id], group: s.group }
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
        skipLabel="Skip to the page"
      >
        <AssistantBridge enabled={chatEnabled} />
        <Outlet />
      </WorkbenchShell>
      <Palette open={palette} setOpen={setPalette} current={current} />
      <RenderStudioPortal />
      <SheetViewerHost />
      <Toaster position="bottom-right" />
    </>
  )
}

/** A screen that asks for the assistant (useAgentPrefs.open) brings its dock to the front once Chat is available. */
function AssistantBridge({ enabled }: { enabled: boolean }): null {
  const { dock } = useWorkbench()
  const asked = useAgentPrefs((s) => s.open)
  useEffect(() => {
    if (!asked || !enabled) return
    dock({ type: 'open', id: 'assistant' })
    useAgentPrefs.setState({ open: false })
  }, [asked, enabled, dock])
  return null
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
  const labelOf = (id: string): string => builds.find((b) => b.name === id)?.displayName ?? id
  const currentLabel = current ? labelOf(current) : null
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
          <CommandGroup heading={currentLabel ?? current}>
            {(['proto', 'check'] as const).map((part) => (
              <CommandItem key={part} onSelect={go(() => runJob(current, part, opts))}>
                {{ proto: 'Generate draft', check: 'Check build' }[part]}: {currentLabel}
                {part === 'proto' && <CommandShortcut>Ctrl Enter</CommandShortcut>}
              </CommandItem>
            ))}
            <CommandItem
              onSelect={go(
                () => void navigate({ to: '/build/$name/ship', params: { name: current } })
              )}
            >
              Export: {currentLabel}
            </CommandItem>
            <CommandItem onSelect={go(() => openRenderStudio({ build: current }))}>
              Render images: {currentLabel}
              <CommandShortcut>Ctrl Shift E</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}
        {running.length > 0 && (
          <CommandGroup heading="Running">
            {running.map((j) => (
              <CommandItem key={j.id} onSelect={go(() => cancelJob(j.id))}>
                Stop build activity: {labelOf(j.spec.build)}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Builds">
          {builds.map((b) => {
            const state = STATE_LABEL[buildState(b, busy, reviews)]
            const display = b.displayName || b.name
            return (
              <CommandItem
                key={b.name}
                value={`${display} ${b.name} ${state} ${b.status[0] ?? ''}`}
                onSelect={go(() => void navigate({ to: '/build/$name', params: { name: b.name } }))}
              >
                <span className="truncate font-medium">{display}</span>
                <span className="shrink-0 text-fg-muted">· {state}</span>
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
