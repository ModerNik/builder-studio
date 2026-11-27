// Variants (G6-4-VA, lanes side by side): one brief or feedback, A/B/C… agent sessions at once, each on
// its own <part>_<L> files (main/lanes.ts holds them to it). Each lane is a narrow Agent panel built from the
// kit's chat parts: header with letter, status, cost and Stop, the transcript and a compact composer. Up to
// four lanes fit at 1440; more scroll sideways and the lane switcher jumps to them. Phone shows one lane.
// Logic: lib/variants.ts (store), lib/lanes.ts (prompts, files, lane status).
import { useState, type ReactElement } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Columns3, Paperclip, Send, Square } from 'lucide-react'
import { type Ref } from '@shared/api'
import { DEFAULT_LINTER_SETTINGS } from '@shared/constants'
import { Button } from '@/shared/ui/primitives/button'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import { Field } from '@/shared/ui/primitives/field'
import { Input } from '@/shared/ui/primitives/input'
import { Textarea } from '@/shared/ui/primitives/textarea'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover'
import { CodeBlock } from '@/shared/ui/code/CodeBlock'
import { Tip, IconAction } from '@/shared/ui/common/Tip'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { LaneColumns } from '@/shared/ui/layout/Grids'
import { Transcript } from '@/features/agent-chat/ui/Transcript'
import { Composer } from '@/features/agent-chat/ui/Composer'
import { LaneSwitcher } from '@/features/agent-chat/ui/LaneSwitcher'
import { SystemNote } from '@/features/agent-chat/ui/Messages'
import { useWorkbench } from '@/widgets/workbench-shell/model/context'
import { buildUrl } from '@/shared/lib/urls'
import { useAvailability } from '@/entities/availability/model/availability'
import { useBuild, useShow } from '@/entities/build/model/builds'
import { openSheetViewer } from '@/features/render-studio/model/store'
import { useSettings } from '@/entities/settings/model/settings'
import {
  busy,
  effortLabel,
  resolveAgentPrefs,
  useAgentPrefs,
  useThread
} from '@/features/agent-chat/model/agent'
import { LETTERS, laneFiles, laneState, laneSummary } from '../model/lanes'
import { permitLane, sendToLane, stopLane, useStartVariants } from '../model/actions'
import { useAgentModels } from '@/features/agent-chat/model/composer'
import { useVariants, type Lane } from '@/features/agent-chat/model/variants'
import { blank, useReview } from '@/entities/review/model/review'
import { refPath, useRefs } from '@/entities/ref/model/refs'
import { hasEnabledLintRule, lintProblems } from '@/shared/lib/format'

