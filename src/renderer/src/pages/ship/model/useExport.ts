// The Export screen's state and 1-button automatic pipeline:
// Check setup -> Advisory lint (non-blocking) -> Full build -> Verify export -> Copy to folder ->
// Automatic DESIGN.md update & Git commit. ui/Ship.tsx renders what this returns.
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_LINTER_SETTINGS, type Job, type JobSpec } from '@shared/api'
import {
  DEFAULT_MINECRAFT_VERSION,
  defaultExportFormat,
  EXPORT_FORMAT_INFO,
  supportedExportFormats,
  type ExportFormat
} from '@shared/minecraft'
import type { CheckStatus } from '@/shared/ui/data/progress'
import { hasEnabledLintRule, lintProblems } from '@/shared/lib/format'
import { queryClient, studio } from '@/shared/api/studio'
import { lastOf, useJobs } from '@/entities/job/model/jobs'
import { useAvailability } from '@/entities/availability/model/availability'
import { useBuild } from '@/entities/build/model/builds'
import { useMinecraftPack, useSettings } from '@/entities/settings/model/settings'
import { stem } from '@/entities/review/model/review'
import { errorText } from '@/entities/build/model/workspace'
import { exportResultsRows, lintText, waitForJob } from './ship'

export type ExportStepId = 'setup' | 'lint' | 'build' | 'verify' | 'save' | 'record'

export interface StepState {
  status: CheckStatus
  summary: string
}

export interface ExportOutcome {
  fileName: string
  path: string
  format: ExportFormat
  shape: [number, number, number]
  paste: [number, number, number]
  lintCount: number
  lintSummary: string
  recordWarning?: string
}

