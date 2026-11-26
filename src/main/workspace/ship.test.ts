import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { statusBlock } from './review'
import { appendResults, commitBuild, finalizeStaged, validateExportDir } from './ship'

const tmp = (): string => mkdtempSync(join(tmpdir(), 'studio-ship-'))

describe('finalizeStaged', () => {
  it('copies the staged file to the same sub path, refuses anything outside staging', () => {
    const staging = tmp()
    const target = tmp()
    mkdirSync(join(staging, 'Narkina'))
    writeFileSync(join(staging, 'Narkina', 'n.litematic'), 'x')
    const dest = finalizeStaged(join(staging, 'Narkina', 'n.litematic'), staging, target)
    expect(dest).toBe(join(target, 'Narkina', 'n.litematic'))
    expect(readFileSync(dest, 'utf8')).toBe('x')
    const outside = join(tmp(), 'evil.litematic')
    writeFileSync(outside, 'y')
    expect(() => finalizeStaged(outside, staging, target)).toThrow(/not a staged final/)
  })
})

describe('validateExportDir', () => {
  it('accepts an existing writable absolute folder and rejects empty, relative, missing or file paths', async () => {
    const dir = tmp()
    await expect(validateExportDir(dir)).resolves.toBe(dir)
    const file = join(dir, 'not-a-dir.txt')
    writeFileSync(file, 'x')
    await expect(validateExportDir('')).rejects.toThrow(/Choose an export/)
    await expect(validateExportDir('   ')).rejects.toThrow(/Choose an export/)
    await expect(validateExportDir('relative/path')).rejects.toThrow(/absolute path/)
    await expect(validateExportDir(file)).rejects.toThrow(/not a folder/)
    await expect(validateExportDir(join(dir, 'missing'))).rejects.toThrow(/not a folder/)
  })
})

describe('appendResults and commitBuild', () => {
  it('adds the table to the log, commits builds/<name> only, and is a no-op when clean', async () => {
    const repo = tmp()
    const g = (...a: string[]): string => execFileSync('git', a, { cwd: repo, encoding: 'utf8' })
    g('init', '-q')
    g('config', 'user.email', 't@t')
    g('config', 'user.name', 't')
    const dir = join(repo, 'builds', 'b')
    mkdirSync(dir, { recursive: true })
    const md = '# B\n\n## Status\n- s\n\n## Process log\n### Round 1: q (d)\n- x\n'
    writeFileSync(join(dir, 'DESIGN.md'), md)
    writeFileSync(join(repo, 'other.txt'), 'unrelated')
    await appendResults(repo, 'b', 'Shipped b (2026-10-27)', [['Format', '.litematic']])
    const out = readFileSync(join(dir, 'DESIGN.md'), 'utf8')
    expect(statusBlock(out)).toBe(statusBlock(md))
    expect(out).toContain(
      '- x\n\n### Shipped b (2026-10-27)\n\n| Check | Result |\n| --- | --- |\n| Format | .litematic |\n'
    )

    const first = await commitBuild(repo, 'b', 'ship b')
    expect(first.committed).toBe(true)
    expect(g('show', '--name-only', '--format=%s', 'HEAD').trim().split('\n')).toEqual([
      'ship b',
      '',
      'builds/b/DESIGN.md'
    ])
    expect(g('status', '--porcelain')).toContain('?? other.txt')
    expect(existsSync(join(repo, 'other.txt'))).toBe(true)

    const second = await commitBuild(repo, 'b', 'ship b')
    expect(second.committed).toBe(false)
    expect(second.output).toMatch(/Nothing to commit/i)
  })
})
