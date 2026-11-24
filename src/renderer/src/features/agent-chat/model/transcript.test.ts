import { describe, expect, it } from 'vitest'
import { claudeEvents } from '../../../../../main/agent/claude-events'
import type { AgentMsg } from '@shared/api'
import { activity, jobSummary, reduce, type Item } from './transcript'

// recorded shapes of SDK 0.3.311 messages, trimmed to the fields the reducer reads
const CHECK = '.venv/Scripts/python builds/narkina5/build.py check --x0 40 --sx 30'
const MSGS: Parameters<typeof claudeEvents>[0][] = [
  {
    type: 'system',
    subtype: 'init',
    session_id: '0b5e1f3a-1111-2222-3333-444455556666',
    model: 'claude-haiku-5-5',
    apiKeySource: 'ANTHROPIC_API_KEY',
    uuid: 'u0'
  },
  {
    type: 'stream_event',
    parent_tool_use_id: null,
    uuid: 'u1',
    event: {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'Status says ' }
    }
  },
  {
    type: 'stream_event',
    parent_tool_use_id: null,
    uuid: 'u2',
    event: {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'round 15.' }
    }
  },
  {
    type: 'assistant',
    parent_tool_use_id: null,
    uuid: 'u3',
    message: { id: 'msg1', content: [{ type: 'text', text: 'Status says round 15.' }] }
  },
  {
    type: 'assistant',
    parent_tool_use_id: null,
    uuid: 'u4',
    message: {
      id: 'msg1',
      content: [{ type: 'tool_use', id: 'toolu_bash', name: 'Bash', input: { command: CHECK } }]
    }
  },
  {
    type: 'user',
    parent_tool_use_id: null,
    uuid: 'u5',
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_bash',
          content: [
            {
              type: 'text',
              text: [
                '@mcb {"v":1,"event":"stage","name":"lint"}',
                'lint: floating 0, dark 2',
                '@mcb {"v":1,"event":"lint","counts":{"floating":0,"dark":2}}',
                '@mcb {"v":1,"event":"done","seconds":3.4}'
              ].join('\n')
            }
          ]
        }
      ]
    }
  },
  {
    type: 'assistant',
    parent_tool_use_id: null,
    uuid: 'u6',
    message: {
      id: 'msg2',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_task',
          name: 'Agent',
          input: { subagent_type: 'render-critic', description: 'critique' }
        }
      ]
    }
  },
  {
    type: 'assistant',
    parent_tool_use_id: 'toolu_task',
    uuid: 'u7',
    message: {
      id: 'msg3',
      content: [
        { type: 'text', text: '1. east frame thin' },
        { type: 'tool_use', id: 'toolu_read', name: 'Read', input: { file_path: 'x.png' } }
      ]
    }
  },
  {
    type: 'user',
    parent_tool_use_id: null,
    uuid: 'u8',
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_task', content: 'verdict: fix first' }]
    }
  },
  {
    type: 'result',
    subtype: 'success',
    is_error: false,
    duration_ms: 12345,
    num_turns: 4,
    uuid: 'u9',
    total_cost_usd: 0.01
  }
]

const run = (msgs: Parameters<typeof claudeEvents>[0][]): Item[] =>
  msgs.flatMap(claudeEvents).reduce(reduce, [] as Item[])

describe('transcript', () => {
  it('streams text, then replaces it with the final message', () => {
    const live = run(MSGS.slice(0, 3))
    expect(live.at(-1)).toMatchObject({ kind: 'text', live: true, text: 'Status says round 15.' })
    const done = run(MSGS.slice(0, 4))
    expect(done.filter((i) => i.kind === 'text')).toEqual([
      { kind: 'text', id: 'u3:0', text: 'Status says round 15.', parent: null }
    ])
    expect(done[0]).toMatchObject({
      kind: 'note',
      text: expect.stringContaining('key from ANTHROPIC_API_KEY')
    })
  })

  it('turns a Bash run of build.py into a job card with its @mcb events', () => {
    const items = run(MSGS)
    const bash = items.find((i) => i.id === 'toolu_bash')
    expect(bash).toMatchObject({ kind: 'tool', name: 'Bash', error: false })
    const s = jobSummary(bash?.kind === 'tool' ? bash.events! : [])
    expect(s.lint?.counts).toEqual({ floating: 0, dark: 2 })
    expect(s.done?.seconds).toBe(3.4)
  })

  it('nests subagent items under their Agent call and fills its result', () => {
    const items = run(MSGS)
    const nested = items.filter(
      (i) => i.kind !== 'user' && i.kind !== 'note' && i.parent === 'toolu_task'
    )
    expect(nested.map((i) => i.id)).toEqual(['u7:0', 'toolu_read'])
    expect(items.find((i) => i.id === 'toolu_task')).toMatchObject({ result: 'verdict: fix first' })
    expect(items.at(-1)).toMatchObject({ kind: 'note', text: 'done in 12.3 s · 4 turns' })
  })

  it('shows stored user turns but not injected context', () => {
    const items = run([
      {
        type: 'user',
        parent_tool_use_id: null,
        uuid: 'a',
        message: { role: 'user', content: 'crown B, thicker frames' }
      },
      {
        type: 'user',
        parent_tool_use_id: null,
        uuid: 'b',
        message: { role: 'user', content: '<system-reminder>x</system-reminder>' }
      }
    ])
    expect(items).toEqual([
      { kind: 'user', id: 'a:0', text: 'crown B, thicker frames', point: 'a' }
    ])
  })

  it('flags a plan proposal, replacing its streamed text', () => {
    const msgs: AgentMsg[] = [
      { type: 'text', id: 'p1', text: '1. Walls', parent: null, delta: true },
      { type: 'text', id: 'p1', text: '1. Walls, 2. Roof', parent: null, plan: true }
    ]
    expect(msgs.reduce(reduce, [] as Item[])).toEqual([
      { kind: 'text', id: 'p1', text: '1. Walls, 2. Roof', parent: null, plan: true }
    ])
  })

  it('ignores suggestion messages so they stay out of the transcript history', () => {
    const base: Item[] = [{ kind: 'user', id: 'u1', text: 'hi' }]
    expect(reduce(base, { type: 'suggestion', id: 's1', text: 'Next step' })).toBe(base)
  })
})

describe('activity', () => {
  const tool = (name: string, input: Record<string, unknown> = {}, result?: string): Item => ({
    kind: 'tool',
    id: name,
    name,
    input,
    parent: null,
    result
  })
  it.each([
    [[], 0, 'Thinking'],
    [[tool('Edit')], 0, 'Editing'],
    [[tool('Bash', { command: 'ls' })], 0, 'Running'],
    [[tool('Bash', { command: CHECK })], 0, 'Building'],
    [[tool('Grep')], 0, 'Searching'],
    [[tool('AskUserQuestion')], 0, 'Asking'],
    [[tool('ExitPlanMode')], 0, 'Planning'],
    [[tool('mcp__studio__request_review')], 0, 'Waiting for review'],
    [[tool('mcp__other__thing')], 0, 'Working'],
    [[tool('Edit', {}, 'ok')], 0, 'Thinking'],
    [[{ kind: 'text', id: 't', text: 'Hi', parent: null, live: true }], 0, 'Writing'],
    [[tool('Edit')], 1, 'Waiting for you']
  ] as [Item[], number, string][])('%j with %i asks reads %s', (items, asks, label) => {
    expect(activity(items, asks)).toBe(label)
  })
})
