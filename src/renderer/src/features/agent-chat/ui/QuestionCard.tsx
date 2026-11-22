// Step-by-step interactive quiz card for model questions (Claude AskUserQuestion & Codex request_user_input).
import { useId, useState, type ReactElement } from 'react'
import { Check, MessageCircleQuestion } from 'lucide-react'
import type { AgentQuestion } from '@shared/api'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Checkbox } from '@/shared/ui/primitives/checkbox'
import { Input } from '@/shared/ui/primitives/input'
import { Prose } from '@/shared/ui/code/Prose'

export interface QuestionCardProps {
  questions: AgentQuestion[]
  onSubmit: (
    answers: Record<string, string[]>,
    annotations?: Record<string, { preview?: string; notes?: string }>
  ) => void
  onSkip: () => void
  className?: string
}

export function QuestionCard({
  questions,
  onSubmit,
  onSkip,
  className
}: QuestionCardProps): ReactElement | null {
  const titleId = useId()
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [other, setOther] = useState<Record<string, string>>({})
  const [hoveredPreview, setHoveredPreview] = useState<string | null>(null)

  if (!questions.length) return null
  const current = questions[Math.min(step, questions.length - 1)]
  const multiStep = questions.length > 1

  const answersFor = (
    q: AgentQuestion,
    sel: Record<string, string[]> = selected,
    oth: Record<string, string> = other
  ): string[] => {
    const picked = sel[q.id] ?? []
    const custom = (oth[q.id] ?? '').trim()
    return custom ? [...picked, custom] : picked
  }

  const totalAnswered = questions.filter((q) => answersFor(q).length > 0).length
  const picked = selected[current.id] ?? []
  const customValue = other[current.id] ?? ''
  const hasPreviews = current.options.some((o) => !!o.preview)
  const activePreview =
    hoveredPreview ??
    current.options.find((o) => picked.includes(o.label) && o.preview)?.preview ??
    null

  const advance = (
    nextSelected: Record<string, string[]>,
    nextOther: Record<string, string>
  ): void => {
    if (!multiStep) return
    const nextUnanswered = questions.findIndex(
      (q, i) => i > step && answersFor(q, nextSelected, nextOther).length === 0
    )
    if (nextUnanswered >= 0) setStep(nextUnanswered)
    else if (step < questions.length - 1) setStep(step + 1)
  }

  const pickSingle = (label: string): void => {
    const nextSelected = { ...selected, [current.id]: [label] }
    const nextOther = { ...other, [current.id]: '' }
    setSelected(nextSelected)
    setOther(nextOther)
    setHoveredPreview(null)
    // Pause auto-advance when options carry previews so the reader can inspect them before moving on.
    if (!hasPreviews) advance(nextSelected, nextOther)
  }

  const toggleMulti = (label: string): void => {
    const exists = picked.includes(label)
    const next = exists ? picked.filter((x) => x !== label) : [...picked, label]
    setSelected({ ...selected, [current.id]: next })
  }

  const setCustom = (value: string): void => {
    setOther({ ...other, [current.id]: value })
    if (!current.multiSelect && value.trim()) {
      setSelected({ ...selected, [current.id]: [] })
    }
  }

  const submit = (): void => {
    const answers: Record<string, string[]> = {}
    const annotations: Record<string, { preview?: string }> = {}
    for (const q of questions) {
      const vals = answersFor(q)
      if (!vals.length) continue
      answers[q.id] = vals
      const preview = q.options.find((o) => vals.includes(o.label) && o.preview)?.preview
      if (preview) annotations[q.id] = { preview }
    }
    onSubmit(answers, Object.keys(annotations).length ? annotations : undefined)
  }

  const isLast = step >= questions.length - 1

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex min-w-0 flex-col gap-2.5 rounded-lg border border-accent-subtle-border bg-surface-raised p-3',
        className
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <MessageCircleQuestion aria-hidden className="size-4 shrink-0 text-accent-text" />
          {multiStep ? (
            <div role="tablist" aria-label="Questions" className="flex min-w-0 flex-wrap gap-1">
              {questions.map((q, i) => {
                const done = answersFor(q).length > 0
                const active = i === step
                return (
                  <button
                    key={q.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setStep(i)
                      setHoveredPreview(null)
                    }}
                    className={cn(
                      'focus-ring inline-flex h-6 max-w-full cursor-pointer items-center gap-1 rounded-sm border px-2 text-xs font-medium transition-[color,background-color,border-color] duration-fast ease-standard',
                      active
                        ? 'border-accent-subtle-border bg-accent-subtle text-accent-text'
                        : 'border-border-default text-fg-secondary can-hover:bg-surface-hover can-hover:text-fg'
                    )}
                  >
                    {done && <Check aria-hidden className="size-3 shrink-0" />}
                    <span className="truncate">{q.header || `Q${i + 1}`}</span>
                    {done && <span className="sr-only">answered</span>}
                  </button>
                )
              })}
            </div>
          ) : (
            <Badge variant="accent">{current.header || 'Question'}</Badge>
          )}
        </div>
        {multiStep && (
          <span className="shrink-0 font-mono text-xs text-fg-muted tabular-nums">
            {step + 1}/{questions.length}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 id={titleId} className="text-base font-medium wrap-anywhere text-fg">
          {current.question}
        </h3>
        {current.multiSelect && (
          <p className="text-xs text-fg-secondary">Select one or more options.</p>
        )}
      </div>

      {current.options.length > 0 && (
        <div
          role={current.multiSelect ? 'group' : 'radiogroup'}
          aria-labelledby={titleId}
          className="flex min-w-0 flex-col gap-1.5"
        >
          {current.options.map((opt) => {
            const isPicked = picked.includes(opt.label)
            if (current.multiSelect) {
              return (
                <label
                  key={opt.label}
                  onMouseEnter={() => opt.preview && setHoveredPreview(opt.preview)}
                  onMouseLeave={() => setHoveredPreview(null)}
                  className={cn(
                    'flex min-h-(--density-row) min-w-0 cursor-pointer items-start gap-2.5 rounded-md border p-2 transition-[border-color,background-color] duration-fast ease-standard',
                    isPicked
                      ? 'border-accent-solid bg-accent-subtle'
                      : 'border-border-default bg-surface-panel can-hover:border-border-strong can-hover:bg-surface-hover'
                  )}
                >
                  <Checkbox
                    checked={isPicked}
                    onCheckedChange={() => toggleMulti(opt.label)}
                    className="mt-0.5"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-base font-medium wrap-anywhere text-fg">{opt.label}</span>
                    {opt.description && (
                      <span className="text-sm wrap-anywhere text-fg-secondary">
                        {opt.description}
                      </span>
                    )}
                  </span>
                </label>
              )
            }
            return (
              <button
                key={opt.label}
                type="button"
                role="radio"
                aria-checked={isPicked}
                onClick={() => pickSingle(opt.label)}
                onMouseEnter={() => opt.preview && setHoveredPreview(opt.preview)}
                onMouseLeave={() => setHoveredPreview(null)}
                onFocus={() => opt.preview && setHoveredPreview(opt.preview)}
                className={cn(
                  'focus-ring flex min-h-(--density-row) w-full min-w-0 cursor-pointer items-start gap-2.5 rounded-md border p-2 text-left transition-[border-color,background-color] duration-fast ease-standard',
                  isPicked
                    ? 'border-accent-solid bg-accent-subtle'
                    : 'border-border-default bg-surface-panel can-hover:border-border-strong can-hover:bg-surface-hover'
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border bg-surface-sunken',
                    isPicked ? 'border-accent-solid' : 'border-border-strong'
                  )}
                >
                  {isPicked && <span className="size-2 rounded-full bg-accent-solid" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base font-medium wrap-anywhere text-fg">{opt.label}</span>
                  {opt.description && (
                    <span className="text-sm wrap-anywhere text-fg-secondary">
                      {opt.description}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {activePreview && (
        <div className="max-h-40 overflow-auto rounded-md border border-border-subtle bg-surface-sunken p-2">
          <Prose variant="chat">{activePreview}</Prose>
        </div>
      )}

      {(current.allowOther || current.options.length === 0) && (
        <Input
          type={current.secret ? 'password' : 'text'}
          value={customValue}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
            e.preventDefault()
            if (!isLast) {
              setStep(step + 1)
              setHoveredPreview(null)
            } else if (totalAnswered > 0) {
              submit()
            }
          }}
          aria-label={
            current.options.length === 0
              ? `Answer for ${current.header || current.question}`
              : `Other answer for ${current.header || current.question}`
          }
          placeholder={
            current.options.length === 0 ? 'Type your answer…' : 'Other (type a custom answer)…'
          }
        />
      )}

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-2">
        {multiStep && step > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-(--density-control-sm)"
            onClick={() => {
              setStep(step - 1)
              setHoveredPreview(null)
            }}
          >
            Back
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-(--density-control-sm)" onClick={onSkip}>
          Skip
        </Button>
        <span className="flex-1" />
        {!isLast ? (
          <Button
            size="sm"
            className="h-(--density-control-sm)"
            onClick={() => {
              setStep(step + 1)
              setHoveredPreview(null)
            }}
          >
            Next
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-(--density-control-sm)"
            disabled={totalAnswered === 0}
            onClick={submit}
          >
            {multiStep ? `Submit (${totalAnswered}/${questions.length})` : 'Submit'}
          </Button>
        )}
      </div>
    </section>
  )
}
