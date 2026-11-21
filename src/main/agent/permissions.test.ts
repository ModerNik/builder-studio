import { describe, expect, it } from 'vitest'
import { guard, ruleAllows, suggestRule } from './permissions'

const repo = 'D:\\Studio\\workspace'
const bash = (command: string): Record<string, unknown> => ({ command })
const CHECK = '.venv/Scripts/python builds/narkina5/build.py check --x0 10 --sx 40'

describe('guard', () => {
  it('lets ordinary build work through', () => {
    expect(guard('Bash', bash(CHECK), repo)).toBeNull()
    expect(guard('Edit', { file_path: `${repo}\\builds\\narkina5\\tower.py` }, repo)).toBeNull()
    expect(guard('Read', { file_path: 'builds/narkina5/DESIGN.md' }, repo)).toBeNull()
    expect(guard('Bash', bash('rm builds/narkina5/out/tower_v1.litematic'), repo)).toBeNull()
    expect(guard('Bash', bash('rm -rf builds/narkina5/out/tower_v1_3d/'), repo)).toBeNull()
  })
  it('stops git push, deletes outside out/, and paths outside the repo', () => {
    expect(guard('Bash', bash('git commit -m x && git push'), repo)).toBe('git push')
    expect(guard('Bash', bash('rm builds/narkina5/tower.py'), repo)).toMatch(/deletes/)
    expect(guard('Bash', bash('rm -rf builds/narkina5'), repo)).toMatch(/deletes/)
    expect(guard('Bash', bash('Remove-Item docs/x.md'), repo)).toMatch(/deletes/)
    expect(guard('Bash', bash('ls && rm -rf .'), repo)).toMatch(/deletes/)
    expect(guard('Bash', bash('python -c "import shutil; shutil.rmtree(\'x\')"'), repo)).toMatch(
      /code/
    )
    expect(guard('Bash', bash('cat C:\\Users\\someone\\.claude.json'), repo)).toMatch(/outside/)
    expect(guard('Bash', bash('ls /c/Users'), repo)).toMatch(/outside/)
    expect(guard('Bash', bash('cat ../other/README.md'), repo)).toMatch(/outside/)
    expect(guard('Bash', bash('cat ~/.ssh/id_rsa'), repo)).toMatch(/outside/)
    expect(guard('Write', { file_path: 'D:\\Studio\\other\\x.py' }, repo)).toMatch(
      /outside/
    )
    expect(guard('Read', { file_path: '../x' }, repo)).toMatch(/outside/)
  })
  it('accepts absolute paths inside the repo, in either spelling', () => {
    expect(guard('Bash', bash('ls /d/Studio/workspace/builds'), repo)).toBeNull()
    expect(guard('Bash', bash('ls D:/Studio/workspace/builds'), repo)).toBeNull()
  })
})

describe('rules', () => {
  it('suggests the command up to its first flag, and none for chained or interpreter commands', () => {
    expect(suggestRule('Bash', bash(CHECK), repo)).toBe(
      'Bash(.venv/Scripts/python builds/narkina5/build.py check)'
    )
    expect(suggestRule('Bash', bash('python -c "print(1)"'), repo)).toBeNull()
    expect(suggestRule('Bash', bash('git status && git push'), repo)).toBeNull()
    expect(suggestRule('Edit', { file_path: `${repo}\\builds\\narkina5\\tower.py` }, repo)).toBe(
      'Edit(builds/narkina5/)'
    )
    expect(suggestRule('mcp__studio__log_round', {}, repo)).toBe('mcp__studio__log_round')
  })
  it('matches a prefix only for the same command, never a chained one', () => {
    const rule = 'Bash(.venv/Scripts/python builds/narkina5/build.py check)'
    expect(ruleAllows(rule, 'Bash', bash(CHECK), repo)).toBe(true)
    expect(ruleAllows(rule, 'Bash', bash(CHECK.replace('check', 'checkout')), repo)).toBe(false)
    expect(ruleAllows(rule, 'Bash', bash(`${CHECK}; rm -rf builds`), repo)).toBe(false)
    expect(ruleAllows(rule, 'Bash', bash(`${CHECK} && git push`), repo)).toBe(false)
    expect(ruleAllows('Bash(python -c)', 'Bash', bash('python -c "x"'), repo)).toBe(false)
    expect(ruleAllows('Bash', 'Bash', bash('anything'), repo)).toBe(false)
  })
  it('matches file rules by repo-relative folder, and never outside the repo', () => {
    expect(
      ruleAllows(
        'Edit(builds/narkina5/)',
        'Edit',
        { file_path: `${repo}\\builds\\narkina5\\ring.py` },
        repo
      )
    ).toBe(true)
    expect(
      ruleAllows(
        'Edit(builds/narkina5/)',
        'Edit',
        { file_path: `${repo}\\builds\\perimeter_v2\\x.py` },
        repo
      )
    ).toBe(false)
    expect(
      ruleAllows(
        'Edit(builds/narkina5/)',
        'Write',
        { file_path: `${repo}\\builds\\narkina5\\x.py` },
        repo
      )
    ).toBe(false)
    expect(
      ruleAllows(
        'Edit(builds/narkina5/)',
        'Edit',
        { file_path: 'builds/narkina5/../../../x' },
        repo
      )
    ).toBe(false)
  })
})
