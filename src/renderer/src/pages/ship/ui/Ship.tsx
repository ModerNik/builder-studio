// Export (Variant A — Focused Card): a single primary button runs the full export pipeline
// automatically (setup -> advisory lint -> build -> verify -> save -> DESIGN.md & Git commit).
// Hollow count, Bill of materials, Dry run, and Rejected variants are omitted; format and
// destination folder are configurable right inside the card. State and flow: ../model/useExport.ts.
import type { KeyboardEvent, ReactElement, ReactNode } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import {
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleMinus,
  FolderOpen,
  LoaderCircle,
  Rocket,
  RotateCcw,
  TriangleAlert,
  X,
  type LucideIcon
} from 'lucide-react'
import { EXPORT_FORMAT_INFO, type ExportFormat } from '@shared/minecraft'
import { cn } from '@/shared/lib/utils'
import { INFO, isLintRuleEnabled } from '@/shared/lib/format'
import { checkLabel } from '@/entities/build/model/workspace'
import { Button } from '@/shared/ui/primitives/button'
import { Badge } from '@/shared/ui/primitives/badge'
import { Card } from '@/shared/ui/primitives/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/shared/ui/primitives/collapsible'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import { Alert } from '@/shared/ui/feedback/Alert'
import { PageHeader } from '@/shared/ui/layout/PageHeader'
import { KeyValueList } from '@/shared/ui/data/values'
import { LogViewer } from '@/shared/ui/code/LogViewer'
import { CodeBlock } from '@/shared/ui/code/CodeBlock'
import type { CheckStatus } from '@/shared/ui/data/progress'
import { endedText, exceedsVanillaStructureLimit } from '../model/ship'
import { useExport, type ExportStepId } from '../model/useExport'
import { openRenderStudio } from '@/features/render-studio/model/store'

const STATUS_ICON: Record<CheckStatus, { icon: LucideIcon; cls: string; spoken: string }> = {
  idle: { icon: Circle, cls: 'text-fg-muted', spoken: 'Not run' },
  running: {
    icon: LoaderCircle,
    cls: 'text-state-running motion-safe:animate-spin',
    spoken: 'Running'
  },
  done: { icon: Check, cls: 'text-success-text', spoken: 'Passed' },
  failed: { icon: X, cls: 'text-danger-text', spoken: 'Failed' },
  skipped: { icon: CircleMinus, cls: 'text-fg-muted', spoken: 'Skipped' },
  warning: { icon: TriangleAlert, cls: 'text-warning-text', spoken: 'Suggestion' }
}

export function Ship(): ReactElement {
  const { name } = useParams({ from: '/build/$name/ship' })
  return <Export key={name} name={name} />
}

function StepIcon({ status }: { status: CheckStatus }): ReactElement {
  const look = STATUS_ICON[status]
  const Icon = look.icon
  return (
    <>
      <Icon aria-hidden className={cn('size-4 shrink-0', look.cls)} strokeWidth={2.25} />
      <span className="sr-only">{look.spoken}</span>
    </>
  )
}

function FormatSelector({
  formats,
  value,
  disabled,
  onChange
}: {
  formats: readonly ExportFormat[]
  value: ExportFormat
  disabled: boolean
  onChange: (format: ExportFormat) => void
}): ReactElement {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    if (disabled || formats.length <= 1) return
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % formats.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (index - 1 + formats.length) % formats.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = formats.length - 1
    if (next < 0) return
    e.preventDefault()
    onChange(formats[next])
    const buttons = e.currentTarget
      .closest('[role="radiogroup"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons?.[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Export format" className="flex flex-wrap gap-2">
      {formats.map((id, index) => {
        const info = EXPORT_FORMAT_INFO[id]
        const selected = id === value
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              'focus-ring flex min-w-36 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors duration-fast ease-standard disabled:cursor-not-allowed disabled:opacity-50',
              selected
                ? 'border-accent-solid bg-accent-subtle text-fg'
                : 'border-border-default bg-surface-sunken text-fg-secondary can-hover:border-border-strong can-hover:text-fg'
            )}
          >
            <span className="flex items-baseline gap-1.5 text-sm font-medium">
              <span className="font-mono">{info.extension}</span>
              <span>{info.label}</span>
            </span>
            <span className="text-xs text-fg-muted">{info.description}</span>
          </button>
        )
      })}
    </div>
  )
}