export function Variants(): ReactElement {
  const { name } = useParams({ from: '/build/$name/variants' })
  const { tier } = useWorkbench()
  const phone = tier === 'phone'
  const { build, lanes, round } = useVariants()
  const mine = build === name ? Object.keys(lanes).sort() : []
  const [setup, setSetup] = useState(false)
  const [view, setView] = useState<string | undefined>()
  const versions = useBuild(name).data?.versions
  const navigate = useNavigate()
  const working = mine.some((l) => lanes[l].state && busy(lanes[l].state!))
  const files = laneFiles(versions ?? [], mine)
  const states = mine.map((l) => laneState(lanes[l]))
  const current = view && mine.includes(view) ? view : mine[0]

  const review = (): void => {
    useReview
      .getState()
      .set(name, { ...blank(files), question: `Which variant: ${mine.join(', ')}?` })
    void navigate({ to: '/build/$name/review', params: { name } })
  }
  const jump = (l: string): void => {
    setView(l)
    if (!phone)
      document.getElementById(`lane-${l}`)?.scrollIntoView({ inline: 'start', block: 'nearest' })
  }

  if (setup || !mine.length)
    return (
      <Setup
        build={name}
        onStarted={() => setSetup(false)}
        onCancel={mine.length ? () => setSetup(false) : undefined}
      />
    )

  const fileNames = files.map((f) => f.split('/').pop()).join(', ')
  const notReady = `No ${round?.part ?? 'build'}_A, ${round?.part ?? 'build'}_B… files in out/ yet`
  const sendButton = (
    <Tip label={files.length >= 2 ? fileNames : notReady}>
      <span tabIndex={files.length < 2 ? 0 : undefined}>
        <Button
          disabled={files.length < 2}
          onClick={review}
          aria-label={`Send ${files.length} to Review`}
        >
          <Send /> {phone ? `Send ${files.length}` : `Send ${files.length} to Review`}
        </Button>
      </span>
    </Tip>
  )
  const summary = laneSummary(states)
  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-medium">
            {mine.length} variants of {round?.part ?? 'build'}.py
          </h1>
          {round && !phone && (
            <p className="truncate text-sm text-fg-secondary">
              {round.forked ? 'forked from the Agent panel · ' : ''}“{round.brief}”
            </p>
          )}
        </div>
        {!phone && (
          <Button variant="outline" disabled={working} onClick={() => setSetup(true)}>
            New variants
          </Button>
        )}
        {sendButton}
      </header>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <LaneSwitcher
          label="Variants"
          className="max-w-90"
          lanes={mine.map((l, i) => ({
            id: l,
            letter: l,
            name: round?.tries[l] || `Variant ${l}`,
            state: states[i]
          }))}
          value={current}
          onChange={jump}
        />
        {summary && <p className="text-sm text-fg-secondary">{summary}.</p>}
      </div>
      {phone ? (
        <div className="flex min-h-0 flex-1 px-4 pb-4">
          {current && (
            <LaneColumn lane={current} data={lanes[current]} tries={round?.tries[current]} />
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 px-4 pb-4 [&>div]:h-full">
          <LaneColumns aria-label="Variant lanes" className="h-full">
            {mine.map((l) => (
              <LaneColumn key={l} lane={l} data={lanes[l]} tries={round?.tries[l]} />
            ))}
          </LaneColumns>
        </div>
      )}
    </div>
  )
}

function Setup({
  build,
  onStarted,
  onCancel
}: {
  build: string
  onStarted: () => void
  onCancel?: () => void
}): ReactElement {
  const cap = useSettings().data?.variantCap ?? 3
  const availability = useAvailability().data
  const prefs = useAgentPrefs()
  const { mode, provider } = prefs
  const models = useAgentModels(provider)
  const { model, effort } = resolveAgentPrefs(provider, prefs, models.data)
  const modelName =
    models.data?.find((option) => option.value === model)?.name ??
    (model === 'sonnet' ? 'Sonnet' : model)
  const [brief, setBrief] = useState('')
  const [part, setPart] = useState('build')
  const [count, setCount] = useState(Math.min(3, cap))
  const [dirs, setDirs] = useState<string[]>(Array(6).fill(''))
  const [picked, setPicked] = useState<string[]>([])
  const refs = useRefs(build).data ?? []
  const forkable = useThread((t) =>
    t.build === build && t.session && !busy(t.state) ? t.session : null
  )
  const [fork, setFork] = useState(true)
  const { starting, start: startRound } = useStartVariants(build, onStarted)
  const letters = LETTERS.slice(0, count)
  const okPart = /^[\w-]+$/.test(part)
  // a ref deleted on the board drops out of what is sent
  const attached: Ref[] = refs.filter((r) => picked.includes(r.id))

  const start = (): Promise<void> =>
    startRound({
      brief,
      part,
      count,
      letters,
      dirs,
      attached,
      fork,
      forkable,
      provider,
      mode
    })

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-190 flex-col gap-5 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-medium">Try several variants at once</h1>
          <p className="text-sm text-fg-secondary">
            Each lane is its own agent session and writes only its own copy:{' '}
            <code className="font-mono">{part}.py</code> →{' '}
            <code className="font-mono">{part}_A.py</code>, run with{' '}
            <code className="font-mono">--name {part}_A</code>. Other writes, git and build names
            are denied.
          </p>
        </div>
        <Field label="Brief">
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={5}
            placeholder="The brief or the feedback all variants work from"
          />
        </Field>
        {refs.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="self-start">
                <Paperclip />{' '}
                {attached.length ? `${attached.length} refs attached` : 'Attach references'}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" aria-label="Attach references" className="w-87 p-2">
              <p className="flex items-baseline justify-between px-2 pb-2 font-medium">
                Attach references
                <span className="text-sm text-fg-muted">
                  {attached.length} of {refs.length}
                </span>
              </p>
              <ul className="flex max-h-72 flex-col overflow-auto">
                {refs.map((r) => (
                  <li key={r.id}>
                    <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1 can-hover:hover:bg-surface-hover">
                      <Checkbox
                        checked={picked.includes(r.id)}
                        onCheckedChange={(on) =>
                          setPicked(on ? [...picked, r.id] : picked.filter((p) => p !== r.id))
                        }
                      />
                      {r.kind === 'image' ? (
                        <img
                          src={buildUrl(refPath(build, r))}
                          alt=""
                          className="size-8 rounded object-cover"
                        />
                      ) : (
                        <span className="w-8 text-center text-sm text-fg-muted">{r.kind}</span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {r.note || r.url || r.title}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="px-2 pt-2 text-sm text-fg-muted">
                Sends paths and notes; the assistant reads the images itself.
              </p>
            </PopoverContent>
          </Popover>
        )}
        <div className="flex flex-wrap items-start gap-4">
          <Field
            label="Script"
            error={okPart ? undefined : 'Letters, digits, - and _ only.'}
            className="w-65"
          >
            <div className="flex items-center gap-1">
              <Input
                value={part}
                onChange={(e) => setPart(e.target.value.trim())}
                className="font-mono"
                aria-invalid={!okPart}
              />
              <span className="font-mono text-sm text-fg-muted">.py</span>
            </div>
          </Field>
          <Field label="Variants" hint={`At most ${cap} (Settings)`}>
            <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LETTERS.slice(1, cap).map((_, i) => (
                  <SelectItem key={i} value={String(i + 2)}>
                    {i + 2}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {forkable && (
          <label className="flex items-start gap-2">
            <Checkbox
              checked={fork}
              onCheckedChange={(on) => setFork(on === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col">
              <span>Fork the Agent panel’s session</span>
              <span className="text-sm text-fg-muted">
                Every lane starts from the current Agent panel conversation.
              </span>
            </span>
          </label>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 font-medium">Directions</legend>
          {letters.map((l, i) => (
            <label key={l} className="flex items-center gap-2">
              <span className="w-6 font-mono font-medium text-accent-text">{l}</span>
              <Input
                value={dirs[i]}
                onChange={(e) => setDirs(dirs.map((d, j) => (j === i ? e.target.value : d)))}
                placeholder={`What variant ${l} tries (optional)`}
              />
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={
              !brief.trim() || !okPart || !model || starting || !availability?.features.variants.ok
            }
            onClick={() => void start()}
          >
            <Columns3 /> Start {count} variants
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <p className="wrap-anywhere text-sm text-fg-muted">
            {modelName ?? (models.isPending ? 'Loading model…' : 'No models available')}
            {effort && ', ' + effortLabel(effort) + ' effort'}
          </p>
        </div>
      </div>
    </div>
  )
}

function LaneColumn({
  lane,
  data,
  tries
}: {
  lane: string
  data: Lane
  tries?: string
}): ReactElement {
  const navigate = useNavigate()
  const available = useAvailability().data?.features.variants.ok
  const linter = useSettings().data?.linter ?? DEFAULT_LINTER_SETTINGS
  const s = data.state
  const running = !!s && busy(s)
  const state = laneState(data)
  const send = (t: string): void => sendToLane(lane, t)
  return (
    <section
      id={`lane-${lane}`}
      aria-label={`Variant ${lane}`}
      className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-surface-raised ${state === 'awaiting-approval' ? 'border-warning-subtle-border' : 'border-border-subtle'}`}
    >
      <div className="flex h-(--density-control) shrink-0 items-center gap-2 border-b border-border-subtle px-2">
        <span className="font-mono font-medium text-accent-text">{lane}</span>
        <span className="font-medium">Variant {lane}</span>
        <StatusBadge state={state}>
          {state === 'queued'
            ? 'Starting'
            : state === 'awaiting-approval'
              ? 'Needs you'
              : undefined}
        </StatusBadge>
        <span className="flex-1" />
        {s?.cost != null && (
          <span aria-label="Cost" className="font-mono text-sm text-fg-muted">
            ${s.cost.toFixed(2)}
          </span>
        )}
        {running && (
          <IconAction label={`Stop variant ${lane}`} icon={Square} onClick={() => stopLane(lane)} />
        )}
      </div>
      {tries && (
        <p className="border-b border-border-subtle px-3 py-1.5 text-sm text-fg-secondary">
          Tries: {tries}
        </p>
      )}
      <Transcript
        className="min-h-0 flex-1"
        items={data.items}
        asks={data.asks}
        working={running}
        onPermit={(p) => permitLane(lane, p)}
        onShowFile={(path, sheet) => {
          const build = /^builds\/(.+?)\/out\//.exec(path)?.[1]
          if (!build) return
          if (sheet) {
            openSheetViewer({ build, path, mtime: Date.now() })
            return
          }
          useShow.setState({ path, sheet: null, t: Date.now() })
          void navigate({ to: '/build/$name', params: { name: build } })
        }}
        lintProblems={(counts) =>
          linter.enabled && hasEnabledLintRule(linter.rules)
            ? lintProblems(counts, linter.rules)
            : undefined
        }
        fileUrl={buildUrl}
        empty={
          <div className="flex flex-col gap-2 p-3">
            <p className="text-sm text-fg-secondary">Starting the session…</p>
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        }
      >
        {s?.error && (
          <SystemNote tone="error">
            The session stopped.
            <CodeBlock
              code={s.error}
              lineNumbers={false}
              wrap
              maxHeight="max-h-32"
              className="mt-2"
            />
          </SystemNote>
        )}
      </Transcript>
      <Composer
        variant="compact"
        className="border-t border-border-subtle"
        placeholder={running ? 'Working…' : `Follow up with ${lane}`}
        running={running}
        disabledReason={available === false ? 'Variants are not available right now.' : undefined}
        onSend={send}
        onStop={() => stopLane(lane)}
      />
    </section>
  )
}
