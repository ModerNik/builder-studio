// What a parallel variant lane may touch (main/variants.ts). Kept apart from agent.ts so both can import it.
import { basename, isAbsolute, relative, resolve, sep } from 'path'

const WRITERS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']
const GIT_WRITE =
  /\bgit\s+(commit|checkout|switch|reset|restore|stash|add|rm|mv|merge|rebase|cherry-pick|push|pull|clean|apply)\b/

/** Why lane `lane` may not make this call, or null when it may. */
export function laneGuard(
  lane: string,
  build: string,
  tool: string,
  input: Record<string, unknown>,
  repo: string
): string | null {
  const own = `builds/${build}/`
  if (WRITERS.includes(tool)) {
    const p = String(input.file_path ?? input.notebook_path ?? '')
    const rel = relative(repo, isAbsolute(p) ? p : resolve(repo, p))
      .split(sep)
      .join('/')
    const stem = basename(rel).replace(/\.[^.]*$/, '')
    return rel.startsWith(own) && stem.endsWith(`_${lane}`)
      ? null
      : `variant ${lane} writes only its own files, ${own}<name>_${lane}.<ext>`
  }
  if (tool === 'Bash') {
    const cmd = String(input.command ?? '').replace(/\\/g, '/')
    if (GIT_WRITE.test(cmd)) return `variant ${lane} leaves git alone`
    // a build run writes out/<name>.*: every name must be this lane's
    if (/(?:python[\w.]*["']?|["']?\$MCB_PYTHON["']?)\s+[^|;&]*builds\/[\w./-]+\.py/.test(cmd)) {
      const names = [...cmd.matchAll(/--name[= ]+["']?([\w.-]+)/g)].map((m) => m[1])
      if (!names.length || names.some((n) => !n.endsWith(`_${lane}`)))
        return `variant ${lane} runs builds with --name <name>_${lane}`
    }
  }
  return null
}
