// Review (G6-RV, concept A · canvas + round rail): the variants side by side on the full canvas height, and
// the round (question, variants, approved parts, notes, numbered pins, paste positions) in a rail that takes
// the Editor's dock slot. Saved as builds/<name>/review/round_N.json plus a gist in DESIGN.md
// (main/review.ts). Feedback never goes through chat.
import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Ellipsis,
  Layers,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { Chip } from '@/shared/ui/primitives/chip'
import { Field } from '@/shared/ui/primitives/field'
import { NumberField } from '@/shared/ui/primitives/number-field'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/shared/ui/primitives/accordion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/shared/ui/primitives/dropdown-menu'
import { Toolbar } from '@/shared/ui/layout/Toolbar'
import { IconButton } from '@/shared/ui/common/parts'
import { useWorkbench } from '@/widgets/workbench-shell/model/context'
import type { WorkbenchPanel } from '@/widgets/workbench-shell/ui/Dock'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { EmptyState } from '@/shared/ui/feedback/EmptyState'
import { Tip } from '@/shared/ui/common/Tip'
import {
  ViewerOverlay,
  ViewerSegmented,
  ViewerStatusToast
} from '@/entities/viewer/ui/ViewerOverlay'
import { PinMarker } from '@/entities/viewer/ui/PinMarker'
import { buildUrl } from '@/shared/lib/urls'
import { clearScreenPanels, setScreenPanels } from '@/widgets/workbench-shell/model/screenPanels'
import { CAMERA_LABELS } from '@/entities/build/model/workspace'
import { cssColor, useResolvedTheme } from '@/shared/lib/theme'
import { blank, stem, type Xyz } from '@/entities/review/model/review'
import { cn } from '@/shared/lib/utils'
import type { Marker } from '@/entities/viewer/ui/BuildViewer'
import { VIEWS, type ViewName } from '@/entities/viewer/model/look'
import type { ReviewPin } from '@shared/api'
import { short } from '@/shared/lib/format'
import { ViewerGrid } from '@/widgets/version-compare/ui/ViewerGrid'
import { VoxelDiff } from '@/widgets/version-compare/ui/VoxelDiff'
import { useReviewRound } from '../model/useReviewRound'

type Tab = '3d' | 'sheets' | 'diff'
const CAMERAS = [...(Object.keys(VIEWS) as ViewName[]), 'orbit' as ViewName]

