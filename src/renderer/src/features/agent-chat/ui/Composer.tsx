import { useId, useState, type ReactElement, type ReactNode } from 'react'
import { ChevronDown, Paperclip, Send, Square } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/shared/ui/primitives/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/ui/primitives/select'
import { cn } from '@/shared/lib/utils'
import { IconAction, Tip } from '@/shared/ui/common/Tip'
import { DropOverlay } from '@/shared/ui/feedback/DropOverlay'
import { matchCommands, type Command } from '../model/logic'
import {
  chatCommands,
  parseChatCommand,
  type ChatCommand,
  type ChatCommandResult
} from '../model/commands'
import { AttachmentChip, type Attachment } from './Messages'

/** A picker choice; `description` is its second line in the open list (not in the trigger). */
export type Option = { value: string; label: string; description?: string }
/** Something from elsewhere the attach menu offers beside files: a board reference, say. */
export type AttachPick = { id: string; label: string; image?: string; checked: boolean }

/** A compact select for the composer's permission mode picker; the tooltip names it. */
function Picker({
  label,
  value,
  options,
  onChange,
  title,
  triggerValue,
  className
}: {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  title?: string
  triggerValue?: ReactNode
  className?: string
}): ReactElement {
  return (
    <Select value={value} onValueChange={onChange}>
      <Tip label={title ?? label}>
        <SelectTrigger
          size="sm"
          aria-label={label}
          className={cn('w-auto max-w-44 shrink-0 font-mono text-sm', className)}
        >
          <SelectValue>{triggerValue}</SelectValue>
        </SelectTrigger>
      </Tip>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} description={o.description}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// the permission modes and their tones: Auto runs without asking, so it reads as a warning; Plan is the accent
const MODE_TONE: Record<string, string> = { auto: 'text-warning-text', plan: 'text-accent-text' }

/**
 * The assistant's input. Enter sends, Shift Enter adds a line, Shift Tab cycles the permission mode, and
 * a leading / (or $ for Codex) opens the skill picker. Files come by paste, drop or the clip button.
 * The textarea grows with its text up to a cap. While a turn runs, Send becomes Stop.
 * `compact` is the Variants lane's: one growing line with Send (or Stop) beside it, no attach or pickers;
 * the lane's thread holds the mode and model.
 */
export function Composer({
  onSend,
  onStop,
  running = false,
  disabledReason,
  sigils = ['/'],
  commands = [],
  onCommand,
  attachments = [],
  onAttach,
  onRemoveAttachment,
  maxFiles = 10,
  context,
  picks,
  modes,
  mode,
  onModeChange,
  models,
  model = '',
  onModelChange,
  efforts,
  effort = '',
  onEffortChange,
  initialText = '',
  variant = 'default',
  placeholder,
  className
}: {
  onSend: (text: string) => void
  onStop: () => void
  running?: boolean
  /** Why the assistant cannot take a message now; shows under the input and disables Send. */
  disabledReason?: string
  /** "/" for Claude Code, "$" and "/" for Codex and Ollama. */
  sigils?: string[]
  commands?: Command[]
  onCommand?: (name: ChatCommand, args: string) => ChatCommandResult
  attachments?: Attachment[]
  onAttach?: (files: File[]) => void
  onRemoveAttachment?: (path: string) => void
  maxFiles?: number
  /** Context chips sent with the next message: selected parts, refs. */
  context?: ReactNode
  /** Turns the clip into a menu: Files…, then these items to tick (the screen shows what is ticked as context). */
  picks?: { label: string; items: AttachPick[]; onToggle: (id: string) => void }
  /** Required by the default variant; compact has no mode picker. */
  modes?: Option[]
  mode?: string
  onModeChange?: (mode: string) => void
  models?: Option[]
  model?: string
  onModelChange?: (model: string) => void
  /** Omit when the provider has no effort setting (Ollama). */
  efforts?: Option[]
  effort?: string
  onEffortChange?: (effort: string) => void
  initialText?: string
  variant?: 'default' | 'compact'
  placeholder?: string
  className?: string
}): ReactElement {
  const compact = variant === 'compact'
  const modelLabel = models?.find((option) => option.value === model)?.label ?? model
  const effortLabel = efforts?.find((option) => option.value === effort)?.label ?? effort
  const groups = [
    { label: 'Model', value: model, options: models, onChange: onModelChange },
    { label: 'Effort', value: effort, options: efforts, onChange: onEffortChange }
  ].filter((group) => group.options?.length)
  const selectionLabel = [modelLabel, effortLabel].filter(Boolean).join(', ')
  const [text, setText] = useState(initialText)
  const [hidden, setHidden] = useState(false) // Escape closed the picker until the text changes
  const [active, setActive] = useState(0)
  const [drag, setDrag] = useState(false)
  const [skillPicker, setSkillPicker] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const id = useId()
  const local = onCommand && !skillPicker && text.startsWith('/')
  const offered = skillPicker
    ? commands.filter((c) => c.skill !== false)
    : local
      ? [
          ...chatCommands,
          ...(sigils[0] === '/' ? commands.filter((c) => !parseChatCommand('/' + c.name)) : [])
        ]
      : commands
  const { matches } = hidden ? { matches: [] } : matchCommands(text, sigils, offered)
  const open = matches.length > 0
  const at = Math.min(active, matches.length - 1)
  const uploading = attachments.some((a) => a.uploading)
  const selected = onCommand && !skillPicker ? parseChatCommand(text) : null
  const canSend = !!text.trim() && (selected || (!running && !uploading && !disabledReason))
  const sigil = sigils[0]

  const runCommand = ({ name, args }: NonNullable<ReturnType<typeof parseChatCommand>>): void => {
    const result = onCommand?.(name, args)
    setSkillPicker(result === 'skills')
    setText(result === 'skills' ? sigil : '')
    setHidden(false)
    setActive(0)
    if (result === 'model') setModelOpen(true)
  }
  const send = (): void => {
    if (!canSend) return
    if (selected) return runCommand(selected)
    onSend(text.trim())
    setText('')
    setSkillPicker(false)
  }
  const insert = (c: Command): void => {
    const command = local && parseChatCommand('/' + c.name)
    if (command) return runCommand(command)
    setText(`${text[0]}${c.name} `)
    setHidden(true)
  }
  const attach = (list: FileList | null): void => {
    if (!list?.length || !onAttach) return
    onAttach([...list].slice(0, Math.max(0, maxFiles - attachments.length)))
  }
  const pick = (): void => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = () => attach(input.files)
    input.click()
  }
  const current = modes?.find((m) => m.value === mode)

  return (
    <div
      className={cn(
        'relative flex shrink-0 gap-1.5 border-t border-border-default bg-surface-panel p-2',
        compact ? 'items-end' : 'flex-col',
        !compact && '@container',
        className
      )}
      onDragOver={(e) => {
        if (!onAttach || !e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDrag(false)}
      onDrop={(e) => {
        if (!onAttach || !e.dataTransfer.files.length) return
        e.preventDefault()
        setDrag(false)
        attach(e.dataTransfer.files)
      }}
    >
      <DropOverlay active={drag} label={`Drop files to attach (up to ${maxFiles})`} />
      <div className={cn('relative', compact && 'min-w-0 flex-1')}>
        {open && (
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label={local ? 'Chat commands' : 'Skills'}
            className="absolute inset-x-0 bottom-full z-(--z-dropdown) mb-1 max-h-64 overflow-auto rounded-lg border border-border-default bg-surface-overlay p-1 shadow-md"
          >
            {matches.map((c, i) => (
              <li
                key={c.name}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === at}
                onMouseDown={(e) => e.preventDefault()} // keep the textarea focused
                onMouseEnter={() => setActive(i)}
                onClick={() => insert(c)}
                className={cn(
                  'flex min-h-(--density-row) cursor-default items-baseline gap-2 rounded-md px-2 py-1',
                  i === at && 'bg-surface-hover'
                )}
              >
                <span className="shrink-0 font-mono text-sm text-fg">
                  {text[0]}
                  {c.name}
                  {c.hint && <span className="text-fg-muted"> {c.hint}</span>}
                </span>
                {c.description && (
                  <span className="min-w-0 truncate text-sm text-fg-secondary">
                    {c.description}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <textarea
          value={text}
          aria-label="Message the assistant"
          aria-autocomplete="list"
          aria-controls={open ? `${id}-list` : undefined}
          aria-activedescendant={open ? `${id}-opt-${at}` : undefined}
          aria-describedby={disabledReason ? `${id}-why` : undefined}
          onChange={(e) => {
            setText(e.target.value)
            if (!e.target.value.startsWith(sigil)) setSkillPicker(false)
            setHidden(false)
            setActive(0)
          }}
          onPaste={(e) => {
            // files alone (a screenshot, files copied in Explorer); text with an image rendering pastes as text
            if (!onAttach || !e.clipboardData.files.length || e.clipboardData.getData('text/plain'))
              return
            e.preventDefault()
            attach(e.clipboardData.files)
          }}
          onKeyDown={(e) => {
            if (open) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                const n = matches.length
                return setActive((at + (e.key === 'ArrowDown' ? 1 : n - 1)) % n)
              }
              if (
                (e.key === 'Enter' || e.key === 'Tab') &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault()
                if (e.key === 'Tab' && local && parseChatCommand('/' + matches[at].name)) {
                  setText(`/${matches[at].name} `)
                  return setHidden(true)
                }
                return insert(matches[at])
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                return setHidden(true)
              }
            }
            if (e.key === 'Tab' && e.shiftKey && modes && onModeChange && modes.length > 1) {
              e.preventDefault()
              const i = modes.findIndex((m) => m.value === mode)
              onModeChange(modes[(i + 1) % modes.length].value)
            } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
          rows={compact ? 1 : 2}
          placeholder={
            running
              ? compact
                ? 'Working…'
                : 'The assistant is working…'
              : (placeholder ??
                `Ask the assistant (Enter sends, Shift Enter for a new line, ${sigil} for skills)`)
          }
          className={cn(
            'block w-full resize-none rounded-lg border border-border-strong bg-surface-sunken px-3 text-base text-fg [field-sizing:content] placeholder:text-fg-muted focus-visible:border-focus focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus',
            compact ? 'max-h-32 min-h-(--density-control) py-1.5' : 'max-h-48 min-h-16 py-2'
          )}
        />
      </div>
      {compact &&
        (running ? (
          <IconAction
            label="Stop"
            icon={Square}
            onClick={onStop}
            className="size-(--density-control) text-danger-text hover:text-danger-text"
          />
        ) : (
          <IconAction
            label="Send"
            icon={Send}
            disabled={!canSend}
            onClick={send}
            tip={disabledReason ?? 'Send (Enter)'}
            className="size-(--density-control) text-accent-text hover:text-accent-text"
          />
        ))}
      {!compact && attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {attachments.map((a) => (
            <AttachmentChip
              key={a.path}
              file={a}
              onRemove={
                onRemoveAttachment && !a.uploading ? () => onRemoveAttachment(a.path) : undefined
              }
            />
          ))}
        </div>
      )}
      {!compact && context && <div className="flex flex-wrap gap-1.5 pt-1">{context}</div>}
      {disabledReason && (
        <p
          id={`${id}-why`}
          className={cn('wrap-anywhere text-sm text-fg-secondary', compact && 'sr-only')}
        >
          {disabledReason}
        </p>
      )}
      {!compact && (
        <div className="flex min-w-0 items-center gap-1">
          {picks && picks.items.length > 0 ? (
            <DropdownMenu>
              <Tip label={`Attach files or ${picks.label.toLowerCase()}`}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Attach"
                    className="size-(--density-control-sm) shrink-0 p-0 text-fg-secondary hover:text-fg"
                  >
                    <Paperclip className="size-3.5" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
              </Tip>
              <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
                {onAttach && (
                  <>
                    <DropdownMenuItem disabled={attachments.length >= maxFiles} onSelect={pick}>
                      <Paperclip aria-hidden /> Files…
                      <DropdownMenuShortcut>up to {maxFiles}</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuLabel>{picks.label}</DropdownMenuLabel>
                <div className="max-h-64 overflow-y-auto">
                  {picks.items.map((i) => (
                    <DropdownMenuCheckboxItem
                      key={i.id}
                      checked={i.checked}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={() => picks.onToggle(i.id)}
                    >
                      {i.image && (
                        <img
                          src={i.image}
                          alt=""
                          className="size-6 shrink-0 rounded-sm object-cover"
                        />
                      )}
                      <span className="min-w-0 truncate">{i.label}</span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            onAttach && (
              <IconAction
                label="Attach files"
                tip={`Attach files (up to ${maxFiles})`}
                icon={Paperclip}
                disabled={attachments.length >= maxFiles}
                onClick={pick}
              />
            )
          )}
          {modes && mode !== undefined && onModeChange && (
            <Picker
              label={current ? `Permission mode: ${current.label}` : 'Permission mode'}
              title={`${current?.description ?? current?.label ?? ''} (Shift Tab switches)`}
              value={mode}
              options={modes}
              onChange={onModeChange}
              triggerValue={
                mode === 'acceptEdits' ? (
                  <>
                    <span className="@max-[22rem]:hidden">{current?.label}</span>
                    <span className="hidden @max-[22rem]:inline">Edits</span>
                  </>
                ) : undefined
              }
              className={cn(MODE_TONE[mode], 'font-sans')}
            />
          )}
          {groups.length > 0 && (
            <DropdownMenu open={modelOpen} onOpenChange={setModelOpen}>
              <Tip label={selectionLabel}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={running}
                    aria-label={selectionLabel}
                    className="h-(--density-control-sm) min-w-0 shrink justify-start gap-1.5 px-2 font-normal"
                  >
                    <span className="min-w-0 truncate">{modelLabel}</span>
                    {effortLabel && (
                      <span className="shrink-0 text-fg-secondary">{effortLabel}</span>
                    )}
                    <ChevronDown className="shrink-0 text-fg-secondary" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
              </Tip>
              <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-1rem)]">
                {groups.map(({ label, value, options, onChange }, index) => (
                  <div key={label}>
                    {index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel>{label}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      aria-label={label}
                      value={value}
                      onValueChange={onChange}
                    >
                      {options?.map((option) => (
                        <DropdownMenuRadioItem
                          key={option.value}
                          value={option.value}
                          disabled={!onChange}
                          check
                          className="wrap-anywhere"
                        >
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {running ? (
            <Button
              size="sm"
              variant="destructive"
              className="ml-auto h-(--density-control-sm) shrink-0 @max-[22rem]:size-(--density-control-sm) @max-[22rem]:has-[>svg]:px-0"
              onClick={onStop}
            >
              <Square aria-hidden /> <span className="@max-[22rem]:sr-only">Stop</span>
            </Button>
          ) : (
            <Button
              size="sm"
              className="ml-auto h-(--density-control-sm) shrink-0 @max-[22rem]:size-(--density-control-sm) @max-[22rem]:has-[>svg]:px-0"
              disabled={!canSend}
              onClick={send}
            >
              <Send aria-hidden /> <span className="@max-[22rem]:sr-only">Send</span>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
