import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { readEdits, saveEdits } from './edits'

const repo = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'bs-edits-'))
  mkdirSync(join(root, 'builds', 'tower'), { recursive: true })
  writeFileSync(join(root, 'builds', 'tower', 'build.py'), '')
  return root
}
const EDITS = {
  version: 1 as const,
  states: ['minecraft:oak_stairs[facing=east,half=bottom]', 'minecraft:stone'],
  cells: [0, 64, 0, 1, 1, 64, 0, 2, 2, 64, 0, 0]
}

describe('hand edits', () => {
  it('round-trips through data/edits.json and removes it when empty', async () => {
    const root = repo()
    expect(await readEdits(root, 'tower')).toBeNull()
    saveEdits(root, 'tower', EDITS)
    const path = join(root, 'builds', 'tower', 'data', 'edits.json')
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(EDITS)
    expect(await readEdits(root, 'tower')).toEqual(EDITS)
    saveEdits(root, 'tower', { version: 1, states: [], cells: [] })
    expect(existsSync(path)).toBe(false)
  })

  it('refuses builds outside the workspace and cells naming no state', () => {
    const root = repo()
    expect(() => saveEdits(root, '../tower', EDITS)).toThrow()
    expect(() => saveEdits(root, 'tower', { ...EDITS, cells: [0, 0, 0, 3] })).toThrow(
      /names no state/
    )
  })
})
