// The app frame (S3 Workbench): title bar, the build's screen tabs and docks (including the Assistant
// dock on build tabs that enable it). App pages (Builds, Settings, Documentation, Labs) get the same
// title bar with no tabs and no docks.
// The app-wide listeners (review requests, show / show_sheet, the MCP status report, toasts) are in
// ../model/subscriptions.
import { lazy, Profiler, Suspense, useEffect, useState, type ReactElement } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { DropdownMenu } from 'radix-ui'
import {
  BookOpen,
  Box,
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
import { WorkbenchShell } from '@/widgets/workbench-shell/ui/WorkbenchShell'
import { TitleBar, type Crumb } from '@/widgets/workbench-shell/ui/TitleBar'
import { IconButton } from '@/shared/ui/common/parts'
import { menuItem } from '@/shared/ui/common/styles'
import { useWorkbench } from '@/widgets/workbench-shell/model/context'
import type { WorkbenchPanel } from '@/widgets/workbench-shell/ui/Dock'
import { useBuilds } from '@/entities/build/model/builds'
import { useReview } from '@/entities/review/model/review'
import { useVariants } from '@/features/agent-chat/model/variants'
import { useAgent, useAgentPrefs } from '@/features/agent-chat/model/agent'
import { useShortcuts } from '@/shared/lib/shortcuts'
import { useScreenPanels } from '@/widgets/workbench-shell/model/screenPanels'
import { SetupChip, SetupMenuItem } from '@/entities/availability/ui/SetupChip'
import { useSetupNotices } from '@/entities/availability/model/setupFix'
import { useAppSubscriptions } from '../model/subscriptions'
import { BUILD_ROUTE, BUILD_SCREENS, hasChatDock, type ScreenId } from '../model/screens'
import { RenderStudioPortal } from '@/features/render-studio/ui/RenderStudioPortal'
import { recordCommit } from '@/widgets/perf-hud/model/perf'
import { useSheetViewer } from '@/features/render-studio/model/store'

// dev only: production builds drop the HUD chunk with the dead branch
const PerfHud = import.meta.env.DEV ? lazy(() => import('@/widgets/perf-hud/ui/PerfHud')) : null
// Not needed for the first screen: the chat dock (and its markdown stack), the sheet zoom viewer, the palette
const AgentPanel = lazy(() =>
  import('@/features/agent-chat/ui/Agent').then((m) => ({ default: m.AgentPanel }))
)
const SheetViewerHost = lazy(() =>
  import('@/features/render-studio/ui/SheetViewerLightbox').then((m) => ({
    default: m.SheetViewerHost
  }))
)
const Palette = lazy(() => import('./Palette'))

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
  useEffect(() => void performance.mark('bs:shell-mounted'), [])
  // null until first opened: the palette's chunk loads then
  const [palette, setPalette] = useState<boolean | null>(null)
  const sheetOpen = useSheetViewer((s) => !!s.item)
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
    content: (
      <Suspense fallback={null}>
        <AgentPanel />
      </Suspense>
    )
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
        {import.meta.env.DEV ? (
          <Profiler id="screen" onRender={recordCommit}>
            <Outlet />
          </Profiler>
        ) : (
          <Outlet />
        )}
      </WorkbenchShell>
      {palette !== null && (
        <Suspense fallback={null}>
          <Palette open={palette} setOpen={setPalette} current={current} />
        </Suspense>
      )}
      <RenderStudioPortal />
      {sheetOpen && (
        <Suspense fallback={null}>
          <SheetViewerHost />
        </Suspense>
      )}
      <Toaster position="bottom-right" />
      {PerfHud && (
        <Suspense fallback={null}>
          <PerfHud />
        </Suspense>
      )}
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
