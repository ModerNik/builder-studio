import { useState, type ReactElement } from 'react'
import { Boxes, Compass, FilePen, Images, Shield, Zap } from 'lucide-react'
import { Composer, type Option } from '@/features/agent-chat/ui/Composer'
import { McpPopoverContent } from '@/features/agent-chat/ui/AgentMcp'
import { ModelEffortPicker } from '@/features/agent-chat/ui/ModelEffortPicker'
import { ContextChip, type Attachment } from '@/features/agent-chat/ui/Messages'
import { ThreadListItem } from '@/features/agent-chat/ui/ThreadListItem'
import { ContextDialog, RewindDialog } from '@/features/agent-chat/ui/CommandDialogs'
import { Button } from '@/shared/ui/primitives/button'
import hero from '../../../../../../.github/assets/hero.svg?url'
import { Cell, Grid, Narrow, Sub, Touch } from '../composites-demo'

export const meta = { group: 'Agent', title: 'Composer and threads' }

const MODES: Option[] = [
  {
    value: 'default',
    label: 'Manual',
    description: 'Asks before each edit and command',
    icon: <Shield aria-hidden className="size-3.5" />
  },
  {
    value: 'acceptEdits',
    label: 'Accept edits',
    description: 'Runs edits and commands without asking',
    icon: <FilePen aria-hidden className="size-3.5" />
  },
  {
    value: 'auto',
    label: 'Auto',
    description: 'A classifier approves calls; risky calls still ask',
    icon: <Zap aria-hidden className="size-3.5 text-warning-text" />
  },
  {
    value: 'plan',
    label: 'Plan',
    description: 'Plans first and asks before it edits',
    icon: <Compass aria-hidden className="size-3.5 text-accent-text" />
  }
]
const MODELS: Option[] = [
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini (Codex)' }
]
const EFFORTS: Option[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' },
  { value: 'max', label: 'Max' }
]
const COMMANDS = [
  { name: 'compact', description: 'Summarize the conversation to free context' },
  { name: 'build-review', description: 'Render a sheet and judge it against the brief' },
  { name: 'review', hint: '[question]', description: 'Open Review and wait for the review' },
  { name: 'log-round', description: 'Append a Round gist to DESIGN.md' }
]

function LiveComposer({
  running: startRunning = false,
  narrow = false,
  initialSuggestion = null
}: {
  running?: boolean
  narrow?: boolean
  initialSuggestion?: string | null
}): ReactElement {
  const [mode, setMode] = useState(narrow ? 'acceptEdits' : 'default')
  const [model, setModel] = useState(narrow ? 'gpt-5.4-mini' : 'sonnet')
  const [effort, setEffort] = useState('medium')
  const [running, setRunning] = useState(startRunning)
  const [sent, setSent] = useState('')
  const [suggestion, setSuggestion] = useState<string | null>(initialSuggestion)
  const [files, setFiles] = useState<Attachment[]>([
    { path: 'builds/stone_watchtower/attachments/pasted-1730662800.png', url: hero },
    { path: 'builds/stone_watchtower/attachments/gatehouse_notes.md' }
  ])
  const [parts, setParts] = useState(true)
  const [refs, setRefs] = useState<string[]>(['r1'])
  return (
    <div className="flex flex-col gap-2">
      <Composer
        onSend={(t) => {
          setSent(t)
          setRunning(true)
        }}
        onStop={() => setRunning(false)}
        running={running}
        commands={COMMANDS}
        onCommand={(name) => {
          setSent('/' + name)
          return name === 'skills' || name === 'model' ? name : undefined
        }}
        attachments={files}
        onAttach={(fs) => setFiles((f) => [...f, ...fs.map((x) => ({ path: x.name }))])}
        onRemoveAttachment={(p) => setFiles((f) => f.filter((x) => x.path !== p))}
        picks={{
          label: 'References from the board',
          items: REFS.map((r) => ({ ...r, checked: refs.includes(r.id) })),
          onToggle: (id) =>
            setRefs((rs) => (rs.includes(id) ? rs.filter((r) => r !== id) : [...rs, id]))
        }}
        context={
          <>
            {refs.length > 0 && (
              <ContextChip
                icon={Images}
                removeLabel="Remove the references"
                onRemove={() => setRefs([])}
              >
                {refs.length === 1 ? '1 reference' : `${refs.length} references`}
              </ContextChip>
            )}
            {parts && (
              <ContextChip
                icon={Boxes}
                title={
                  'keep/roof of stone_watchtower_v3.litematic\nbox (0, 19, 0)–(15, 27, 15), build.py:88'
                }
                removeLabel="Remove the selected parts"
                onRemove={() => setParts(false)}
              >
                keep/roof of stone_watchtower_v3.litematic
              </ContextChip>
            )}
          </>
        }
        modes={MODES}
        mode={mode}
        onModeChange={setMode}
        models={MODELS}
        model={model}
        onModelChange={setModel}
        efforts={EFFORTS}
        effort={effort}
        onEffortChange={setEffort}
        suggestion={suggestion}
        onDismissSuggestion={() => setSuggestion(null)}
      />
      {sent && <p className="text-sm text-fg-muted">Sent (demo): “{sent}”</p>}
    </div>
  )
}

