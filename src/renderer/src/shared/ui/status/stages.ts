import type { JobState } from './state'

export type Stage = { id: string; label: string }

/** The draft job's stages in order, with the labels the activity bar shows (docs/building.md). */
export const DRAFT_STAGES: Stage[] = [
  { id: 'generate', label: 'Generating blocks' },
  { id: 'lint', label: 'Checking blocks' },
  { id: 'hollow', label: 'Removing hidden blocks' },
  { id: 'write', label: 'Saving the schematic' },
  { id: 'render', label: 'Creating preview images' }
]

export type SegmentState = 'done' | 'current' | 'failed' | 'pending'

export type StageProgress = {
  /** 0-based index of the current (or last reached) stage, -1 before the first. */
  index: number
  total: number
  /** Finished stages over all stages, 0..1. */
  fraction: number
  segments: SegmentState[]
  /** One line for the stage area: "Checking blocks", "Stopped at Checking blocks", … */
  label: string
}

/** Where a staged job is: which segments are done, which is current, and the line to show. */
export function stageProgress(
  stages: Stage[],
  current: string | null | undefined,
  state: JobState
): StageProgress {
  const total = stages.length
  const found = stages.findIndex((s) => s.id === current)
  const index = state === 'done' ? total - 1 : found
  const at = index >= 0 ? stages[index] : undefined
  const segments = stages.map((_, i): SegmentState => {
    if (state === 'done' || i < index) return 'done'
    if (i !== index) return 'pending'
    if (state === 'failed') return 'failed'
    return state === 'running' || state === 'awaiting-approval' ? 'current' : 'pending'
  })
  const finished = segments.filter((s) => s === 'done').length
  const label =
    state === 'done'
      ? 'Complete'
      : state === 'failed'
        ? at
          ? `Failed at ${at.label}`
          : 'Failed before it started'
        : state === 'cancelled'
          ? at
            ? `Stopped at ${at.label}`
            : 'Stopped'
          : state === 'queued'
            ? 'Waiting to start'
            : state === 'idle'
              ? 'Not started'
              : (at?.label ?? 'Starting')
  return { index, total, fraction: total ? finished / total : 0, segments, label }
}
