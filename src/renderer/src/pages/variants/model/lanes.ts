// What a parallel variant lane is told, and which of its files go to Review. Main's laneGuard (main/lanes.ts)
// enforces the same rules on every tool call; the prompt only saves the agent from finding them by denial.

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

/** The first message of lane `lane`: the shared brief, this lane's direction and the file rules. */
export function lanePrompt(
  lane: string,
  count: number,
  build: string,
  part: string,
  brief: string,
  direction: string
): string {
  const dir = `builds/${build}`
  const own = `${part}_${lane}`
  return [
    `You are variant ${lane}, one of ${count} variants of ${dir} that agents are making at the same time.`,
    brief.trim(),
    direction.trim() && `Your direction (variant ${lane}): ${direction.trim()}`,
    `File rules (the app denies anything else):`,
    `- Write and edit only files in ${dir}/ whose name ends in _${lane}, such as ${dir}/${own}.py. Leave ${part}.py, DESIGN.md and the other variants' files alone.`,
    `- Start by copying ${dir}/${part}.py to ${dir}/${own}.py if that copy does not exist yet (Read, then Write), and change only the copy.`,
    `- Run builds as \`"$MCB_PYTHON" ${dir}/${own}.py proto --name ${own}\`: every --name must end in _${lane}, so your out/ files are yours.`,
    `- Don't change git and don't log the round: the user compares the variants side by side and sends them to Review.`,
    `End with two or three lines on what your variant does differently.`
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** The newest version of each lane's output (stem ending _<lane>), for one Review round. */
export function laneFiles(versions: { path: string }[], lanes: string[]): string[] {
  // versions come newest first
  return lanes.flatMap((l) => {
    const v = versions.find((x) => x.path.replace(/\.litematic$/, '').endsWith(`_${l}`))
    return v ? [v.path] : []
  })
}

type LaneLike = { asks: unknown[]; state: { status: string; error?: string | null } | null }
type LaneState = 'queued' | 'running' | 'awaiting-approval' | 'done' | 'failed' | 'idle'

/** A lane's status for its badge and the switcher: Starting, Needs you, Running, Failed or Done. */
export function laneState(l: LaneLike | undefined): LaneState {
  if (!l?.state || l.state.status === 'starting') return 'queued'
  if (l.asks.length) return 'awaiting-approval'
  if (l.state.status === 'running') return 'running'
  if (l.state.error) return 'failed'
  return l.state.status === 'idle' ? 'done' : 'idle'
}

/** "1 needs you · 1 failed · 1 done", leaving out the running and starting lanes. */
export function laneSummary(states: LaneState[]): string {
  const n = (s: LaneState): number => states.filter((x) => x === s).length
  return [
    n('awaiting-approval') && `${n('awaiting-approval')} needs you`,
    n('failed') && `${n('failed')} failed`,
    n('done') && `${n('done')} done`
  ]
    .filter(Boolean)
    .join(' · ')
}
