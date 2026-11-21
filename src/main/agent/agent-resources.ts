import { readFileSync } from 'fs'
import { join } from 'path'
import type { Settings } from '@shared/api'

/** Load app-owned instructions without copying or overwriting workspace instructions. */
export function agentResources(s: Settings): { instructions: string; critic: string } {
  const read = (path: string): string =>
    readFileSync(join(s.resources, path), 'utf8').replace(/\bdocs\/[\w./-]+/g, (path) =>
      join(s.resources, path).replace(/\\/g, '/')
    )
  const locations = `Builder Studio locations (absolute):
Workspace/cwd: ${s.workspace}
Installed resources (read only): ${s.resources}
Managed runtime (read only): ${s.runtime}
Application cache: ${s.cache}
Asset library: ${s.assets}
Python command in Bash: "${s.python.replace(/\\/g, '/')}"
Environment: MCB_WORKSPACE, MCB_RESOURCES, MCB_RUNTIME, MCB_CACHE, MCB_ASSETS, MCB_PYTHON, MCB_PACK.
Run Python from the workspace with the resolved interpreter; imports are provided by the runtime.
Use Python module commands, e.g. "$MCB_PYTHON" -m tools.new_build <name>.
Finals destination: ${s.schematics || 'not configured; set MCB_SCHEMATICS before finalizing'}.
Workspace instructions still apply. Bundled workflow docs belong to the resource directory.
Hand edits: builds/<name>/data/edits.json holds blocks the user placed, changed or erased in the Editor. Every draft applies it last, over build.py and imports. Never edit or delete it and never work around it in build.py; ask the user to change those blocks.
`
  return {
    instructions:
      locations + '\n' + read('CLAUDE.md') + '\n' + read('.claude/skills/mc-build/SKILL.md'),
    critic:
      locations +
      '\n' +
      read('.claude/agents/render-critic.md').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
  }
}