function Export({ name }: { name: string }): ReactElement {
  const {
    build,
    minecraftVersion,
    supportedFormats,
    format,
    setFormat,
    exportDir,
    isCustomDir,
    pickExportDir,
    resetExportDir,
    linter,
    lintActive,
    busy,
    running,
    hasRun,
    expandedStep,
    setExpandedStep,
    setup,
    lintStep,
    buildStep,
    verify,
    save,
    record,
    outcome,
    checkJob,
    fullJob,
    logOf,
    exportBuild,
    cancelExport,
    revealExported
  } = useExport(name)

  if (!build) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6" aria-busy="true">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    )
  }

  const displayName = build.displayName || name

  const steps: {
    id: ExportStepId
    title: string
    status: CheckStatus
    summary: string
    badge?: ReactNode
    content: ReactNode
  }[] = [
    {
      id: 'setup',
      title: 'Check setup',
      status: setup.status,
      summary: setup.summary || `Minecraft ${minecraftVersion}, engine, and destination folder`,
      content: (
        <p className="font-mono text-sm break-words text-fg-secondary">
          {setup.summary || 'Verifies the engine runtime and export destination.'}
        </p>
      )
    },
    {
      id: 'lint',
      title: 'Lint check (advisory)',
      status: lintStep.status,
      summary:
        lintStep.summary ||
        (lintActive ? 'Suggestions only — never blocks export' : 'Linter is off in Settings'),
      badge:
        lintStep.status === 'warning' ? <Badge variant="warning">Suggestion</Badge> : undefined,
      content: !lintActive ? (
        <p className="text-sm text-fg-muted">
          {!linter.enabled
            ? 'Linter is turned off in Settings, so build suggestions are skipped.'
            : 'All lint rules are turned off in Settings.'}{' '}
          <Link
            to="/settings"
            search={{ section: 'linter' }}
            className="text-accent-text underline-offset-4 can-hover:hover:underline"
          >
            Open Settings › Linter
          </Link>
        </p>
      ) : checkJob ? (
        <div className="flex flex-col gap-3">
          {lintStep.counts && (
            <KeyValueList
              items={Object.entries(lintStep.counts).map(([k, c]) => ({
                label: checkLabel(k),
                value:
                  !INFO.has(k) && !isLintRuleEnabled(k, linter.rules) ? `${c} (off)` : String(c),
                mono: true
              }))}
            />
          )}
          <LogViewer
            lines={logOf(checkJob)}
            streaming={checkJob.state === 'running'}
            label="Advisory lint log"
            height="h-48"
          />
        </div>
      ) : (
        <p className="text-sm text-fg-muted">
          Runs enabled lint rules as suggestions without blocking export.
        </p>
      )
    },
    {
      id: 'build',
      title: 'Build schematic',
      status: buildStep.status,
      summary:
        fullJob?.state === 'running'
          ? `${fullJob.stage ?? 'starting'}…`
          : buildStep.summary || `Builds full schematic (${EXPORT_FORMAT_INFO[format].extension})`,
      content: fullJob ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-fg-secondary">
            {fullJob.state === 'running'
              ? `${fullJob.stage ?? 'Starting'}. Streaming: scroll up to pause.`
              : fullJob.state === 'failed'
                ? `Failed at ${endedText(fullJob)}.`
                : `Finished at ${endedText(fullJob)}.`}
          </p>
          <LogViewer
            lines={logOf(fullJob)}
            streaming={fullJob.state === 'running'}
            label="Full build log"
            height="h-72"
          />
        </div>
      ) : (
        <p className="text-sm text-fg-muted">
          Generates the full build and packages the schematic.
        </p>
      )
    },
    {
      id: 'verify',
      title: 'Verify export',
      status: verify.status,
      summary: verify.summary || 'Reads the packaged schematic back to confirm shape and blocks',
      content: (
        <p className="font-mono text-sm break-words text-fg-secondary">
          {verify.summary || 'Waiting for the build step to finish.'}
        </p>
      )
    },
    {
      id: 'save',
      title: 'Save to folder',
      status: save.status,
      summary: save.summary || exportDir || 'No destination folder selected',
      content: (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-sm break-all text-fg-secondary">
            {save.summary || exportDir || 'Choose an export folder above.'}
          </p>
          {outcome?.path && (
            <div>
              <Button size="sm" variant="outline" onClick={() => void revealExported()}>
                <FolderOpen aria-hidden="true" /> Show in folder
              </Button>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'record',
      title: 'Update DESIGN.md & commit',
      status: record.status,
      summary: record.summary || `Logs export in DESIGN.md and commits builds/${name}`,
      content: (
        <div className="flex flex-col gap-3">
          {record.designRows ? (
            <>
              <p className="text-sm text-fg-secondary">
                Added to DESIGN.md as “{record.designTitle}”.{' '}
                <Link
                  to="/build/$name/log"
                  params={{ name }}
                  className="text-accent-text underline-offset-4 can-hover:hover:underline"
                >
                  Open Design log
                </Link>
              </p>
              <KeyValueList items={record.designRows.map(([label, value]) => ({ label, value }))} />
            </>
          ) : (
            <p className="text-sm text-fg-muted">
              {record.summary || 'Updates DESIGN.md and commits locally after saving the file.'}
            </p>
          )}
          {record.gitOutput && (
            <CodeBlock code={record.gitOutput.trim()} title="git" lineNumbers={false} />
          )}
        </div>
      )
    }
  ]

  const nbtOversize = outcome && exceedsVanillaStructureLimit(outcome.format, outcome.shape)

  return (
    <div className="flex h-full min-w-0 flex-col overflow-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
        <PageHeader
          title="Export"
          description={`Builds ${displayName}, saves the schematic to your folder, logs the export in DESIGN.md, and commits automatically.`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!build.versions.length}
                onClick={() => openRenderStudio({ build: name })}
              >
                <Camera aria-hidden="true" /> Render images…
              </Button>
              <Badge variant="outline" className="font-mono">
                Minecraft {minecraftVersion}
              </Badge>
            </div>
          }
        />

        <Card className="gap-4 p-5">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-fg-secondary">Export format</span>
            <FormatSelector
              formats={supportedFormats}
              value={format}
              disabled={busy}
              onChange={setFormat}
            />
            {format === 'nbt' && (
              <p className="text-sm text-fg-muted">
                Vanilla Structure Blocks cap loading at 48 × 48 × 48 in-game; WorldEdit, Axiom, and
                datapacks load any size.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-fg-secondary">Destination folder</span>
              {isCustomDir && (
                <Button size="xs" variant="ghost" disabled={busy} onClick={resetExportDir}>
                  <RotateCcw aria-hidden="true" /> Reset to default
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                title={exportDir || undefined}
                className="min-w-0 flex-1 truncate rounded-md border border-border-default bg-surface-sunken px-3 py-1.5 font-mono text-sm text-fg select-text"
              >
                {exportDir || 'No destination folder configured'}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void pickExportDir()}
              >
                Change…
              </Button>
            </div>
            {!exportDir && (
              <p className="text-sm text-warning-text">
                Choose a destination folder above, or set a default in{' '}
                <Link
                  to="/settings"
                  search={{ section: 'minecraft' }}
                  className="text-accent-text underline-offset-4 can-hover:hover:underline"
                >
                  Settings › Minecraft
                </Link>
                .
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
            <p className="text-sm text-fg-muted">
              {lintActive
                ? 'Linter runs as a non-blocking suggestion · DESIGN.md & Git commit automatic.'
                : 'Linter is off · DESIGN.md & Git commit automatic.'}
            </p>
            {running ? (
              <Button variant="outline" onClick={() => void cancelExport()}>
                Cancel export
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={busy || !exportDir}
                onClick={() => void exportBuild()}
              >
                <Rocket aria-hidden="true" />
                {outcome ? 'Export again' : 'Export build'}
              </Button>
            )}
          </div>
        </Card>

        {outcome && (
          <Alert
            tone={outcome.recordWarning ? 'warning' : 'success'}
            title={`Exported ${outcome.fileName}`}
            action={
              <>
                <Button size="sm" variant="outline" onClick={() => void revealExported()}>
                  <FolderOpen aria-hidden="true" /> Show in folder
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/build/$name/log" params={{ name }}>
                    Open Design log
                  </Link>
                </Button>
              </>
            }
          >
            <p className="font-mono text-sm tabular-nums">
              {outcome.shape.join(' × ')} · paste at {outcome.paste.join(', ')}
              {outcome.lintCount > 0 && (
                <span className="text-warning-text">
                  {' '}
                  · {outcome.lintCount} lint{' '}
                  {outcome.lintCount === 1 ? 'suggestion' : 'suggestions'}
                </span>
              )}
            </p>
            {nbtOversize && (
              <p className="mt-1 text-sm text-warning-text">
                Dimensions exceed vanilla Structure Block’s 48 × 48 × 48 in-game limit (WorldEdit,
                Axiom, and datapacks can still load it).
              </p>
            )}
            {outcome.recordWarning && (
              <p className="mt-1 text-sm text-warning-text">
                Schematic saved, but DESIGN.md / Git step reported: {outcome.recordWarning}
              </p>
            )}
          </Alert>
        )}

        {hasRun ? (
          <Card className="gap-0 divide-y divide-border-subtle overflow-hidden p-0">
            {steps.map((step) => {
              const open = expandedStep === step.id
              return (
                <Collapsible
                  key={step.id}
                  open={open}
                  onOpenChange={(next) => setExpandedStep(next ? step.id : null)}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      aria-busy={step.status === 'running' || undefined}
                      className="focus-ring flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-fast ease-standard can-hover:bg-surface-hover"
                    >
                      <StepIcon status={step.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-base font-medium',
                              step.status === 'skipped' && 'text-fg-muted'
                            )}
                          >
                            {step.title}
                          </span>
                          {step.badge}
                        </div>
                        <p
                          className={cn(
                            'truncate font-mono text-sm text-fg-secondary',
                            step.status === 'failed' && 'text-danger-text',
                            step.status === 'warning' && 'text-warning-text'
                          )}
                        >
                          {step.summary}
                        </p>
                      </div>
                      {open ? (
                        <ChevronDown aria-hidden className="size-4 shrink-0 text-fg-muted" />
                      ) : (
                        <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-muted" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-border-subtle bg-surface-panel px-4 py-3 pl-11">
                    {step.content}
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </Card>
        ) : (
          <div className="rounded-lg border border-dashed border-border-default px-4 py-3 text-sm text-fg-muted">
            Automatic flow: Check setup → Lint (advisory) → Build schematic → Verify export → Save
            to folder → DESIGN.md &amp; Git commit
          </div>
        )}
      </div>
    </div>
  )
}