export function Review(): ReactElement {
  const { name } = useParams({ from: '/build/$name/review' })
  const navigate = useNavigate()
  const { tier } = useWorkbench()
  const phone = tier === 'phone'
  useResolvedTheme() // re-render so the pin colour follows the theme
  const [view, setView] = useState<ViewName>('iso_se')
  const [tab, setTab] = useState<Tab>('3d')
  const [page, setPage] = useState(0)
  const [railHost, setRailHost] = useState<HTMLElement | null>(null)
  const [panels] = useState((): WorkbenchPanel[] => [
    {
      id: 'review',
      side: 'right',
      title: 'Review round',
      icon: ClipboardCheck,
      keys: 'Ctrl+I',
      size: '--dock-review',
      defaultOpen: true,
      content: <div ref={setRailHost} className="flex h-full min-h-0 flex-col" />
    }
  ])
  useEffect(() => {
    setScreenPanels(panels)
    return clearScreenPanels
  }, [panels])

  const {
    build,
    set,
    rounds,
    saving,
    status,
    d,
    versions,
    files,
    missing,
    nextRound,
    patch,
    paste,
    picked,
    lastPick,
    nextPin,
    addPin,
    togglePick,
    toggleFile,
    save,
    decline
  } = useReviewRound(name)
  const [diffOf, setDiffOf] = useState<string | null>(null)
  const diffFile =
    files.find((v) => v.path === diffOf) ?? files.find((v) => v.path !== lastPick?.path)

  const markers = (path: string): Marker[] =>
    d.pins.flatMap((p) =>
      'block' in p && p.file === stem(path)
        ? [{ cell: p.block, color: cssColor('--pin-open-fill'), label: String(p.n) }]
        : []
    )
  const discard = (): void => {
    set(name, blank(d.files))
    void navigate({ to: '/build/$name', params: { name } })
  }
  const back = (): void => void navigate({ to: '/build/$name', params: { name } })

  // phone: one variant at a time
  const shownFiles = phone && files.length ? [files[Math.min(page, files.length - 1)]] : files
  const pickButton = (path: string): ReactNode => (
    <PickButton
      name={stem(path)}
      picked={d.pick === stem(path)}
      onClick={() => togglePick(stem(path))}
    />
  )

  const toolbar = (
    <Toolbar
      label="Review"
      mode="wrap"
      className="shrink-0 border-b border-border-subtle px-2 py-1"
      groups={[
        {
          id: 'back',
          label: 'Navigation',
          overflow: null,
          content: <IconButton icon={ArrowLeft} label="Back to Workspace" onClick={back} />
        },
        {
          id: 'view',
          label: 'View',
          overflow: null,
          content: (
            <ViewerSegmented<Tab>
              label="Review view"
              value={tab}
              onChange={setTab}
              options={[
                { value: '3d', label: '3D' },
                { value: 'sheets', label: 'Sheets' },
                { value: 'diff', label: 'Diff' }
              ]}
            />
          )
        },
        ...(tab !== 'sheets'
          ? [
              {
                id: 'camera',
                label: 'Camera',
                overflow: null,
                content: (
                  <Select value={view} onValueChange={(v) => setView(v as ViewName)}>
                    <SelectTrigger aria-label="Camera view" size="sm" className="w-40">
                      <SelectValue>{CAMERA_LABELS[view] ?? view}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {CAMERAS.map((v) => (
                        <SelectItem key={v} value={v}>
                          {CAMERA_LABELS[v] ?? v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              }
            ]
          : []),
        {
          id: 'hint',
          label: tab === 'diff' ? 'Compared with' : 'Hint',
          overflow: null,
          content:
            tab === 'diff' ? (
              <span className="flex flex-wrap items-center gap-1.5 text-sm text-fg-secondary">
                {lastPick ? `vs round ${picked!.round}'s pick` : 'No earlier round with a pick'}
                {lastPick &&
                  files
                    .filter((v) => v.path !== lastPick.path)
                    .map((v) => (
                      <Chip
                        key={v.path}
                        selected={v.path === diffFile?.path}
                        onClick={() => setDiffOf(v.path)}
                        className="font-mono"
                      >
                        {stem(v.path)}
                      </Chip>
                    ))}
              </span>
            ) : (
              <span className="text-sm text-fg-secondary">
                Click {tab === 'sheets' ? 'a sheet' : 'a block'} to drop a pin.
              </span>
            )
        }
      ]}
      end={
        phone ? (
          <>
            {files.length > 1 && (
              <span className="flex items-center gap-1 text-sm tabular-nums text-fg-secondary">
                <IconButton
                  icon={ChevronLeft}
                  label="Previous variant"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                />
                {Math.min(page, files.length - 1) + 1} of {files.length}
                <IconButton
                  icon={ChevronRight}
                  label="Next variant"
                  disabled={page >= files.length - 1}
                  onClick={() => setPage(page + 1)}
                />
              </span>
            )}
            <DropdownMenu>
              <Tip label="More: Decline, Discard draft, Rounds saved">
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More">
                    <Ellipsis />
                  </Button>
                </DropdownMenuTrigger>
              </Tip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={!d.requestId} onSelect={() => void decline()}>
                  Decline
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={discard}>Discard draft</DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!rounds.data?.length}
                  onSelect={() =>
                    toast(`Rounds saved here: ${rounds.data?.length ?? 0}`, {
                      description: [...(rounds.data ?? [])]
                        .reverse()
                        .slice(0, 5)
                        .map((r) => `${r.round} ${r.pick ?? 'no pick'} · ${r.question}`)
                        .join('\n')
                    })
                  }
                >
                  Rounds saved
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : undefined
      }
    />
  )

  const canvas = !build ? (
    <div role="status" className="grid h-full place-items-center bg-surface-viewer text-fg-muted">
      Loading {name}…
    </div>
  ) : tab === '3d' ? (
    files.length ? (
      <ViewerGrid
        files={shownFiles}
        view={view}
        onViewChange={setView}
        markers={markers}
        onPick={(path, p) =>
          addPin({
            n: nextPin,
            file: stem(path),
            block: p.cell,
            state: p.state ?? 'minecraft:air',
            view,
            text: ''
          })
        }
        overlay={(p) => (
          <>
            <ViewerOverlay className="flex h-7 items-center px-2 font-mono text-xs">
              {stem(p)}
            </ViewerOverlay>
            {pickButton(p)}
          </>
        )}
      />
    ) : (
      <ChooseVariants />
    )
  ) : tab === 'diff' ? (
    lastPick && diffFile ? (
      <VoxelDiff a={lastPick} b={diffFile} view={view} onViewChange={setView} />
    ) : (
      <EmptyState icon={Layers} size="panel" title="Nothing to compare yet">
        {lastPick
          ? 'Choose a variant other than the last pick.'
          : picked
            ? `Round ${picked.round}’s pick ${picked.pick} is no longer in out/.`
            : 'No earlier round has a pick yet.'}
      </EmptyState>
    )
  ) : files.length ? (
    <div className="flex h-full flex-col gap-6 overflow-auto bg-surface-viewer p-4">
      {shownFiles.map((v) => (
        <section key={v.path} aria-label={stem(v.path)} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{stem(v.path)}</span>
            {pickButton(v.path)}
          </div>
          {v.sheet ? (
            <SheetPins
              src={buildUrl(v.sheet, Math.round(v.mtime))}
              name={stem(v.path)}
              pins={d.pins.filter(
                (p): p is Extract<ReviewPin, { px: unknown }> => 'px' in p && p.sheet === v.sheet
              )}
              onPin={(px) =>
                addPin({ n: nextPin, file: stem(v.path), sheet: v.sheet!, px, text: '' })
              }
              onRemove={(n) => patch({ pins: d.pins.filter((x) => x.n !== n) })}
            />
          ) : (
            <p className="text-sm text-fg-muted">No sheet for this version.</p>
          )}
        </section>
      ))}
    </div>
  ) : (
    <ChooseVariants />
  )

  const rail = (
    <section aria-label="Review round" className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-3 py-2">
        <h2 className="font-medium">Round {nextRound}</h2>
        {d.requestId && <StatusBadge state="awaiting-approval">The agent is waiting</StatusBadge>}
      </header>
      {!build ? (
        <div className="flex flex-col gap-4 p-3" aria-busy="true">
          {[16, 10, 10, 24, 16].map((h, i) => (
            <Skeleton key={i} className="w-full" style={{ height: `${h * 0.25}rem` }} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-3">
          <Field label="Question for this round">
            <Textarea
              rows={2}
              value={d.question}
              onChange={(e) => patch({ question: e.target.value })}
              placeholder="What should this round answer?"
            />
          </Field>
          <RailGroup title="Variants · up to four">
            <div className="flex flex-wrap gap-1">
              {versions.map((v) => (
                <Chip
                  key={v.path}
                  selected={d.files.includes(v.path)}
                  onClick={() => toggleFile(v.path)}
                  className="font-mono"
                >
                  {stem(v.path)}
                </Chip>
              ))}
            </div>
            {missing.length > 0 && (
              <InlineNotice tone="warning">Not in out/: {missing.join(', ')}</InlineNotice>
            )}
          </RailGroup>
          <RailGroup title="Approve parts">
            <ApproveChips
              parts={d.parts}
              approved={d.approved}
              onChange={(parts, approved) => patch({ parts, approved })}
            />
          </RailGroup>
          <Field label="Notes">
            <Textarea
              rows={4}
              value={d.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="What to keep, what to change"
            />
          </Field>
          <RailGroup title={`Pins (${d.pins.length})`}>
            {d.pins.length ? (
              <ol className="flex flex-col gap-3">
                {d.pins.map((p, i) => (
                  <li key={p.n} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-pin-open font-mono text-xs text-pin-open-text">
                        {p.n}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-fg-secondary">
                        {p.file} ·{' '}
                        {'block' in p
                          ? `${p.block.join(' ')} · ${short(p.state)}`
                          : `sheet ${p.px.join(', ')}`}
                      </span>
                      <IconButton
                        icon={X}
                        label={`Remove pin ${p.n}`}
                        onClick={() => patch({ pins: d.pins.filter((x) => x.n !== p.n) })}
                      />
                    </div>
                    <Input
                      aria-label={`Note for pin ${p.n}`}
                      autoFocus={i === d.pins.length - 1 && !p.text}
                      placeholder="What about it?"
                      value={p.text}
                      onChange={(e) =>
                        patch({
                          pins: d.pins.map((x) =>
                            x.n === p.n ? { ...x, text: e.target.value } : x
                          )
                        })
                      }
                    />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-fg-muted">None yet.</p>
            )}
          </RailGroup>
          <Accordion type="multiple">
            <AccordionItem value="paste">
              <AccordionTrigger>
                Paste positions <span className="ms-1 text-fg-muted">{files.length}</span>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-2">
                {files.map((v) => {
                  const p = paste(v.path)
                  return (
                    <PasteRow
                      key={`${v.path} ${p.xyz?.join(' ')}`} // remount when the source changes
                      name={stem(v.path)}
                      from={p.from}
                      value={p.xyz}
                      onChange={(xyz) => patch({ paste: { ...d.paste, [v.path]: xyz } })}
                    />
                  )
                })}
                <p className="text-sm text-fg-muted">
                  From the job that wrote each file, or an older round. Edit if unknown.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="rounds">
              <AccordionTrigger>
                Rounds saved here{' '}
                <span className="ms-1 text-fg-muted">{rounds.data?.length ?? 0}</span>
              </AccordionTrigger>
              <AccordionContent>
                {rounds.data?.length ? (
                  <ul className="flex flex-col gap-1 text-sm">
                    {[...rounds.data].reverse().map((r) => (
                      <li key={r.round} className="flex gap-2">
                        <span className="font-mono tabular-nums text-fg-muted">{r.round}</span>
                        <span className="font-mono">{r.pick ?? 'no pick'}</span>
                        <span className="min-w-0 flex-1 text-fg-secondary">{r.question}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-fg-muted">No rounds saved yet.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
      <footer className="flex shrink-0 flex-col gap-2 border-t border-border-subtle p-3">
        <Button onClick={() => void save()} disabled={saving || !files.length}>
          {saving ? `Saving round ${nextRound}…` : d.requestId ? 'Save and send' : 'Save round'}
        </Button>
        <div className="flex gap-2">
          {d.requestId && (
            <Button variant="ghost" className="flex-1" onClick={() => void decline()}>
              Decline
            </Button>
          )}
          <Button variant="ghost" className="flex-1" onClick={discard}>
            Discard draft
          </Button>
        </div>
      </footer>
    </section>
  )

  return (
    <div className="flex h-full min-w-0 flex-col">
      <h1 className="sr-only">Review</h1>
      {toolbar}
      <div aria-label="Review canvas" className="relative min-h-0 flex-1">
        {canvas}
        <ViewerStatusToast message={status.message} at={status.at} />
      </div>
      {railHost && createPortal(rail, railHost)}
    </div>
  )
}

function ChooseVariants(): ReactElement {
  return (
    <EmptyState icon={Layers} size="panel" title="Choose the variants to review">
      Pick up to four. The two newest are chosen for you when a round starts.
    </EmptyState>
  )
}

function RailGroup({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <div role="group" aria-label={title} className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </div>
  )
}

function PickButton({
  name,
  picked,
  onClick
}: {
  name: string
  picked: boolean
  onClick: () => void
}): ReactElement {
  return (
    <Button
      size="sm"
      variant={picked ? 'default' : 'secondary'}
      aria-pressed={picked}
      aria-label={picked ? `${name} picked, click to unpick` : `Pick ${name}`}
      onClick={onClick}
      className={cn(!picked && 'viewer-overlay')}
    >
      {picked && <Check aria-hidden />}
      {picked ? 'Picked · click to unpick' : 'Pick this variant'}
    </Button>
  )
}

function ApproveChips({
  parts,
  approved,
  onChange
}: {
  parts: string[]
  approved: string[]
  onChange: (parts: string[], approved: string[]) => void
}): ReactElement {
  const [text, setText] = useState('')
  const add = (): void => {
    const p = text.trim()
    if (p && !parts.includes(p)) onChange([...parts, p], [...approved, p])
    setText('')
  }
  return (
    <div className="flex flex-col gap-2">
      {parts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {parts.map((p) => (
            <Chip
              key={p}
              selected={approved.includes(p)}
              className="font-mono"
              onClick={() =>
                onChange(
                  parts,
                  approved.includes(p) ? approved.filter((x) => x !== p) : [...approved, p]
                )
              }
            >
              {p}
            </Chip>
          ))}
        </div>
      )}
      <Input
        aria-label="Add a part (Enter)"
        placeholder="Add a part"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
    </div>
  )
}

/** x y z for one file: commits when all three are set, or clears when all three are empty. */
function PasteRow({
  name,
  from,
  value,
  onChange
}: {
  name: string
  from: string
  value: Xyz | null
  onChange: (v: Xyz | null) => void
}): ReactElement {
  const [xyz, setXyz] = useState<(number | null)[]>(value ?? [null, null, null])
  const commit = (i: number, v: number | null): void => {
    const next = xyz.map((x, j) => (j === i ? v : x))
    setXyz(next)
    if (next.every((x) => x == null)) onChange(null)
    else if (next.every((x) => x != null)) onChange(next as Xyz)
  }
  return (
    <div role="group" aria-label={`Paste position of ${name}`} className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate font-mono">{name}</span>
        <span className="text-fg-muted">from {from}</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {(['x', 'y', 'z'] as const).map((axis, i) => (
          <NumberField
            key={axis}
            aria-label={`${name} ${axis}`}
            placeholder={axis}
            step={1}
            hideStepper
            value={xyz[i]}
            onValueChange={(v) => commit(i, v == null ? null : Math.round(v))}
            className="font-mono"
          />
        ))}
      </div>
    </div>
  )
}

/** A sheet PNG at its width; a click pins its natural pixel. */
function SheetPins({
  src,
  name,
  pins,
  onPin,
  onRemove
}: {
  src: string
  name: string
  pins: { n: number; px: [number, number]; text: string }[]
  onPin: (px: [number, number]) => void
  onRemove: (n: number) => void
}): ReactElement {
  const [size, setSize] = useState<[number, number] | null>(null)
  return (
    <div className="relative inline-block max-w-full self-start">
      <img
        src={src}
        alt={`${name} preview sheet: click to drop a pin`}
        draggable={false}
        onLoad={(e) => setSize([e.currentTarget.naturalWidth, e.currentTarget.naturalHeight])}
        onClick={(e) => {
          if (!size) return
          const r = e.currentTarget.getBoundingClientRect()
          onPin([
            Math.round(((e.clientX - r.left) / r.width) * size[0]),
            Math.round(((e.clientY - r.top) / r.height) * size[1])
          ])
        }}
        className="max-w-full cursor-crosshair [image-rendering:pixelated]"
      />
      {size &&
        pins.map((p) => (
          <PinMarker
            key={p.n}
            n={p.n}
            state="open"
            x={`${(p.px[0] / size[0]) * 100}%`}
            y={`${(p.px[1] / size[1]) * 100}%`}
            where={`${name} · sheet ${p.px.join(', ')}`}
            note={p.text || <span className="text-fg-muted">No note yet.</span>}
            actions={
              <Button size="sm" variant="ghost" onClick={() => onRemove(p.n)}>
                Remove
              </Button>
            }
          />
        ))}
    </div>
  )
}
