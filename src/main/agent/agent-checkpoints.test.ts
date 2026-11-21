import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { AgentCheckpoints } from './agent-checkpoints'

let workspace: string
let build: string
let checkpoints: AgentCheckpoints

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'studio-rewind-'))
  build = join(workspace, 'builds', 'castle')
  mkdirSync(join(build, 'out'), { recursive: true })
  checkpoints = new AgentCheckpoints()
})

afterEach(() => rmSync(workspace, { recursive: true, force: true }))

it('restores source changes across turns and leaves generated output alone', () => {
  const file = join(build, 'build.py')
  const note = join(build, 'keep.md')
  const generated = join(build, 'out', 'castle.litematic')
  writeFileSync(file, 'original')
  writeFileSync(note, 'notes')
  checkpoints.start('thread', workspace, 'castle', true)
  writeFileSync(file, 'edit one')
  rmSync(note)
  checkpoints.finish('thread', 'session', 'first')
  checkpoints.start('thread', workspace, 'castle', true)
  writeFileSync(file, 'edit two')
  writeFileSync(generated, 'output')
  writeFileSync(join(build, 'new.py'), 'added')
  checkpoints.finish('thread', 'session', 'second')

  const plan = checkpoints.plan(workspace, 'castle', 'session', ['first', 'second'])
  expect(plan.files).toEqual(['build.py', 'keep.md', 'new.py'])
  plan.apply()
  expect(readFileSync(file, 'utf8')).toBe('original')
  expect(readFileSync(note, 'utf8')).toBe('notes')
  expect(readFileSync(generated, 'utf8')).toBe('output')
  expect(() => readFileSync(join(build, 'new.py'))).toThrow(/ENOENT/)
})

it('refuses to rewind across edits made between turns or after the last turn', () => {
  const file = join(build, 'build.py')
  writeFileSync(file, 'original')
  checkpoints.start('thread', workspace, 'castle', true)
  writeFileSync(file, 'edit one')
  checkpoints.finish('thread', 'session', 'first')
  writeFileSync(file, 'manual edit between turns')
  expect(() => checkpoints.plan(workspace, 'castle', 'session', ['first'])).toThrow(/newer edit/)
  checkpoints.start('thread', workspace, 'castle', true)
  writeFileSync(file, 'edit two')
  checkpoints.finish('thread', 'session', 'second')
  expect(() => checkpoints.plan(workspace, 'castle', 'session', ['first', 'second'])).toThrow(
    /newer edit/
  )
  expect(readFileSync(file, 'utf8')).toBe('edit two')
})

it('discards overlapping captures for the same build', () => {
  checkpoints.start('one', workspace, 'castle', true)
  checkpoints.start('two', workspace, 'castle', true)
  checkpoints.finish('one', 'session-one', 'first')
  checkpoints.finish('two', 'session-two', 'second')
  expect(() => checkpoints.plan(workspace, 'castle', 'session-one', ['first'])).toThrow(
    /unavailable/
  )
  expect(() => checkpoints.plan(workspace, 'castle', 'session-two', ['second'])).toThrow(
    /unavailable/
  )
})
