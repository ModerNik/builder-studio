import { describe, expect, it } from 'vitest'
import { matchCommands, toolLook } from './logic'

describe('toolLook', () => {
  it('names edits with their line counts', () => {
    expect(
      toolLook('Edit', {
        file_path: 'builds/tower/build.py',
        old_string: 'a\nb',
        new_string: 'a\nb\nc'
      })
    ).toEqual({ kind: 'edit', verb: 'Edited', gist: 'builds/tower/build.py', added: 3, removed: 2 })
    expect(toolLook('Write', { file_path: 'x.py', content: '1\n2' })).toMatchObject({
      verb: 'Wrote',
      added: 2,
      removed: 0
    })
  })
  it('shows the first line of a command and MCP tools by server', () => {
    expect(toolLook('Bash', { command: 'python builds/x/build.py check\necho done' }).gist).toBe(
      'python builds/x/build.py check'
    )
    expect(toolLook('mcp__studio__show_in_viewer', { path: 'out/v3.litematic' })).toMatchObject({
      kind: 'mcp',
      verb: 'studio · show_in_viewer'
    })
    expect(
      toolLook('Task', { subagent_type: 'render-critic', description: 'Judge v3' })
    ).toMatchObject({
      kind: 'agent',
      verb: 'render-critic',
      gist: 'Judge v3'
    })
    expect(toolLook('Mystery', {})).toMatchObject({ kind: 'other', verb: 'Mystery', gist: '' })
    expect(
      toolLook('AskUserQuestion', {
        questions: [
          { header: 'Palette', question: 'Stone?' },
          { header: 'Roof', question: 'Pitch?' }
        ]
      })
    ).toMatchObject({ kind: 'question', verb: 'Asked', gist: 'Palette, Roof' })
    expect(toolLook('ExitPlanMode', { plan: '# Keep upgrade\n1. Walls' })).toMatchObject({
      kind: 'todo',
      verb: 'Proposed plan',
      gist: 'Keep upgrade'
    })
  })
})

describe('matchCommands', () => {
  const cmds = [
    { name: 'compact', description: 'Summarise the conversation' },
    { name: 'build-review', description: 'Review a draft' },
    { name: 'review', description: 'Open Review and wait' }
  ]
  it('opens only for a single sigil token', () => {
    expect(matchCommands('hello', ['/'], cmds).query).toBeNull()
    expect(matchCommands('/rev and more', ['/'], cmds).query).toBeNull()
    expect(matchCommands('$rev', ['/'], cmds).query).toBeNull()
    expect(matchCommands('/', ['/'], cmds).matches).toHaveLength(3)
  })
  it('ranks name prefixes first, then other name or description hits', () => {
    expect(matchCommands('/rev', ['/'], cmds).matches.map((c) => c.name)).toEqual([
      'review',
      'build-review'
    ])
    expect(matchCommands('$SUMM', ['$', '/'], cmds).matches.map((c) => c.name)).toEqual(['compact'])
    expect(matchCommands('/zzz', ['/'], cmds)).toEqual({ query: 'zzz', matches: [] })
  })
})
