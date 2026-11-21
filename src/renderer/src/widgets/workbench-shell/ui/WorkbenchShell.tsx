// The S3 Workbench shell: title bar, screen tabs with dock toggles, the screen with its docks, status bar.
// It renders whatever screen it is given; tiers come from its own width (container-based, not the window).
//
// Focus order (Tab), and F6 / Shift F6 between these regions:
//   1. Skip link ("Skip to the 3D view") → the screen
//   2. Title bar: home, breadcrumb and build switcher, search, job chip, setup chip, app links
//   3. Screen tabs: one Tab stop, arrow keys inside, then More
//   4. Dock toggles
//   5. The screen (toolbar, then the 3D view)
//   6. Right dock columns, left to right
//   7. Bottom dock
//   8. Status bar
// Sheets and dialogs trap focus and give it back to their trigger.
import './shell.css'
import {
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Minus, Square, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { focusRing } from '@/shared/ui/common/styles'
import {
  defaultDock,
  dockReducer,
  docked,
  frontOf,
  readStored,
  renamePanel,
  resolveDock,
  tierOf,
  remPx,
  committedDockSize,
  tokenPx,
  useContainerWidth,
  writeStored,
  type DockAction,
  type DockState
} from '@/shared/lib/layout'
import { useShortcuts } from '@/shared/lib/shortcuts'
import { WorkbenchContext } from '../model/context'
import { DockGroup, PanelSheet, type WorkbenchPanel } from './Dock'
import { ScreenTabs, type Screen } from './ScreenTabs'
import { ShortcutsDialog } from './ShortcutsDialog'
import { PanelToggle } from './PanelToggle'

type WindowControlsOverlay = EventTarget & { visible: boolean }
const overlay = (): WindowControlsOverlay | undefined =>
  (navigator as Navigator & { windowControlsOverlay?: WindowControlsOverlay }).windowControlsOverlay
/** True in the desktop app, where the OS draws caption buttons over the title bar; false on the web. */
function useWindowControls(): boolean {
  return useSyncExternalStore(
    (change) => {
      overlay()?.addEventListener('geometrychange', change)
      return () => overlay()?.removeEventListener('geometrychange', change)
    },
    () => !!overlay()?.visible
  )
}

interface Remembered extends DockState {
  sizes: Record<string, number> // px: right columns by their first panel, `bottom` for the bottom dock
}

const separator = cn(
  focusRing,
  'relative z-sticky bg-border-default transition-colors duration-fast',
  'aria-[orientation=vertical]:w-px aria-[orientation=horizontal]:h-px',
  // a wider invisible grab area, verdigris while dragged or focused
  'after:absolute after:inset-y-0 after:-left-1 after:w-2 aria-[orientation=horizontal]:after:inset-x-0 aria-[orientation=horizontal]:after:inset-y-auto aria-[orientation=horizontal]:after:-top-1 aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-2 aria-[orientation=horizontal]:after:w-full',
  'hover:bg-border-strong focus-visible:bg-accent-solid data-[separator=active]:bg-accent-solid'
)

const SCREEN_KEYS = ['1', '2', '3', '4', '5', '6', '7']

export function WorkbenchShell({
  layoutId,
  titleBar,
  screens,
  screen,
  onScreenChange,
  panels,
  status,
  skipLabel = 'Skip to the screen',
  shortcuts = true,
  preview,
  className,
  children
}: {
  /** Remembered layouts are kept per id and tier, e.g. `workspace` and `review`. */
  layoutId: string
  titleBar: ReactNode
  /** No screens and no panels: an app page (Gallery, Settings) with no document-tabs row. */
  screens: Screen[]
  screen: string
  onScreenChange: (id: string) => void
  panels: WorkbenchPanel[]
  /** null leaves out the status bar (Setup). */
  status: ReactNode
  /** Names where the skip link goes, e.g. "Skip to the 3D view". */
  skipLabel?: string
  /** Register the shell's shortcuts (one shell per window does). */
  shortcuts?: boolean
  /** Kit preview: draws the caption inset at a fixed width, without a window drag region, and no landmarks. */
  preview?: { captionInset: number }
  className?: string
  children: ReactNode
}): ReactElement {
  const horizontal = useRef<HTMLDivElement>(null)
  const vertical = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null)
  const width = useContainerWidth(root)
  const tier = tierOf((width || 1440) / remPx())
  const windowControls = useWindowControls()
  const chrome = preview ? 'preview' : windowControls ? 'app' : 'web'
  const [help, setHelp] = useState(false)
  // the dock layout remounts its panels when docks open or the tier changes; the screen renders once into this
  // node, which moves into <main>, so it never reloads (a 3D view, its state)
  const [screenHost] = useState(() => {
    const el = document.createElement('div')
    el.style.display = 'contents'
    return el
  })

  // remembered per layout and tier: open panels, the tab in front, sizes
  const key = `bs.workbench.${layoutId}.${tier}`
  const [store, setStore] = useState<Record<string, Remembered>>({})
  const load = (): Remembered =>
    renamePanel(readStored(key, { ...defaultDock(tier, panels), sizes: {} }), 'inspector', 'editor')
  const state: Remembered = store[key] ?? load()
  const dock = (action: DockAction): void =>
    setStore((all) => {
      const prev = all[key] ?? load()
      const next = { ...prev, ...dockReducer(tier, panels, prev, action) }
      writeStored(key, { ...next, sheet: null }) // a sheet never reopens by itself
      return { ...all, [key]: next }
    })
  const setSize = (id: string, px: number): void =>
    setStore((all) => {
      const prev = all[key] ?? load()
      if (Math.abs((prev.sizes[id] ?? 0) - px) < 1) return all
      const next = { ...prev, sizes: { ...prev.sizes, [id]: Math.round(px) } }
      writeStored(key, { ...next, sheet: null })
      return { ...all, [key]: next }
    })
  const layout = resolveDock(tier, panels, state)
  const openPanels = layout.sheet
    ? [layout.sheet.tab]
    : [
        ...layout.columns.map((col) => frontOf(col, state, 'right')),
        ...(layout.bottom.length ? [frontOf(layout.bottom, state, 'bottom')] : [])
      ]
  const byId = useMemo(() => new Map(panels.map((p) => [p.id, p])), [panels])
  const pick = (ids: string[]): WorkbenchPanel[] => ids.map((id) => byId.get(id)!)

  // F6 / Shift F6: the next region after the one holding focus
  const cycleRegion = (back: boolean): void => {
    const regions = [
      ...(root.current?.querySelectorAll<HTMLElement>('[data-workbench-region]') ?? [])
    ]
    if (!regions.length) return
    const at = regions.findIndex((r) => r.contains(document.activeElement))
    const next = regions[(at + (back ? -1 : 1) + regions.length) % regions.length]
    const first = next.querySelector<HTMLElement>(
      'button:not([disabled]):not([tabindex="-1"]), [href], input, select, textarea, [tabindex="0"]'
    )
    ;(first ?? next).focus()
  }
  const go = (step: number): void => {
    if (!screens.length) return
    const at = screens.findIndex((s) => s.id === screen)
    onScreenChange(screens[(at + step + screens.length) % screens.length].id)
  }
  useShortcuts(
    shortcuts
      ? [
          ...panels
            .filter((p) => p.keys)
            .map((p) => ({
              keys: p.keys!,
              label: p.title,
              group: 'Panels',
              run: () => dock({ type: 'toggle', id: p.id })
            })),
          { keys: 'Ctrl+Tab', label: 'Next screen', group: 'Screens', run: () => go(1) },
          { keys: 'Ctrl+Shift+Tab', label: 'Previous screen', group: 'Screens', run: () => go(-1) },
          ...screens.slice(0, 7).map((s, i) => ({
            keys: `Ctrl+${SCREEN_KEYS[i]}`,
            label: s.label,
            group: 'Screens',
            hidden: true,
            run: () => onScreenChange(s.id)
          })),
          {
            keys: 'F6',
            label: 'Next region',
            group: 'Focus',
            inFields: true,
            run: () => cycleRegion(false)
          },
          {
            keys: 'Shift+F6',
            label: 'Previous region',
            group: 'Focus',
            inFields: true,
            run: () => cycleRegion(true)
          },
          { keys: '?', label: 'Keyboard shortcuts', group: 'Help', run: () => setHelp(true) }
        ]
      : []
  )

  const Main = preview ? 'section' : 'main'
  const Header = preview ? 'div' : 'header'
  const Footer = preview ? 'div' : 'footer'
  const rightKey = layout.columns.map((c) => c.join('+')).join('|')
  // A shared dock uses the largest minimum of its panels.
  const minimumWidth = (id: string): number => {
    if (id === 'assistant') return 22 * remPx()
    if (id === 'editor') return 21 * remPx()
    return tokenPx('--dock-min', 240)
  }
  const columnSize = (col: string[]): number =>
    state.sizes[col[0]] ??
    Math.max(...col.map((id) => tokenPx(byId.get(id)?.size ?? '--dock-editor', 300)))

  return (
    <WorkbenchContext.Provider
      value={{
        tier,
        dock,
        openPanels
      }}
    >
      <div
        ref={(el) => {
          root.current = el
          setRootEl(el)
        }}
        data-tier={tier}
        data-chrome={chrome}
        style={
          preview
            ? ({ '--caption-inset': `${preview.captionInset}px` } as React.CSSProperties)
            : undefined
        }
        className={cn(
          'relative isolate flex h-full min-h-0 flex-col overflow-hidden bg-surface text-fg',
          className
        )}
      >
        <a
          href="#workbench-screen"
          className="workbench-skip rounded-md bg-accent-solid px-3 py-1.5 text-accent-on-solid"
        >
          {skipLabel}
        </a>
        <Header
          data-workbench-region=""
          data-chrome={chrome}
          aria-label={preview ? 'Title bar' : undefined}
          className="workbench-titlebar flex shrink-0 items-center border-b border-border-default bg-surface"
        >
          {titleBar}
          {preview && preview.captionInset > 0 && (
            // where the OS draws minimise, maximise and close
            <span
              aria-hidden="true"
              className="absolute top-0 right-0 flex h-(--shell-titlebar) items-center justify-around text-fg-muted"
              style={{ width: preview.captionInset }}
            >
              <Minus className="size-3.5" />
              <Square className="size-3" />
              <X className="size-3.5" />
            </span>
          )}
        </Header>

        {screens.length > 0 && (
          <div
            data-workbench-region=""
            className="flex h-[max(var(--shell-tabbar),var(--density-control))] shrink-0 items-stretch gap-1 border-b border-border-default bg-surface pr-1 pl-1"
          >
            <ScreenTabs
              screens={screens}
              value={screen}
              onChange={onScreenChange}
              mode={tier === 'phone' ? 'menu' : 'tabs'}
            />

            {/* a landmark beside the screen tabs' nav, so nothing on the screen sits outside one */}
            <nav aria-label="Panels" className="ml-auto flex shrink-0 items-center gap-0.5">
              {panels
                .filter((p) => p.side === 'right')
                .map((p) => (
                  <PanelToggle key={p.id} panel={p} />
                ))}
            </nav>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {width > 0 && (
            <Group
              key={`h:${tier}:${rightKey}`}
              orientation="horizontal"
              elementRef={horizontal}
              onLayoutChanged={(sizes, meta) => {
                for (const [id] of layout.columns) {
                  const size = committedDockSize(
                    sizes[`dock-${id}`],
                    meta.isUserInteraction,
                    horizontal.current,
                    'width'
                  )
                  if (size !== undefined) setSize(id, size)
                }
              }}
              className="min-w-0 flex-1"
            >
              <Panel id="main" minSize="20rem" groupResizeBehavior="preserve-relative-size">
                <Group
                  key={`v:${tier}:${layout.bottom.join('+')}`}
                  orientation="vertical"
                  elementRef={vertical}
                  onLayoutChanged={(sizes, meta) => {
                    const size = committedDockSize(
                      sizes.bottom,
                      meta.isUserInteraction,
                      vertical.current,
                      'height'
                    )
                    if (size !== undefined) setSize('bottom', size)
                  }}
                >
                  <Panel id="screen" minSize="10rem" groupResizeBehavior="preserve-relative-size">
                    <Main
                      ref={(el: HTMLElement | null) => {
                        if (el && screenHost.parentNode !== el) el.appendChild(screenHost)
                      }}
                      id="workbench-screen"
                      tabIndex={-1}
                      data-workbench-region=""
                      aria-label={preview ? 'Screen' : undefined}
                      className="h-full min-h-0 overflow-auto outline-none"
                    />
                  </Panel>
                  {layout.bottom.length > 0 && (
                    <>
                      <Separator className={separator} />
                      <Panel
                        id="bottom"
                        defaultSize={state.sizes.bottom ?? tokenPx('--dock-activity', 220)}
                        minSize="7.5rem"
                        maxSize="70%"
                        groupResizeBehavior="preserve-pixel-size"
                      >
                        <DockGroup
                          side="bottom"
                          panels={pick(layout.bottom)}
                          value={frontOf(layout.bottom, state, 'bottom')}
                        />
                      </Panel>
                    </>
                  )}
                </Group>
              </Panel>
              {layout.columns.map((col) => (
                <ColumnPanel
                  key={col.join('+')}
                  id={col[0]}
                  size={columnSize(col)}
                  minSize={Math.max(...col.map(minimumWidth))}
                >
                  <DockGroup side="right" panels={pick(col)} value={frontOf(col, state, 'right')} />
                </ColumnPanel>
              ))}
            </Group>
          )}
          {width > 0 && createPortal(children, screenHost)}
        </div>

        {status != null && (
          <Footer
            data-workbench-region=""
            aria-label={preview ? 'Status bar' : undefined}
            className="shrink-0"
          >
            {status}
          </Footer>
        )}

        {!docked(tier) && (
          <PanelSheet
            panels={panels}
            tab={layout.sheet?.tab ?? null}
            size={layout.sheet?.size ?? 'half'}
            container={rootEl}
          />
        )}
        <ShortcutsDialog
          open={help}
          onOpenChange={setHelp}
          container={preview ? rootEl : undefined}
          extra={[
            {
              keys: `Ctrl+1`,
              label: `Screen by position (Ctrl 1 to ${Math.min(screens.length, 7)})`,
              group: 'Screens'
            }
          ]}
        />
      </div>
    </WorkbenchContext.Provider>
  )
}

function ColumnPanel({
  id,
  size,
  minSize,
  children
}: {
  id: string
  size: number
  minSize: number
  children: ReactNode
}): ReactElement {
  return (
    <>
      <Separator className={separator} />
      <Panel
        id={`dock-${id}`}
        defaultSize={Math.max(size, minSize)}
        minSize={minSize}
        maxSize={tokenPx('--dock-max', 560)}
        groupResizeBehavior="preserve-pixel-size"
      >
        {children}
      </Panel>
    </>
  )
}
