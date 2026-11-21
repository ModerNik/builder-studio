// builds/<b>/data/edits.json: the hand edits the Editor saves. The engine applies them last on every draft.
import { existsSync, mkdirSync, rmSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { EditsFileSchema, type EditsFile } from '@shared/api'
import { buildDir } from './projects'
import { writeAtomic } from './review'

export const MAX_EDIT_CELLS = 1_000_000

const file = (repo: string, build: string): string =>
  join(buildDir(repo, build), 'data', 'edits.json')

/** The build's hand edits, or null when it has none. */
export async function readEdits(repo: string, build: string): Promise<EditsFile | null> {
  const path = file(repo, build)
  const text = await readFile(path, 'utf8').catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return null
    throw e
  })
  return text === null ? null : EditsFileSchema.parse(JSON.parse(text))
}

/** Write the hand edits (tmp + rename); with no cells the file goes. */
export function saveEdits(repo: string, build: string, edits: EditsFile): void {
  const n = edits.cells.length / 4
  if (n > MAX_EDIT_CELLS)
    throw new Error(`Too many hand edits (${n}); the limit is ${MAX_EDIT_CELLS}`)
  for (let i = 3; i < edits.cells.length; i += 4)
    if (edits.cells[i] < 0 || edits.cells[i] > edits.states.length)
      throw new Error(`Hand edit ${(i - 3) / 4} names no state`)
  const path = file(repo, build)
  if (!n) return void rmSync(path, { force: true })
  if (!existsSync(join(path, '..'))) mkdirSync(join(path, '..'), { recursive: true })
  writeAtomic(path, JSON.stringify(edits))
}