const IDLE: StepState = { status: 'idle', summary: '' }

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads most of this state
export function useExport(name: string) {
  const availability = useAvailability().data
  const { data: build } = useBuild(name)
  const settings = useSettings().data
  const minecraftVersion =
    build?.minecraftVersion ?? settings?.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION
  const targetPack = useMinecraftPack(minecraftVersion)
  const jobs = useJobs((s) => s.jobs)
  const logs = useJobs((s) => s.logs)

  const supportedFormats = supportedExportFormats(minecraftVersion)
  const defaultFmt = defaultExportFormat(minecraftVersion)
  const [chosenFormat, setChosenFormat] = useState<ExportFormat | null>(null)
  const format: ExportFormat =
    chosenFormat && supportedFormats.includes(chosenFormat) ? chosenFormat : defaultFmt

  const [customDir, setCustomDir] = useState<string | null>(null)
  const defaultDir = settings?.schematics ?? ''
  const exportDir = customDir ?? defaultDir
  const isCustomDir = customDir !== null

  const [running, setRunning] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [expandedStep, setExpandedStep] = useState<ExportStepId | null>(null)
  const [setup, setSetup] = useState<StepState>(IDLE)
  const [lintStep, setLintStep] = useState<StepState & { counts?: Record<string, number> }>(IDLE)
  const [buildStep, setBuildStep] = useState<StepState>(IDLE)
  const [verify, setVerify] = useState<StepState>(IDLE)
  const [save, setSave] = useState<StepState>(IDLE)
  const [record, setRecord] = useState<
    StepState & {
      designTitle?: string
      designRows?: [string, string][]
      gitOutput?: string
    }
  >(IDLE)
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null)
  const [checkJobId, setCheckJobId] = useState<number | null>(null)
  const [fullJobId, setFullJobId] = useState<number | null>(null)

  const activeJobId = useRef<number | null>(null)
  const cancelled = useRef(false)

  const linter = settings?.linter ?? DEFAULT_LINTER_SETTINGS
  const lintActive = linter.enabled && hasEnabledLintRule(linter.rules)
  const busy = running || jobs.some((j) => j.spec.build === name && j.state === 'running')

  const checkJob = checkJobId !== null ? jobs.find((j) => j.id === checkJobId) : undefined
  const fullJob = fullJobId !== null ? jobs.find((j) => j.id === fullJobId) : undefined
  const logOf = (j: Job | undefined): string[] => (j ? (logs[j.id] ?? j.log) : [])

  async function pickExportDir(): Promise<void> {
    try {
      const picked = await studio.workspace.pick(exportDir)
      if (picked) setCustomDir(picked)
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  function resetExportDir(): void {
    setCustomDir(null)
  }

  async function revealExported(): Promise<void> {
    if (!outcome?.path) return
    try {
      await studio.ship.reveal(outcome.path)
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  async function cancelExport(): Promise<void> {
    cancelled.current = true
    const id = activeJobId.current
    if (id !== null) {
      activeJobId.current = null
      await studio.jobs.cancel(id).catch(() => undefined)
    }
  }

  async function runJob(spec: JobSpec, onStart?: (id: number) => void): Promise<Job | null> {
    try {
      const id = await studio.jobs.run(spec)
      activeJobId.current = id
      onStart?.(id)
      const finished = await waitForJob(id)
      if (activeJobId.current === id) activeJobId.current = null
      return finished
    } catch (e) {
      activeJobId.current = null
      toast.error(errorText(e))
      return null
    }
  }

  async function exportBuild(): Promise<void> {
    if (busy) return
    cancelled.current = false
    setRunning(true)
    setHasRun(true)
    setOutcome(null)
    setCheckJobId(null)
    setFullJobId(null)
    setSetup(IDLE)
    setLintStep(IDLE)
    setBuildStep(IDLE)
    setVerify(IDLE)
    setSave(IDLE)
    setRecord(IDLE)

    const chosenFmt = format
    const targetOverride = customDir ?? undefined

    try {
      // 1. Setup & destination check
      setSetup({
        status: 'running',
        summary: `Checking Minecraft ${minecraftVersion}, build tools, and destination…`
      })
      setExpandedStep('setup')
      await queryClient.cancelQueries({ queryKey: ['availability'] })
      const checked = await studio.availability.get(true)
      queryClient.setQueryData(['availability'], checked)
      if (cancelled.current) {
        setSetup({ status: 'skipped', summary: 'Cancelled' })
        return
      }
      const missing = targetOverride
        ? checked.features.engine.missing
        : [...new Set([...checked.features.engine.missing, ...checked.features.export.missing])]
      if (missing.length) {
        setSetup({
          status: 'failed',
          summary: missing.map((n) => checked.requirements[n].detail).join('; ')
        })
        return
      }
      if (!exportDir) {
        setSetup({
          status: 'failed',
          summary: 'Choose an export folder before exporting.'
        })
        return
      }
      setSetup({
        status: 'done',
        summary: `Minecraft ${minecraftVersion} ready · ${EXPORT_FORMAT_INFO[chosenFmt].extension}`
      })

      // 2. Advisory lint (never blocks export)
      let lintCount = 0
      let lintSummary = !linter.enabled
        ? 'skipped (linter off)'
        : !lintActive
          ? 'skipped (all rules off)'
          : 'clean'

      if (!lintActive) {
        setLintStep({
          status: 'skipped',
          summary: !linter.enabled
            ? 'Linter is off in Settings'
            : 'All lint rules are off in Settings'
        })
      } else {
        setLintStep({ status: 'running', summary: 'Running advisory lint check…' })
        setExpandedStep('lint')
        const c = await runJob({ part: 'check', build: name }, setCheckJobId)
        if (cancelled.current || c?.state === 'cancelled') {
          setLintStep({ status: 'skipped', summary: 'Cancelled' })
          return
        }
        const counts = lastOf(c ?? undefined).lint?.counts
        if (c?.state === 'done' && counts) {
          lintCount = lintProblems(counts, linter.rules)
          lintSummary = lintText(counts, linter.rules)
          setLintStep({
            status: lintCount > 0 ? 'warning' : 'done',
            counts,
            summary:
              lintCount > 0
                ? `${lintCount} ${lintCount === 1 ? 'suggestion' : 'suggestions'}: ${lintSummary} (continuing)`
                : 'No suggestions'
          })
        } else {
          lintSummary = c ? `check exited ${c.code ?? 'with error'} (continuing)` : 'check failed'
          setLintStep({
            status: 'warning',
            counts,
            summary: `${lintSummary} — continuing to build`
          })
        }
      }

      // 3. Full build & format packaging (into staging)
      const fmtInfo = EXPORT_FORMAT_INFO[chosenFmt]
      setBuildStep({
        status: 'running',
        summary: `Building full schematic (${fmtInfo.extension})…`
      })
      setExpandedStep('build')
      const b = await runJob(
        {
          part: 'full',
          build: name,
          ship: true,
          format: chosenFmt === defaultFmt ? undefined : chosenFmt,
          noRender: !targetPack.data
        },
        setFullJobId
      )
      if (cancelled.current || b?.state === 'cancelled') {
        setBuildStep({ status: 'skipped', summary: 'Cancelled' })
        return
      }
      const ev = lastOf(b ?? undefined)
      const wrote = ev.wrote
      const staged = b?.events.find((e) => e.event === 'copied')
      if (b?.state !== 'done' || !wrote || staged?.event !== 'copied') {
        const lastLine = logOf(b ?? undefined).at(-1)
        setBuildStep({
          status: 'failed',
          summary: b
            ? `Build failed (exit ${b.code ?? '?'})${lastLine ? `: ${lastLine}` : ''}`
            : 'Build could not start'
        })
        return
      }
      const stagedName = staged.path.split(/[\\/]/).pop() ?? `${name}${fmtInfo.extension}`
      setBuildStep({
        status: 'done',
        summary: `${stagedName} · ${wrote.shape.join('×')} · paste at ${wrote.paste.join(', ')}${ev.done ? ` · ${ev.done.seconds}s` : ''}`
      })

      // 4. Verify export (bridge reads staged file back)
      setVerify({ status: 'running', summary: `Verifying ${stagedName}…` })
      setExpandedStep('verify')
      const artifactVersion = b.minecraftVersion ?? minecraftVersion
      let verifySummary = 'verified'
      try {
        const got = await studio.bridge.call(
          'bill',
          { path: staged.path, top: 1000 },
          undefined,
          artifactVersion
        )
        const layer = await studio.bridge.call(
          'layer',
          { path: staged.path, y: 0 },
          undefined,
          artifactVersion
        )
        if (cancelled.current) {
          setVerify({ status: 'skipped', summary: 'Cancelled' })
          return
        }
        const ok =
          (ev.bill ? got.total === ev.bill.total : true) &&
          layer.shape.join() === wrote.shape.join()
        verifySummary = ok
          ? `Verified ${got.total.toLocaleString()} blocks · shape ${layer.shape.join('×')} matches`
          : `Mismatch: reloaded ${got.total.toLocaleString()} blocks (${ev.bill?.total.toLocaleString() ?? '?'} built), shape ${layer.shape.join('×')} (${wrote.shape.join('×')} built)`
        setVerify({ status: ok ? 'done' : 'failed', summary: verifySummary })
        if (!ok) return
      } catch (e) {
        setVerify({ status: 'failed', summary: errorText(e) })
        return
      }

      // 5. Copy verified file to destination folder
      setSave({ status: 'running', summary: `Saving to ${exportDir}…` })
      setExpandedStep('save')
      let exportedPath: string
      try {
        exportedPath = await studio.ship.finalize(b.id, targetOverride)
        setSave({ status: 'done', summary: exportedPath })
      } catch (e) {
        setSave({ status: 'failed', summary: errorText(e) })
        return
      }

      // 6. Automatic DESIGN.md update + Git commit
      setRecord({ status: 'running', summary: 'Updating DESIGN.md and committing…' })
      setExpandedStep('record')
      const builtStem = stem(wrote.path)
      const designTitle = `Shipped ${builtStem} (${new Date().toLocaleDateString('sv')})`
      const designRows = exportResultsRows({
        file: wrote.path,
        format: chosenFmt,
        shape: wrote.shape,
        paste: wrote.paste,
        lintSummary,
        verifySummary: 'bill and shape match',
        exportedTo: exportedPath
      })
      const commitMessage = `${name}: ship ${builtStem}`.trim()
      const gitOk = checked.features.commit.ok
      let recordWarning: string | undefined
      let gitOutput: string | undefined

      try {
        await studio.ship.results(name, designTitle, designRows)
        void queryClient.invalidateQueries({ queryKey: ['design', name] })
        void queryClient.invalidateQueries({ queryKey: ['builds'] })
        if (gitOk) {
          const gitResult = await studio.ship.commit(name, commitMessage)
          gitOutput = gitResult.output
          setRecord({
            status: 'done',
            summary: gitResult.committed
              ? `DESIGN.md updated · committed "${commitMessage}"`
              : 'DESIGN.md updated · already up to date in Git',
            designTitle,
            designRows,
            gitOutput
          })
        } else {
          setRecord({
            status: 'done',
            summary: 'DESIGN.md updated · Git commit skipped (Git not configured)',
            designTitle,
            designRows
          })
        }
      } catch (e) {
        recordWarning = errorText(e)
        setRecord({
          status: 'warning',
          summary: `Exported file saved, but log/commit hit an issue: ${recordWarning}`,
          designTitle,
          designRows,
          gitOutput
        })
      }

      const exportedFileName = exportedPath.split(/[\\/]/).pop() ?? stagedName
      setOutcome({
        fileName: exportedFileName,
        path: exportedPath,
        format: chosenFmt,
        shape: wrote.shape,
        paste: wrote.paste,
        lintCount,
        lintSummary,
        recordWarning
      })
      // Keep lint suggestions expanded if any, otherwise collapse steps for a clean completion view
      setExpandedStep(recordWarning ? 'record' : lintCount > 0 ? 'lint' : null)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      activeJobId.current = null
      setRunning(false)
    }
  }

  return {
    availability,
    build,
    minecraftVersion,
    supportedFormats,
    format,
    setFormat: setChosenFormat,
    exportDir,
    defaultDir,
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
  }
}
