// The Export screen's logic: step statuses from the jobs, lint and bill text, the rejected variants of the newest
// round with a pick, and the rows of the results table it writes into DESIGN.md.
import { DEFAULT_LINT_RULES, type Job, type LintRuleToggles, type ReviewRound } from '@shared/api'
import { useJobs } from '@/entities/job/model/jobs'
import type { CheckStatus } from '@/shared/ui/data/progress'
import { isLintRuleEnabled, LINT_LABELS } from '@/shared/lib/format'

// shortcut: a hand list of blocks that are slow or costly to gather in survival; the engine has no such notion yet
const RARE =
  /froglight|tinted_glass|prismarine|sea_lantern|sponge|beacon|conduit|shulker|sculk|end_stone|purpur|netherite|diamond_block|emerald_block|gold_block|crying_obsidian|amethyst|dragon|_head$|skull|budding|heavy_core|trial_spawner|vault/

export const isRare = (state: string): boolean => RARE.test(state)

export const rareBlocks = (top: [string, number][]): [string, number][] =>
  top.filter(([s]) => isRare(s))

/** A job's step status; `ok` is the step's own pass test on a finished job (lint zero, say). */
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

/** The newest round with a pick, and its other files still on disk. */
export function rejectedVariants(
  rounds: ReviewRound[],
  onDisk: string[]
): { round: ReviewRound | undefined; paths: string[] } {
  const round = [...rounds].reverse().find((r) => r.pick)
  const paths = (round?.files ?? [])
    .filter((f) => f.name !== round?.pick && onDisk.includes(f.path))
    .map((f) => f.path)
  return { round, paths }
}

export const percent = (part: number, whole: number): number =>
  Math.round((part / Math.max(whole, 1)) * 100)

/** "28 × 64 + 50" for a count of blocks, or the count under one stack. */
export const stacks = (count: number): string =>
  count < 64 ? `${count}` : `${Math.floor(count / 64)} × 64${count % 64 ? ` + ${count % 64}` : ''}`

/** Resolves with the job once it ends (Run steps 1 to 6 waits on each job in turn). */
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
