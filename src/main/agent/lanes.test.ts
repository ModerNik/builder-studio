import { describe, expect, it } from 'vitest'
import { join } from 'path'
import { laneGuard } from './lanes'

const repo = join('D:', 'repo')
const g = (tool: string, input: Record<string, unknown>, lane = 'A'): string | null =>
  laneGuard(lane, 'tower', tool, input, repo)

describe('laneGuard', () => {
  it('lets a lane write only its own files in its build', () => {
    expect(g('Write', { file_path: join(repo, 'builds/tower/walk_A.py') })).toBeNull()
    expect(g('Edit', { file_path: 'builds/tower/notes_A.md' })).toBeNull()
    expect(g('Write', { file_path: join(repo, 'builds/tower/walk_B.py') })).toMatch(/own files/)
    expect(g('Edit', { file_path: join(repo, 'builds/tower/build.py') })).toMatch(/own files/)
    expect(g('Edit', { file_path: join(repo, 'builds/other/walk_A.py') })).toMatch(/own files/)
    expect(g('Write', { file_path: join(repo, 'lib/mcb/arch_A.py') })).toMatch(/own files/)
    expect(g('Write', { file_path: join(repo, 'builds/tower/../other/x_A.py') })).toMatch(
      /own files/
    )
    expect(g('NotebookEdit', { notebook_path: join(repo, 'builds/tower/n_A.ipynb') })).toBeNull()
  })

  it('reads freely', () => {
    expect(g('Read', { file_path: join(repo, 'builds/tower/build.py') })).toBeNull()
    expect(g('Bash', { command: 'git log --oneline -5' })).toBeNull()
  })

  it('keeps git and other lanes’ build names out of Bash', () => {
    expect(g('Bash', { command: 'git commit -am x' })).toMatch(/git/)
    expect(g('Bash', { command: 'cd x && git checkout -- builds/tower' })).toMatch(/git/)
    const run = '.venv/Scripts/python builds/tower/walk_A.py proto'
    expect(g('Bash', { command: `${run} --name walk_A` })).toBeNull()
    expect(g('Bash', { command: `${run} --name=walk_A --views iso_ne` })).toBeNull()
    expect(g('Bash', { command: run })).toMatch(/--name/)
    expect(g('Bash', { command: `${run} --name walk_B` })).toMatch(/--name/)
    for (const python of ['"C:/Runtime среда/python.exe"', '"$MCB_PYTHON"']) {
      expect(
        g('Bash', { command: `${python} builds/tower/walk_A.py proto --name walk_A` })
      ).toBeNull()
      expect(
        g('Bash', { command: `${python} builds/tower/walk_A.py proto --name walk_B` })
      ).toMatch(/--name/)
      expect(g('Bash', { command: `${python} builds/tower/walk_A.py proto` })).toMatch(/--name/)
    }
    expect(
      g('Bash', {
        command: `.venv\\Scripts\\python.exe builds\\tower\\walk_A.py proto --name walk`
      })
    ).toMatch(/--name/)
  })
})
