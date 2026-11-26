// The Export screen's pure logic: step statuses, lint formatting, DESIGN.md result rows, and job waiting.
import { DEFAULT_LINT_RULES, type Job, type LintRuleToggles } from '@shared/api'
import { EXPORT_FORMAT_INFO, type ExportFormat } from '@shared/minecraft'
import { useJobs } from '@/entities/job/model/jobs'
import type { CheckStatus } from '@/shared/ui/data/progress'
import { isLintRuleEnabled, LINT_LABELS } from '@/shared/lib/format'

/** A job's step status; `ok` is the step's own pass test on a finished job. */
export function jobStatus(j: Job | undefined, ok = true): CheckStatus {
  if (!j) return 'idle'
  if (j.state === 'running') return 'running'
  return j.state === 'done' && ok ? 'done' : 'failed'
}

/** "falls (gravity) 3, overhang 2", "clean", or "not run". */
export function lintText(
  counts: Record<string, number> | undefined,
  rules: Partial<LintRuleToggles> = DEFAULT_LINT_RULES
): string {
  if (!counts) return 'not run'
  return (
    Object.entries(counts)
      .filter(([k, c]) => c && isLintRuleEnabled(k, rules))
      .map(([k, c]) => `${LINT_LABELS[k] ?? k} ${c}`)
      .join(', ') || 'clean'
  )
}

/** True when exporting as vanilla Structure Block (.nbt) and the build exceeds 48×48×48. */
export function exceedsVanillaStructureLimit(
  format: ExportFormat,
  shape: readonly number[] | undefined
): boolean {
  return format === 'nbt' && !!shape && shape.some((axis) => axis > 48)
}

/** Rows appended to builds/<name>/DESIGN.md after an automatic export. */
export function exportResultsRows(input: {
  file: string
  format: ExportFormat
  shape: readonly number[]
  paste: readonly number[]
  lintSummary: string
  verifySummary: string
  exportedTo: string
}): [string, string][] {
  const fmt = EXPORT_FORMAT_INFO[input.format]
  return [
    ['File', input.file],
    ['Format', `${fmt.extension} (${fmt.label})`],
    ['Shape', input.shape.join(' × ')],
    ['Paste at', input.paste.join(', ')],
    ['Lint', input.lintSummary],
    ['Verify', input.verifySummary],
    ['Exported to', input.exportedTo]
  ]
}

/** Resolves with the job once it ends. */
export function waitForJob(id: number): Promise<Job> {
  return new Promise((resolve) => {
    const ended = (): Job | undefined =>
      useJobs.getState().jobs.find((j) => j.id === id && j.state !== 'running')
    const now = ended()
    if (now) return resolve(now)
    const off = useJobs.subscribe(() => {
      const j = ended()
      if (j) {
        off()
        resolve(j)
      }
    })
  })
}

/** "14:20:36 after 5s" for a finished job. */
export function endedText(j: Job): string {
  const at = new Date(j.ended ?? Date.now()).toLocaleTimeString('en-GB')
  return `${at} after ${Math.round(((j.ended ?? Date.now()) - j.started) / 1000)}s`
}
