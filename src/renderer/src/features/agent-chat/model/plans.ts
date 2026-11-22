// Plan revision tracking and text-selection comment formatting for both Claude (ExitPlanMode) and Codex (item/plan).
import type { PermissionAsk } from '@shared/api'
import type { Item } from './transcript'

export interface PlanComment {
  id: string
  quote: string
  text: string
}

export interface PlanRevisionInfo {
  revision: number
  previousPlan?: string
}

const MUTATING_TOOLS = new Set([
  'Edit',
  'MultiEdit',
  'Write',
  'NotebookEdit',
  'Bash',
  'shell',
  'file changes'
])

/** Formats text-selection comments and an optional general revision note into a clear prompt for the agent. */
export function formatPlanRevision(comments: readonly PlanComment[], note: string): string {
  const valid = comments.filter((c) => c.text.trim().length > 0)
  const trimmedNote = note.trim()
  if (!valid.length) return trimmedNote
  const lines = ['Please revise the plan based on these comments:', '']
  valid.forEach((c, i) => {
    const q = c.quote.trim().replace(/\s+/g, ' ')
    lines.push(q ? `${i + 1}. On "${q}":` : `${i + 1}.`)
    lines.push(`   ${c.text.trim()}`)
  })
  if (trimmedNote) lines.push('', 'Additional notes:', trimmedNote)
  return lines.join('\n')
}

/**
 * Computes revision numbers and previous plan text for every plan in a transcript, resetting the counter
 * after mutating implementation work begins. Also identifies which Codex plan item (if any) is still active.
 */
export function planRevisions(
  items: readonly Item[],
  activePlanAsk?: PermissionAsk
): {
  byId: Map<string, PlanRevisionInfo>
  activeAsk?: PlanRevisionInfo
  activeCodexPlanId: string | null
} {
  const byId = new Map<string, PlanRevisionInfo>()
  let revision = 0
  let lastPlan: string | undefined
  let activeCodexPlanId: string | null = null

  for (const item of items) {
    if (item.kind === 'tool' && MUTATING_TOOLS.has(item.name)) {
      revision = 0
      lastPlan = undefined
      activeCodexPlanId = null
      continue
    }
    if (item.kind === 'user') {
      activeCodexPlanId = null
      continue
    }
    if (item.kind === 'text' && item.plan && !item.live) {
      revision += 1
      byId.set(item.id, { revision, ...(lastPlan !== undefined ? { previousPlan: lastPlan } : {}) })
      lastPlan = item.text
      activeCodexPlanId = item.id
      continue
    }
    if (item.kind === 'tool' && item.name === 'ExitPlanMode') {
      const text = typeof item.input.plan === 'string' ? item.input.plan : ''
      revision += 1
      byId.set(item.id, { revision, ...(lastPlan !== undefined ? { previousPlan: lastPlan } : {}) })
      if (text) lastPlan = text
      activeCodexPlanId = null
    }
  }

  let activeAsk: PlanRevisionInfo | undefined
  if (activePlanAsk) {
    // Claude emits the ExitPlanMode tool_use item before canUseTool resolves, so reuse its slot if already recorded.
    activeAsk = byId.get(activePlanAsk.id) ?? {
      revision: revision + 1,
      ...(lastPlan !== undefined ? { previousPlan: lastPlan } : {})
    }
  }

  return { byId, activeAsk, activeCodexPlanId }
}
