import type { ReactElement } from 'react'
import { DiffView } from '@/shared/ui/code/DiffView'
import { Prose } from '@/shared/ui/code/Prose'
import { Cell, Grid, Sub } from '../composites-demo'

export const meta = { group: 'Code', title: 'Diff view and prose' }

const BEFORE = `def build(c: Canvas) -> None:
    with c.op("keep"):
        c.box((0, 0, 0), (15, 18, 15), b.stone_bricks, hollow=True)
    with c.op("keep/roof"):
        c.cone((7, 19, 7), radius=9, height=6, block=b.spruce_planks)
`
const AFTER = `def build(c: Canvas) -> None:
    with c.op("keep"):
        c.box((0, 0, 0), (15, 22, 15), b.stone_bricks, hollow=True)
        c.ring(y=22, radius=8, block=b.cobblestone_wall)
    with c.op("keep/roof"):
        c.cone((7, 23, 7), radius=9, height=8, block=b.dark_oak_planks, stairs=b.dark_oak_stairs)
`

const DOCS = `# Stone watchtower

## Status

- **Round:** 3, picked \`v3\`
- **Next:** stone roof, keep the gatehouse

## Brief

A four-storey watchtower on the north ridge with a gatehouse facing the river. Stone bricks below,
dark oak above, and a [lantern](https://minecraft.wiki/w/Lantern) at every landing.

| Part | Blocks | Approved |
|---|---:|---|
| keep | 2,940 | yes |
| gatehouse | 1,204 | no |

> Keep the silhouette readable from spawn, about 200 blocks away.
`

const CHAT = `I raised the keep to **22 blocks** and swapped the roof to dark oak with stairs on the eaves.

1. \`keep\`: walls 18 → 22, a cobblestone wall ring on top
2. \`keep/roof\`: height 6 → 8, \`dark_oak_planks\` with \`dark_oak_stairs\`

Lint after the change:

\`\`\`
gravity 2, halves 1
\`\`\`

Want me to fix the two falling blocks next?`

const LOG = `### Round 3 · 2026-10-31

Picked **v3**. Roof approved. Pins: 1 lower the parapet by one, 2 gatehouse arch too narrow.`

export default function CodeDiffProse(): ReactElement {
  return (
    <div>
      <Sub
        title="DiffView"
        note="The CodeMirror unified merge view in the diff tokens: removed lines above added ones, with a gutter mark so the kind never relies on tint alone."
      >
        <Grid min="24rem">
          <Cell label="Edit of build.py" surface="none">
            <DiffView before={BEFORE} after={AFTER} label="builds/stone_watchtower/build.py" />
          </Cell>
          <Cell label="New file (Write), line numbers" surface="none">
            <DiffView before="" after={AFTER} label="builds/stone_watchtower/build.py" numbers />
          </Cell>
        </Grid>
      </Sub>
      <Sub
        title="Prose"
        note="Markdown in three variants: docs (DESIGN.md, help), chat (replies, plans) and log (design-log rounds)."
      >
        <Grid min="22rem">
          <Cell label="docs">
            <Prose variant="docs">{DOCS}</Prose>
          </Cell>
          <div className="flex flex-col gap-3">
            <Cell label="chat">
              <Prose variant="chat">{CHAT}</Prose>
            </Cell>
            <Cell label="log">
              <Prose variant="log">{LOG}</Prose>
            </Cell>
          </div>
        </Grid>
      </Sub>
    </div>
  )
}
