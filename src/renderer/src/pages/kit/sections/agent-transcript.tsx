import { useState, type ReactElement } from 'react'
import {
  CommandPreview,
  PermissionCard,
  PlanCard,
  QuestionCard,
  WorkingIndicator,
  type PermitDecision
} from '@/features/agent-chat/ui/Cards'
import { AssistantMessage, MessageBubble, SystemNote } from '@/features/agent-chat/ui/Messages'
import {
  JobCard,
  SubagentCard,
  ToolCallRow,
  ToolResult
} from '@/features/agent-chat/ui/ToolCallRow'
import { Transcript } from '@/features/agent-chat/ui/Transcript'
import { DiffView } from '@/shared/ui/code/DiffView'
import type { AgentQuestion, PermissionAsk } from '@shared/api'
import type { Item } from '@/features/agent-chat/model/transcript'
import hero from '../../../../../../.github/assets/hero.svg?url'
import { Cell, Grid, Narrow, Sub } from '../composites-demo'

export const meta = { group: 'Agent', title: 'Transcript items' }

const PLAN_V1 = `1. Raise the keep's walls from 18 to 22 blocks and add a cobblestone wall ring
2. Replace the spruce roof with dark oak and stairs on the eaves
3. Run \`build.py proto\` and send the sheet for review`

const PLAN = `1. Raise the keep's walls from 18 to 24 blocks with deepslate quoins
2. Replace the spruce roof with steep dark oak gables and dormers
3. Run \`build.py proto\` and send the sheet for review`

const QUIZ: AgentQuestion[] = [
  {
    id: 'palette',
    header: 'Palette',
    question: 'Which stone palette should the watchtower walls use?',
    multiSelect: false,
    allowOther: true,
    options: [
      {
        label: 'Weathered Deepslate',
        description: 'Dark slate base with cobbled accents and mossy trim',
        preview: '```text\n[deepslate_bricks] [cobbled_deepslate] [mossy_stone_bricks]\n```'
      },
      {
        label: 'Classic Stone Brick',
        description: 'Lighter medieval stone with cracked brick variation',
        preview: '```text\n[stone_bricks] [cracked_stone_bricks] [andesite]\n```'
      }
    ]
  },
  {
    id: 'details',
    header: 'Details',
    question: 'Which exterior details should be included?',
    multiSelect: true,
    allowOther: true,
    options: [
      { label: 'Machicolations', description: 'Overhanging battlements along the parapet' },
      { label: 'Banner pennants', description: 'Hanging wool flags on the upper windows' },
      { label: 'Torch sconces', description: 'Iron wall brackets with warm lanterns' }
    ]
  }
]

const ITEMS: Item[] = [
  { kind: 'note', id: 'n', text: 'New session · stone_watchtower' },
  { kind: 'user', id: 'u', text: 'Make the keep taller and give it a darker roof.' },
  { kind: 'text', id: 't', parent: null, text: 'I will raise the keep and swap the roof.' },
  {
    kind: 'tool',
    id: 'e',
    parent: null,
    name: 'Edit',
    input: {
      file_path: 'builds/stone_watchtower/build.py',
      old_string: 'c.cone((7, 19, 7), radius=9, height=6, block=b.spruce_planks)',
      new_string: 'c.cone((7, 23, 7), radius=9, height=8, block=b.dark_oak_planks)'
    },
    result: 'The file was updated.'
  }
]
const ASKS: PermissionAsk[] = [
  {
    id: 'a',
    build: 'stone_watchtower',
    tool: 'Bash',
    input: { command: 'python builds/stone_watchtower/build.py check' },
    title: 'Run the build check',
    reason: null,
    guard: null,
    rule: 'Bash(python builds/stone_watchtower/build.py check)',
    agent: null
  }
]

