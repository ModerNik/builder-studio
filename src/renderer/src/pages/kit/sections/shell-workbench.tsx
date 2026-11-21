// The S3 Workbench shell at the four tiers, in a scaled frame: tiers follow the frame's width, so every
// layout shows here whatever the window size. Panel content is placeholder with the real labels.
import { useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { DropdownMenu } from 'radix-ui'
import {
  Activity,
  BookOpen,
  MessageCircle,
  FlaskConical,
  MessageSquareText,
  Settings,
  PencilRuler
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useContainerWidth } from '@/shared/lib/layout'
import { useShortcuts } from '@/shared/lib/shortcuts'
import { WorkbenchShell } from '@/widgets/workbench-shell/ui/WorkbenchShell'
import { TitleBar } from '@/widgets/workbench-shell/ui/TitleBar'
import { PanelToggle } from '@/widgets/workbench-shell/ui/PanelToggle'
import { EditorTabs } from '@/widgets/workbench-shell/ui/EditorTabs'
import { Tabs, TabsContent } from '@/shared/ui/primitives/tabs'
import { StatusBar } from '@/widgets/workbench-shell/ui/StatusBar'
import type { WorkbenchPanel } from '@/widgets/workbench-shell/ui/Dock'
import { IconButton } from '@/shared/ui/common/parts'
import {
  SetupNoticesChip,
  SetupNoticesMenuItem,
  type SetupNotice
} from '@/entities/availability/ui/SetupNotices'
import { chromeButton, menuItem } from '@/shared/ui/common/styles'
import { WorkspaceCanvas } from './shell-demo/WorkspaceCanvas'
import { SCREENS } from './shell-demo/data'

const NOTICES: SetupNotice[] = [
  {
    id: 'browser',
    label: 'Preview browser',
    detail: 'Unlocks preview images',
    action: 'Install',
    onFix: () => {}
  }
]

export const meta = { group: 'Shell', title: 'Workbench shell' }

const SIZES = [
  { id: 'fit', label: 'Fit', w: 0, h: 760, app: true },
  { id: '1920', label: '1920 app', w: 1920, h: 1080, app: true },
  { id: '1280', label: '1280 app', w: 1280, h: 800, app: true },
  { id: '768', label: '768 tablet', w: 768, h: 1024, app: false },
  { id: '390', label: '390 phone', w: 390, h: 844, app: false }
] as const
const TOUCH = {
  '--density-control': '2.75rem',
  '--density-control-sm': '2.25rem',
  '--density-row': '2.75rem',
  '--density-icon-button': '2.75rem',
  '--density-gap': '0.75rem'
} as CSSProperties

const BUILDS = ['stone_bridge', 'harbour_tower', 'spruce_mill']

/** A frame that renders its child at `w`×`h` and scales it down to the column width. */
export function DeviceFrame({
  w,
  h,
  children,
  style
}: {
  w: number
  h: number
  children: ReactNode
  style?: CSSProperties
}): ReactElement {
  const outer = useRef<HTMLDivElement>(null)
  const avail = useContainerWidth(outer)
  const width = w || avail || 1200
  const scale = avail ? Math.min(1, avail / width) : 1
  return (
    <div ref={outer} className="w-full">
      <div
        style={{ height: h * scale, width: width * scale }}
        className="max-w-full overflow-hidden rounded-lg border border-border-default"
      >
        <div
          style={{
            width,
            height: h,
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
            ...style
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function Placeholder({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <div className="space-y-3 p-3">
      <h3 className="text-xs text-fg-muted">{title}</h3>
      {children}
    </div>
  )
}

const PARTS = [
  ['piers', 64, 9],
  ['arch', 8, 14],
  ['deck', 64, 17],
  ['railings', 32, 22],
  ['lanterns', 8, 26]
] as const

function Editor(): ReactElement {
  return (
    <Tabs defaultValue="parts" className="gap-0">
      <EditorTabs />
      <TabsContent value="edit" className="p-3">
        Place, erase or pick blocks with the tools on the view.
      </TabsContent>
      <TabsContent value="checks" className="p-3">
        3 dark areas
      </TabsContent>
      <TabsContent value="materials" className="p-3">
        Stone bricks, oak planks, spruce fence, lanterns
      </TabsContent>
      <TabsContent value="parts">
        <Placeholder title="Parts · 5 parts · 176 blocks">
          <ul className="divide-y divide-border-subtle">
            {PARTS.map(([name, count, line]) => (
              <li key={name} className="flex h-(--density-row) items-center gap-2">
                <span className="flex-1">{name}</span>
                <span className="text-fg-secondary tabular-nums">{count}</span>
                <span className="w-8 text-right font-mono text-xs text-fg-muted">:{line}</span>
              </li>
            ))}
          </ul>
        </Placeholder>
      </TabsContent>
    </Tabs>
  )
}
function Assistant(): ReactElement {
  return (
    <div className="flex h-full flex-col">
      <Placeholder title="stone_bridge · round 3">
        <p className="rounded-lg bg-surface-raised p-2.5">
          Put a lantern on every fourth post instead of every fifth, and keep the railings spruce
          fence.
        </p>
        <p className="text-fg-secondary">
          Changing the spacing in the lanterns part from 5 to 4. The railings stay spruce fence.
          Starting a draft to check it.
        </p>
        <div className="rounded-lg border border-warning-subtle-border bg-warning-subtle p-2.5">
          <p className="font-medium">Run this command?</p>
          <code className="font-mono text-sm">python builds/stone_bridge/build.py check</code>
        </div>
      </Placeholder>
      <div className="mt-auto border-t border-border-subtle p-2">
        <textarea
          aria-label="Message the assistant"
          placeholder="Message the assistant"
          rows={2}
          className="w-full resize-none rounded-md border border-border-strong bg-surface-sunken p-2 outline-none placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-ring"
        />
      </div>
    </div>
  )
}
const LOG = [
  ['0:00', 'proto stone_bridge → out/stone_bridge_v4.litematic'],
  ['0:03', 'Generating blocks · 176 placed'],
  ['0:12', 'Generating blocks done'],
  ['0:12', 'Checking blocks'],
  ['0:19', 'Dark areas: 3 at 6 3 1 · 7 3 2 · 9 3 1']
]
function ActivityPane(): ReactElement {
  return (
    <ol className="p-2 font-mono text-xs">
      {LOG.map(([t, line], i) => (
        <li key={i} className="flex gap-3 py-0.5">
          <span className="text-fg-muted tabular-nums">{t}</span>
          <span className={i === LOG.length - 1 ? 'text-warning-text' : 'text-fg-secondary'}>
            {line}
          </span>
        </li>
      ))}
    </ol>
  )
}
function Feedback(): ReactElement {
  return (
    <Placeholder title="Round 3 · Pins (2)">
      <p>Every fourth post is right. The oak deck is too bright next to the stone.</p>
      <ol className="space-y-2">
        <li>
          <span className="font-mono text-xs text-fg-muted">1 · v4 · 4 6 0 · lantern</span>
          <p>Keep this one on the corner post.</p>
        </li>
        <li>
          <span className="font-mono text-xs text-fg-muted">2 · v4_oak · 7 4 1 · oak_planks</span>
          <p>Too bright against the bricks.</p>
        </li>
      </ol>
    </Placeholder>
  )
}

export function DemoWorkbench({
  review,
  page = false,
  preview
}: {
  review: boolean
  /** An app page (Gallery, Settings): no document tabs; the Assistant is the only dock. */
  page?: boolean
  preview?: { captionInset: number }
}): ReactElement {
  const [screen, setScreen] = useState(review ? 'review' : 'workspace')
  const [build, setBuild] = useState(BUILDS[0])
  const [running, setRunning] = useState(true)
  const [searched, setSearched] = useState(0)
  useShortcuts([
    { keys: 'Ctrl+K', label: 'Command palette', group: 'App', run: () => setSearched((n) => n + 1) }
  ])
  const panels: WorkbenchPanel[] = [
    ...(screen === 'review'
      ? [
          {
            id: 'feedback',
            title: 'Feedback',
            icon: MessageSquareText,
            side: 'right' as const,
            defaultOpen: true,
            size: '--dock-review',
            content: <Feedback />
          }
        ]
      : []),
    {
      id: 'editor',
      title: 'Editor',
      icon: PencilRuler,
      keys: 'Ctrl+I',
      side: 'right',
      defaultOpen: true,
      size: '--dock-editor',
      content: <Editor />
    },
    {
      id: 'assistant',
      title: 'Chat',
      icon: MessageCircle,
      keys: 'Ctrl+J',
      side: 'right',
      defaultOpen: true,
      size: '--dock-assistant',
      badge: 2,
      badgeLabel: '2 asks need you',
      badgeTone: 'attention',
      content: <Assistant />
    },
    {
      id: 'activity',
      title: 'Activity',
      icon: Activity,
      keys: 'Ctrl+`',
      side: 'bottom',
      defaultOpen: false,
      badge: 3,
      badgeLabel: '3 problems',
      content: <ActivityPane />
    }
  ]
  return (
    <WorkbenchShell
      layoutId={page ? 'kit-page' : `kit-${screen === 'review' ? 'review' : 'workspace'}`}
      preview={preview}
      skipLabel="Skip to the 3D view"
      screens={page ? [] : SCREENS}
      screen={screen}
      onScreenChange={setScreen}
      panels={page ? panels.filter((p) => p.id === 'assistant') : panels}
      titleBar={
        <TitleBar
          crumbs={
            page
              ? [{ label: 'Settings' }]
              : [
                  { label: 'Builds', onSelect: () => {} },
                  {
                    label: build,
                    menu: {
                      label: 'Switch build',
                      items: BUILDS.map((b) => ({ id: b, label: b })),
                      value: build,
                      onSelect: setBuild
                    }
                  }
                ]
          }
          panelAction={page && <PanelToggle panel={panels.find((p) => p.id === 'assistant')!} />}
          onHome={() => {}}
          onSearch={() => setSearched((n) => n + 1)}
          setup={<SetupNoticesChip notices={NOTICES} />}
          actions={
            <>
              <IconButton icon={FlaskConical} label="Labs" />
              <IconButton icon={BookOpen} label="Documentation" />
              <IconButton icon={Settings} label="Settings" />
            </>
          }
          overflow={
            <>
              <SetupNoticesMenuItem notices={NOTICES} onSelect={() => {}} />
              <DropdownMenu.Item className={menuItem}>
                <FlaskConical aria-hidden="true" />
                Labs
              </DropdownMenu.Item>
              <DropdownMenu.Item className={menuItem}>
                <BookOpen aria-hidden="true" />
                Documentation
              </DropdownMenu.Item>
              <DropdownMenu.Item className={menuItem}>
                <Settings aria-hidden="true" />
                Settings
              </DropdownMenu.Item>
            </>
          }
        />
      }
      status={
        <StatusBar
          activity={screen === 'workspace' && !page}
          job={
            running
              ? {
                  label: 'Generate draft',
                  stage: 'Checking blocks 2 of 5',
                  elapsed: '0:21',
                  state: 'running',
                  onStop: () => setRunning(false),
                  onOpen: () => {}
                }
              : null
          }
          problems={3}
          onProblems={() => {}}
          needsYou={2}
          onNeedsYou={() => {}}
          engine="ready"
          assistant="waiting"
          assistantName="Claude Code"
        />
      }
    >
      {page ? (
        <Placeholder title="Settings">
          <p className="text-fg-secondary">Chat is available in the title bar.</p>
        </Placeholder>
      ) : (
        <WorkspaceCanvas screen={screen} build={build} searched={searched} />
      )}
    </WorkbenchShell>
  )
}

export default function WorkbenchDemo(): ReactElement {
  const [size, setSize] = useState<(typeof SIZES)[number]['id']>('fit')
  const [touch, setTouch] = useState(false)
  const [review, setReview] = useState(false)
  const [page, setPage] = useState(false)
  const s = SIZES.find((x) => x.id === size)!
  return (
    <div className="space-y-3">
      <p className="max-w-prose text-fg-secondary">
        Tiers follow the shell’s own width: two right columns and a bottom dock at 1440 and up, one
        merged dock at 1100–1439, a panel sheet at 640–1099 and a full-screen sheet below 640.
        Toggle panels with Ctrl I, Ctrl J and Ctrl `, switch screens with Ctrl Tab or Ctrl 1–7, move
        between regions with F6 and press ? for every shortcut. Layouts are remembered per tier.
      </p>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Preview options">
        <div
          role="radiogroup"
          aria-label="Width"
          className="flex rounded-md border border-border-default p-0.5"
        >
          {SIZES.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={size === x.id}
              onClick={() => setSize(x.id)}
              className={cn(
                chromeButton,
                'h-(--density-control-sm) px-2 text-base aria-checked:bg-surface-active aria-checked:text-fg'
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={review}
          onClick={() => setReview((v) => !v)}
          className={cn(
            chromeButton,
            'h-(--density-control-sm) border border-border-default px-2 text-base'
          )}
        >
          Review screen
        </button>
        <button
          type="button"
          aria-pressed={page}
          onClick={() => setPage((v) => !v)}
          className={cn(
            chromeButton,
            'h-(--density-control-sm) border border-border-default px-2 text-base'
          )}
        >
          App page
        </button>
        <button
          type="button"
          aria-pressed={touch}
          onClick={() => setTouch((v) => !v)}
          className={cn(
            chromeButton,
            'h-(--density-control-sm) border border-border-default px-2 text-base'
          )}
        >
          Touch density
        </button>
      </div>
      <DeviceFrame w={s.w} h={s.h} style={touch ? TOUCH : undefined}>
        <DemoWorkbench
          key={`${review}${page}`}
          review={review}
          page={page}
          preview={{ captionInset: s.app && (s.w === 0 || s.w >= 1100) ? 138 : 0 }}
        />
      </DeviceFrame>
    </div>
  )
}
