import { useEffect, useState, type ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import { CodeBlock } from '@/shared/ui/code/CodeBlock'
import { LogViewer } from '@/shared/ui/code/LogViewer'
import { Cell, Grid, Sub } from '../composites-demo'

export const meta = { group: 'Code', title: 'Code block and log viewer' }

const BUILD_PY = `from mcb import Canvas, blocks as b

def build(c: Canvas) -> None:
    with c.op("keep"):
        c.box((0, 0, 0), (15, 22, 15), b.stone_bricks, hollow=True)
        c.ring(y=22, radius=8, block=b.cobblestone_wall)
    with c.op("keep/roof"):
        c.cone((7, 23, 7), radius=9, height=8, block=b.dark_oak_planks, stairs=b.dark_oak_stairs)
    with c.op("gatehouse"):
        c.arch((16, 0, 4), width=5, height=7, block=b.stone_bricks)  # long line: wraps when Wrap is on, scrolls sideways when off
`

const SCRIPT = [
  '@mcb job proto builds/stone_watchtower/build.py',
  '@mcb stage generate',
  'generated 9211 blocks in 2.4 s',
  '@mcb stage lint',
  'lint: floating 0, unattached 0, gravity 2, halves 1',
  'WARNING: leaves may decay at 12 64 -3',
  '@mcb stage hollow',
  'hollow: removed 2314 hidden blocks',
  '@mcb stage write',
  'wrote builds/stone_watchtower/out/stone_watchtower_v3.litematic',
  '@mcb stage render',
  'render: 6 views → out/stone_watchtower_v3_3d/sheet.png',
  '@mcb done 14.2 s'
]
const FAILED = [
  '@mcb job check builds/stone_watchtower/build.py',
  'Traceback (most recent call last):',
  '  File "builds/stone_watchtower/build.py", line 9, in build',
  '    c.arch((16, 0, 4), width=5, height=7, block=b.stone_brick)',
  "AttributeError: module 'mcb.blocks' has no attribute 'stone_brick'. Did you mean: 'stone_bricks'?",
  'job failed after 0.8 s'
]

/** Streams the draft log line by line, then repeats it with more output, so the autoscroll pause can be tried. */
function StreamingLog(): ReactElement {
  const [lines, setLines] = useState<string[]>([])
  const [on, setOn] = useState(true)
  useEffect(() => {
    if (!on) return
    const timer = setInterval(
      () => setLines((l) => [...l, `${SCRIPT[l.length % SCRIPT.length]}`]),
      400
    )
    return () => clearInterval(timer)
  }, [on])
  return (
    <div className="flex flex-col gap-2">
      <LogViewer lines={lines} streaming={on} label="Draft generation log" height="h-56" />
      <div className="flex gap-2">
        <Button size="xs" variant="outline" onClick={() => setOn(!on)}>
          {on ? 'Pause stream' : 'Resume stream'}
        </Button>
        <Button size="xs" variant="outline" onClick={() => setLines([])}>
          Clear
        </Button>
      </div>
    </div>
  )
}

export default function CodeBlocks(): ReactElement {
  return (
    <div>
      <Sub
        title="CodeBlock"
        note="Copy, a wrap toggle and line numbers that never get copied. Highlighted lines mark where a part opens."
      >
        <Grid min="24rem">
          <Cell label="build.py, line 7 highlighted" surface="none">
            <CodeBlock code={BUILD_PY} title="builds/stone_watchtower/build.py" highlight={[7]} />
          </Cell>
          <Cell label="Wrapped, no line numbers" surface="none">
            <CodeBlock
              code="python builds/stone_watchtower/build.py proto --out stone_watchtower_v4 --area -212,1408,48,52"
              title="Shell"
              lineNumbers={false}
              wrap
            />
          </Cell>
        </Grid>
      </Sub>
      <Sub
        title="LogViewer"
        note="Follows new lines while streaming; scroll up to pause it, then jump back with the button. Ctrl F searches (Enter and Shift Enter step through matches)."
      >
        <Grid min="24rem">
          <Cell label="Streaming" surface="none">
            <StreamingLog />
          </Cell>
          <Cell label="Failed job" surface="none">
            <LogViewer lines={FAILED} label="Build check log" height="h-56" />
          </Cell>
          <Cell label="Empty" surface="none">
            <LogViewer lines={[]} label="Full build log" height="h-24" />
          </Cell>
        </Grid>
      </Sub>
    </div>
  )
}
