import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

/** Unit tests use a minimal resource contract, without a private engine distribution. */
export function fixtureResources(root: string): string {
  const resources = join(root, 'resources')
  for (const [file, text] of Object.entries({
    'CLAUDE.md': 'Fixture workflow: docs/pipeline.md',
    '.claude/skills/mc-build/SKILL.md': 'Fixture build checklist.',
    '.claude/agents/render-critic.md': '---\nname: fixture\n---\nverdict: ready to show | fix first'
  })) {
    const target = join(resources, file)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, text)
  }
  return resources
}
