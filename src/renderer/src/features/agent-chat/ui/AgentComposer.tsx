// The Agent panel's composer: the kit Composer bound to the active thread. Files come by paste, drop or the clip
// (saved under the build's attachments/); board refs and the Parts tab's selected parts go along as context; the
// permission mode, model and effort, and the skill picker after / ($ for Codex).
import { useEffect, useState, type ReactElement } from 'react'
import { Boxes, Compass, FilePen, Images, Shield, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/primitives/button'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover'
import { Composer, type Option } from '@/features/agent-chat/ui/Composer'
import type { ChatCommand, ChatCommandResult } from '@/features/agent-chat/model/commands'
import { ContextChip, type Attachment } from '@/features/agent-chat/ui/Messages'
import { buildUrl } from '@/shared/lib/urls'
import { useAvailability } from '@/entities/availability/model/availability'
import { errorMessage } from '@/shared/ui/feedback/errors'
import {
  busy,
  dismissSuggestion,
  effortLabel,
  interrupt,
  resolveAgentPrefs,
  send,
  setMode,
  useAgentPrefs,
  useThread
} from '@/features/agent-chat/model/agent'
import { partsContext, useAskParts } from '@/entities/parts/model/parts'
import { EMPTY_REF_IDS, refPath, refsText, useChatRefs, useRefs } from '@/entities/ref/model/refs'
import {
  attachFile,
  configureModel,
  useAgentCommands,
  useAgentModels
} from '@/features/agent-chat/model/composer'
import type { AgentMode, Effort, Ref } from '@shared/api'

const MAX_FILES = 10 // AgentSendSchema's cap
const MODES: Record<AgentMode, Option> = {
  default: {
    value: 'default',
    label: 'Manual',
    description: 'Asks before each edit and command',
    icon: <Shield aria-hidden className="size-3.5" />
  },
  acceptEdits: {
    value: 'acceptEdits',
    label: 'Accept edits',
    description: 'Runs every edit and command without asking',
    icon: <FilePen aria-hidden className="size-3.5" />
  },
  auto: {
    value: 'auto',
    label: 'Auto',
    description: 'Runs every call without asking',
    icon: <Zap aria-hidden className="size-3.5 text-warning-text" />
  },
  plan: {
    value: 'plan',
    label: 'Plan',
    description: 'Plans first and asks before it edits',
    icon: <Compass aria-hidden className="size-3.5 text-accent-text" />
  }
}
// a pasted screenshot is called image.png: give it a findable name
const fileName = (f: File): string =>
  f.name && f.name !== 'image.png'
    ? f.name
    : `pasted-${Date.now()}.${f.type.split('/')[1] || 'png'}`

export function AgentComposer({
  onCommand,
  draftRequest
}: {
  onCommand(name: ChatCommand, args: string): ChatCommandResult
  draftRequest?: { id: number; text: string } | null
}): ReactElement {
  const availability = useAvailability().data
  const [files, setFiles] = useState<string[]>([])
  const [uploading, setUploading] = useState<string[]>([])
  const id = useThread((t) => t.id)
  const build = useThread((t) => t.build)
  const refIds = useChatRefs((s) => (build ? (s.byBuild[build] ?? EMPTY_REF_IDS) : EMPTY_REF_IDS))
  const asked = useAskParts((s) => s.ask)
  const ask = asked && asked.build === build ? asked : null
  const mode = useThread((t) => t.mode)
  const running = useThread((t) => busy(t.state))
  const live = useThread((t) => t.state.status !== 'off')
  const suggestion = useThread((t) => (t.asks.length ? null : t.suggestion))
  const capabilities = useThread((t) => t.state.capabilities)
  const provider = useThread((t) => t.state.provider)
  const prefs = useAgentPrefs()
  const models = useAgentModels(provider)
  const resolved = resolveAgentPrefs(provider, prefs, models.data)
  const board = useRefs(build)
  // what the board has now, so a ref deleted or re-noted there goes as it is
  const refs = (board.data ?? []).filter((r) => refIds.includes(r.id))
  const commands = useAgentCommands(provider, id, live)

  const attach = async (list: File[]): Promise<void> => {
    if (!build) return
    const room = MAX_FILES - files.length - uploading.length
    if (list.length > room) toast.error(`Up to ${MAX_FILES} files per message.`)
    for (const f of list.slice(0, Math.max(0, room))) {
      const name = fileName(f)
      setUploading((u) => [...u, name])
      // a promise chain, not try/finally: React Compiler skips components with a finally block
      await attachFile(build, name, f)
        .then(
          (path) => setFiles((fs) => [...fs, path]),
          (e) => void toast.error('Couldn’t attach ' + name + '. ' + errorMessage(e))
        )
        .finally(() => setUploading((u) => u.filter((n) => n !== name)))
    }
  }
  const go = (text: string): void => {
    const context = [
      refs.length && build ? refsText(build, refs) : '',
      ask ? partsContext(ask.version, ask.parts) : ''
    ]
    void send([text, ...context].filter(Boolean).join('\n\n'), {
      attachments: files.length ? files : undefined
    })
    if (build) useChatRefs.getState().clear(build)
    setFiles([])
    if (ask) useAskParts.setState({ ask: null })
  }
  const pick = (p: { model?: string | null; effort?: Effort | null }): void => {
    useAgentPrefs.setState(p)
    const { model, effort } = resolveAgentPrefs(provider, useAgentPrefs.getState(), models.data)
    if (live && model) configureModel(id, model, effort)
  }
  const modelOptions: Option[] = [
    ...(resolved.model && !models.data?.some((m) => m.value === resolved.model)
      ? [{ value: resolved.model, label: resolved.model === 'sonnet' ? 'Sonnet' : resolved.model }]
      : []),
    ...(models.data ?? []).map((m) => ({ value: m.value, label: m.name }))
  ]
  const attachments: Attachment[] = [
    ...files.map((path) => ({ path, url: buildUrl(path) })),
    ...uploading.map((path) => ({ path, uploading: true }))
  ]
  const disabledReason =
    availability && !availability.features.ai.ok
      ? 'Open Settings → AI assistant to set up your provider.'
      : models.error && !resolved.model
        ? `Couldn’t load models. Check your AI provider in Settings. ${errorMessage(models.error)}`
        : !resolved.model
          ? models.isPending
            ? 'Loading models…'
            : 'No models are available. Check your AI provider in Settings.'
          : undefined

  return (
    <Composer
      onSend={go}
      onStop={() => void interrupt()}
      running={running}
      disabledReason={disabledReason}
      sigils={provider === 'claude' ? ['/'] : ['$', '/']}
      commands={commands.data ?? []}
      onCommand={(name, args) => {
        if (name === 'skills') {
          if (commands.data?.some((c) => c.skill !== false)) return 'skills'
          if (commands.error) toast.error(errorMessage(commands.error))
          else
            toast.info(
              commands.isPending
                ? 'Skills are loading. Try again shortly.'
                : 'No skills are available.'
            )
          return
        }
        if (name === 'model') {
          if (running) toast.info('Wait for the current turn to finish before choosing a model.')
          else if (provider === 'ollama')
            toast.info('Choose the Ollama model in Settings → AI assistant.')
          else if (modelOptions.length) return 'model'
          else toast.info(disabledReason ?? 'No models are available.')
          return
        }
        return onCommand(name, args)
      }}
      attachments={attachments}
      onAttach={(fs) => void attach(fs)}
      onRemoveAttachment={(p) => setFiles((fs) => fs.filter((f) => f !== p))}
      maxFiles={MAX_FILES}
      picks={
        board.data && {
          label: 'References from the board',
          items: board.data.map((r) => ({
            id: r.id,
            label: r.note || r.url || r.title || r.id,
            image: r.kind === 'image' ? buildUrl(refPath(build, r)) : undefined,
            checked: refIds.includes(r.id)
          })),
          onToggle: (rid) => build && useChatRefs.getState().toggle(build, rid)
        }
      }
      context={
        (ask || refs.length > 0) && (
          <>
            {ask && (
              <ContextChip
                icon={Boxes}
                title={partsContext(ask.version, ask.parts)}
                removeLabel="Remove the selected parts"
                onRemove={() => useAskParts.setState({ ask: null })}
              >
                {ask.parts.length === 1
                  ? ask.parts[0].name === '-'
                    ? 'Untagged blocks'
                    : ask.parts[0].name
                  : `${ask.parts.length} parts`}{' '}
                of {ask.version.split('/').pop()}
              </ContextChip>
            )}
            {refs.length > 0 && (
              <ContextChip
                icon={Images}
                title={refs.map((r) => r.note || r.url || r.title).join('\n')}
                removeLabel="Remove the references"
                onRemove={() => build && useChatRefs.getState().clear(build)}
              >
                {refs.length === 1 ? '1 reference' : `${refs.length} references`}
              </ContextChip>
            )}
          </>
        )
      }
      modes={capabilities.modes.map((m) => MODES[m])}
      mode={mode}
      onModeChange={(m) => void setMode(m as AgentMode)}
      models={modelOptions}
      model={resolved.model ?? undefined}
      onModelChange={provider === 'ollama' ? undefined : (model) => pick({ model })}
      efforts={resolved.efforts.map((e) => ({ value: e, label: effortLabel(e) }))}
      effort={resolved.effort ?? undefined}
      onEffortChange={(effort) => pick({ effort: effort as Effort })}
      suggestion={suggestion}
      onDismissSuggestion={dismissSuggestion}
      draftRequest={draftRequest}
      placeholder={`Ask the agent (/ for commands${provider === 'claude' ? '' : ', $ for skills'})`}
    />
  )
}

/**
 * References from the build's board to send with the next message (the composer and the Brief dialog):
 * a button with how many are picked, opening a checklist. Hidden while the board is empty.
 */
export function RefsPicker({
  build,
  picked,
  onChange
}: {
  build: string
  picked: Ref[]
  onChange: (refs: Ref[]) => void
}): ReactElement | null {
  const refs = useRefs(build)
  // a ref deleted or re-noted on the board: send what the board has now
  useEffect(() => {
    if (!refs.data) return
    const now = picked.flatMap((p) => refs.data.filter((r) => r.id === p.id))
    if (now.length !== picked.length || now.some((r, i) => r !== picked[i])) onChange(now)
  }, [refs.data]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!refs.data?.length) return null
  const has = (r: Ref): boolean => picked.some((p) => p.id === r.id)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-(--density-control-sm)">
          <Images aria-hidden />
          {picked.length
            ? `${picked.length} of ${refs.data.length} references`
            : 'Attach references'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-1">
        <p className="px-2 py-1.5 text-sm text-fg-secondary">
          References from the board go with the next message.
        </p>
        <ul className="max-h-64 overflow-y-auto">
          {refs.data.map((r) => (
            <li key={r.id}>
              <label className="flex min-h-(--density-row) cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-hover">
                <Checkbox
                  checked={has(r)}
                  onCheckedChange={() =>
                    onChange(has(r) ? picked.filter((p) => p.id !== r.id) : [...picked, r])
                  }
                />
                {r.kind === 'image' ? (
                  <img
                    src={buildUrl(refPath(build, r))}
                    alt=""
                    className="size-8 shrink-0 rounded-sm object-cover"
                  />
                ) : (
                  <span className="w-8 shrink-0 text-center text-xs text-fg-muted">
                    {r.kind === 'link' ? 'link' : 'note'}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{r.note || r.url || r.title}</span>
              </label>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