function CommandDialogsDemo(): ReactElement {
  const [dialog, setDialog] = useState<'rewind' | 'context' | null>(null)
  const [point, setPoint] = useState('')
  const close = (): void => setDialog(null)
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => setDialog('rewind')}>
        Open rewind
      </Button>
      <Button size="sm" variant="outline" onClick={() => setDialog('context')}>
        Open context
      </Button>
      {dialog === 'rewind' && (
        <RewindDialog
          points={[
            { id: 'roof', text: 'Raise the gatehouse roof by two blocks.' },
            { id: 'stone', text: 'Try a darker stone palette.' }
          ]}
          point={point}
          onPoint={setPoint}
          preview={{ files: ['build.py', 'DESIGN.md'], unavailable: null }}
          loading={false}
          running={false}
          onClose={close}
          onRewind={close}
        />
      )}
      {dialog === 'context' && (
        <ContextDialog
          context={{
            tokens: 48_400,
            max: 200_000,
            categories: [{ name: 'Messages', tokens: 36_000 }]
          }}
          onCompact={close}
          onClose={close}
        />
      )}
    </div>
  )
}

const REFS = [
  { id: 'r1', label: 'Gatehouse with a portcullis', image: hero },
  { id: 'r2', label: 'Dark oak roof, steep eaves', image: hero },
  { id: 'r3', label: 'https://example.com/keep-reference' }
]

function ModelEffortDemo(): ReactElement {
  const [model, setModel] = useState('sonnet')
  const [effort, setEffort] = useState('high')
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ModelEffortPicker
        models={MODELS}
        model={model}
        onModelChange={setModel}
        efforts={EFFORTS}
        effort={effort}
        onEffortChange={setEffort}
      />
      <ModelEffortPicker
        models={[{ value: 'qwen3-coder', label: 'Qwen3 Coder' }]}
        model="qwen3-coder"
      />
    </div>
  )
}

function McpPopoverDemo(): ReactElement {
  const [servers, setServers] = useState([
    { name: 'studio', status: 'connected', scope: 'sdk', error: null },
    { name: 'context7', status: 'connected', scope: 'project', error: null },
    { name: 'filesystem', status: 'disabled', scope: 'project', error: null }
  ])
  return (
    <div className="max-w-96 rounded-lg border border-border-default bg-surface-overlay p-3 shadow-lg">
      <McpPopoverContent
        buildName="stone_watchtower"
        workspace="C:\\Users\\builder\\minecraft-workspace"
        live
        canToggle
        servers={servers}
        onToggle={(name, on) =>
          setServers((prev) =>
            prev.map((s) => (s.name === name ? { ...s, status: on ? 'connected' : 'disabled' } : s))
          )
        }
        onOpenSettings={() => undefined}
      />
    </div>
  )
}