export default function AgentTranscript(): ReactElement {
  const [decided, setDecided] = useState<PermitDecision | null>(null)
  const [plan, setPlan] = useState<string>('open')
  const [quizResult, setQuizResult] = useState<string | null>(null)
  const [started] = useState(() => Date.now() - 47_000)
  return (
    <div>
      <Sub
        title="Messages"
        note="The user's message, the assistant's reply in chat prose, and system notes from the app."
      >
        <Grid min="22rem">
          <Cell label="A short exchange" className="flex flex-col gap-3">
            <SystemNote>New session · stone_watchtower</SystemNote>
            <MessageBubble
              attachments={[
                { path: 'builds/stone_watchtower/attachments/pasted-1730662800.png', url: hero },
                { path: 'builds/stone_watchtower/refs/gatehouse_notes.md' }
              ]}
            >
              Make the keep taller and give it a darker roof. The gatehouse stays as it is.
            </MessageBubble>
            <AssistantMessage>
              {
                'I raised the keep to **22 blocks** and swapped the roof to `dark_oak_planks` with stairs on the eaves. Lint reports 2 blocks that will fall; want me to fix those next?'
              }
            </AssistantMessage>
            <SystemNote tone="error">The session ended: claude exited with code 1</SystemNote>
          </Cell>
          <Cell label="Narrow, long words" className="flex flex-col gap-3">
            <Narrow width={18.75}>
              <div className="flex flex-col gap-3">
                <MessageBubble>
                  Check
                  builds/stone_watchtower_with_north_gatehouse_and_river_bridge/out/v12.litematic
                </MessageBubble>
                <AssistantMessage streaming>
                  {
                    'Reading `builds/stone_watchtower_with_north_gatehouse_and_river_bridge/build.py`…'
                  }
                </AssistantMessage>
              </div>
            </Narrow>
          </Cell>
        </Grid>
      </Sub>
      <Sub
        title="ToolCallRow"
        note="One quiet row per call: icon, verb, gist, +/− lines, and its state. Click opens what it was given and what came back."
      >
        <Cell label="A turn's tool calls">
          <div className="flex flex-col">
            <ToolCallRow
              name="Read"
              input={{ file_path: 'builds/stone_watchtower/DESIGN.md' }}
              status="done"
            >
              <ToolResult text={'# Stone watchtower\n\n## Status\n- Round: 3, picked v3'} />
            </ToolCallRow>
            <ToolCallRow name="Grep" input={{ pattern: 'c.op\\("keep' }} status="done" />
            <ToolCallRow
              name="Edit"
              input={{
                file_path: 'builds/stone_watchtower/build.py',
                old_string: 'c.box((0, 0, 0), (15, 18, 15), b.stone_bricks, hollow=True)',
                new_string:
                  'c.box((0, 0, 0), (15, 22, 15), b.stone_bricks, hollow=True)\nc.ring(y=22, radius=8, block=b.cobblestone_wall)'
              }}
              status="done"
              defaultOpen
            >
              <DiffView
                label="build.py"
                before={'c.box((0, 0, 0), (15, 18, 15), b.stone_bricks, hollow=True)\n'}
                after={
                  'c.box((0, 0, 0), (15, 22, 15), b.stone_bricks, hollow=True)\nc.ring(y=22, radius=8, block=b.cobblestone_wall)\n'
                }
                collapse={false}
              />
            </ToolCallRow>
            <ToolCallRow
              name="mcp__studio__show_in_viewer"
              input={{ path: 'builds/stone_watchtower/out/stone_watchtower_v4.litematic' }}
              status="running"
            />
            <ToolCallRow
              name="WebFetch"
              input={{ url: 'https://minecraft.wiki/w/Lantern' }}
              status="error"
            >
              <ToolResult
                error
                text="Web access is off for this provider (sandbox: network disabled)."
              />
            </ToolCallRow>
          </div>
        </Cell>
      </Sub>
      <Sub
        title="JobCard and SubagentCard"
        note="A build.py run as a job card with lint and Show / Sheet; a subagent's own steps nest on a rail."
      >
        <Grid min="22rem">
          <Cell label="Finished draft">
            <JobCard
              command="python builds/stone_watchtower/build.py proto"
              status="done"
              seconds={14}
              lintProblems={3}
              wrote="builds/stone_watchtower/out/stone_watchtower_v4.litematic"
              onShow={() => undefined}
              onSheet={() => undefined}
            >
              <ToolResult text={'@mcb stage generate\n@mcb stage lint\n@mcb done 14.2 s'} />
            </JobCard>
          </Cell>
          <Cell label="Running, and stopped">
            <div className="flex flex-col gap-2">
              <JobCard command="python builds/stone_watchtower/build.py check" status="running" />
              <JobCard
                command="python builds/stone_watchtower/build.py proto"
                status="error"
                stoppedAt="Checking blocks"
                lintProblems={0}
              />
            </div>
          </Cell>
          <Cell label="Subagent with nested steps">
            <SubagentCard
              type="render-critic"
              description="Judge v4 against the brief"
              status="running"
            >
              <ToolCallRow
                name="Read"
                input={{
                  file_path: 'builds/stone_watchtower/out/stone_watchtower_v4_3d/sheet.png'
                }}
                status="done"
              />
              <ToolCallRow
                name="Grep"
                input={{ pattern: 'roof', path: 'builds/stone_watchtower/build.py' }}
                status="running"
              />
            </SubagentCard>
          </Cell>
        </Grid>
      </Sub>
      <Sub
        title="PlanCard, QuestionCard and PermissionCard"
        note="What the assistant asks the builder to decide: plans (with revisions, selection comments and inline edits), structured question quizzes, and tool permissions."
      >
        <Grid min="24rem">
          <Cell
            label={
              plan === 'open'
                ? 'Plan Rev 2 (select text to comment, toggle Diff or Edit)'
                : `Plan: ${plan} (demo)`
            }
          >
            <PlanCard
              plan={PLAN}
              revision={2}
              previousPlan={PLAN_V1}
              renderDiff={(before, after) => (
                <DiffView label="Plan changes" before={before} after={after} collapse={false} />
              )}
              onApprove={(edited) => setPlan(edited ? 'approved edited plan' : 'approved')}
              onRevise={(feedback) => setPlan(`revision sent (${feedback.slice(0, 48)})`)}
              onKeepPlanning={() => setPlan('keep planning')}
            />
          </Cell>
          <Cell label="Codex plan (active) and superseded read-only plan">
            <div className="flex flex-col gap-3">
              <PlanCard
                plan={PLAN}
                approveLabel="Implement plan"
                onApprove={() => undefined}
                onRevise={() => undefined}
              />
              <PlanCard plan={PLAN_V1} revision={1} />
            </div>
          </Cell>
          <Cell
            label={
              quizResult
                ? `QuestionCard: ${quizResult} (demo)`
                : 'QuestionCard: multi-step quiz with previews and Other'
            }
          >
            <Narrow width={23.25}>
              <QuestionCard
                questions={QUIZ}
                onSubmit={(answers) =>
                  setQuizResult(
                    Object.entries(answers)
                      .map(([k, v]) => `${k}=${v.join(', ')}`)
                      .join(' · ')
                  )
                }
                onSkip={() => setQuizResult('skipped')}
              />
            </Narrow>
          </Cell>
          <Cell label={decided ? `Bash ask: ${decided} (demo)` : 'Bash, with an Always rule'}>
            <PermissionCard
              tool="Bash"
              title="Run the build check"
              rule="Bash(python builds/stone_watchtower/build.py check)"
              canSwitchToAuto
              onDecide={setDecided}
            >
              <CommandPreview>python builds/stone_watchtower/build.py check</CommandPreview>
            </PermissionCard>
          </Cell>
          <Cell label="Edit from a subagent, with a diff">
            <PermissionCard tool="Edit" subagent onDecide={() => undefined}>
              <DiffView
                label="build.py"
                before={'c.cone((7, 19, 7), radius=9, height=6, block=b.spruce_planks)\n'}
                after={'c.cone((7, 23, 7), radius=9, height=8, block=b.dark_oak_planks)\n'}
              />
            </PermissionCard>
          </Cell>
          <Cell label="Guarded: never Always">
            <PermissionCard
              tool="Bash"
              guard="git push always asks"
              rule="Bash(git push)"
              onDecide={() => undefined}
            >
              <CommandPreview>git push origin main</CommandPreview>
            </PermissionCard>
          </Cell>
        </Grid>
      </Sub>
      <Sub
        title="WorkingIndicator"
        note="The working dot, a shimmering label and the turn's time. Under reduced motion both hold still and the words carry it."
      >
        <Cell label="Mid-turn">
          <WorkingIndicator label="Editing build.py" startedAt={started} />
        </Cell>
      </Sub>
      <Sub
        title="Transcript"
        note="The items composed: notes, messages, tool rows, then the open ask right above the composer and the working line. Sticks to the bottom; the column stops at 68ch."
      >
        <Cell label="Awaiting approval, 372px dock">
          <Narrow width={23.25}>
            <Transcript
              items={ITEMS}
              asks={ASKS}
              working
              onPermit={() => undefined}
              onSwitchToAuto={() => undefined}
              className="h-[30rem]"
            />
          </Narrow>
        </Cell>
      </Sub>
    </div>
  )
}