export default function AgentComposer(): ReactElement {
  return (
    <div>
      <Sub
        title="Composer"
        note="Type / for commands. Enter runs the selected command or inserts a provider skill. Tab completes an entry, Escape closes, and Shift Tab cycles the permission mode."
      >
        <Grid min="24rem">
          <Cell
            label="Interactive: attachments, a reference and a parts chip"
            surface="none"
            className="overflow-hidden"
          >
            <Narrow width={24}>
              <LiveComposer />
            </Narrow>
          </Cell>
          <Cell label="Running: Stop instead of Send" surface="none" className="overflow-hidden">
            <LiveComposer running />
          </Cell>
          <Cell
            label="Ghost-text suggestion (Tab edits, Enter sends, Esc dismisses)"
            surface="none"
            className="overflow-hidden"
          >
            <Narrow width={24}>
              <LiveComposer initialSuggestion="Run build.py proto and show the render sheet" />
            </Narrow>
          </Cell>
          <Cell
            label="Needs setup (disabled), Ollama: no effort"
            surface="none"
            className="overflow-hidden"
          >
            <Composer
              onSend={() => undefined}
              onStop={() => undefined}
              models={[{ value: 'llama', label: 'Llama 3.1 8B Instruct' }]}
              model="llama"
              sigils={['$', '/']}
              disabledReason="AI needs setup. Open Settings → AI assistant."
              modes={MODES.slice(0, 3)}
              mode="auto"
              onModeChange={() => undefined}
              attachments={[
                { path: 'builds/stone_watchtower/attachments/site_photo.jpg', uploading: true }
              ]}
              onAttach={() => undefined}
            />
          </Cell>
          <Cell label="Minimum Chat dock, touch density" surface="none">
            <Narrow width={22}>
              <Touch>
                <LiveComposer narrow />
              </Touch>
            </Narrow>
          </Cell>
        </Grid>
      </Sub>
      <Sub
        title="Model & Effort picker"
        note="Popover with clean model list and stepped Reasoning effort slider (5 stops vs. Ollama without effort)."
      >
        <Cell label="Interactive triggers">
          <ModelEffortDemo />
        </Cell>
      </Sub>
      <Sub
        title="MCP quick-connect popover"
        note="Single-view popover with build-aware copyable chat prompt, client setup commands, and live embedded server toggles."
      >
        <Cell label="Connected thread with custom servers" surface="none">
          <McpPopoverDemo />
        </Cell>
      </Sub>
      <Sub
        title="Chat command dialogs"
        note="Rewind shows the affected build files before restoration. Context uses aligned token counts."
      >
        <CommandDialogsDemo />
      </Sub>
      <Sub
        title="ThreadListItem"
        note="A thread in the picker: working, live or closed; awaiting approval; unread replies. Close shows on hover and focus."
      >
        <Grid min="24rem">
          <Cell label="Threads">
            <div className="flex flex-col">
              <ThreadListItem
                title="Taller keep, darker roof"
                build="stone_watchtower"
                state="busy"
                active
                onSelect={() => undefined}
                onClose={() => undefined}
              />
              <ThreadListItem
                title="Fix the falling blocks"
                build="stone_watchtower"
                state="live"
                awaiting
                onSelect={() => undefined}
                onClose={() => undefined}
              />
              <ThreadListItem
                title="Bridge railings"
                build="river_bridge"
                state="live"
                unread
                updated="14:02"
                onSelect={() => undefined}
                onClose={() => undefined}
              />
              <ThreadListItem
                title="First draft of the windmill with a very long title that has to truncate"
                build="windmill_on_the_hill"
                state="off"
                updated="Oct 30"
                onSelect={() => undefined}
                onClose={() => undefined}
              />
            </div>
          </Cell>
          <Cell label="Touch density">
            <Touch>
              <ThreadListItem
                title="Fix the falling blocks"
                build="stone_watchtower"
                state="live"
                awaiting
                unread
                onSelect={() => undefined}
                onClose={() => undefined}
              />
            </Touch>
          </Cell>
        </Grid>
      </Sub>
    </div>
  )
}
