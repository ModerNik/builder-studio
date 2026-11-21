import { spawnSync } from 'child_process'
import { mkdtempSync, realpathSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { canonicalPath, under } from './paths'

const root = resolve('/repo')

describe('under', () => {
  it('serves files inside the root', () => {
    expect(under(root, 'builds/x/out/sheet.png')).toBe(
      join(root, 'builds', 'x', 'out', 'sheet.png')
    )
    expect(under(root, 'builds\\x\\a.litematic')).toBe(join(root, 'builds', 'x', 'a.litematic'))
  })

  it('refuses anything that leaves it', () => {
    for (const bad of [
      '..',
      '../secret',
      'builds/../../x',
      'builds/..\\..\\x',
      '/etc/passwd',
      'C:/Windows/win.ini',
      'c:x',
      ''
    ])
      expect(under(root, bad), bad).toBeNull()
    expect(under('', 'a')).toBeNull()
  })
})

it.skipIf(process.platform !== 'win32')(
  'canonicalizes Windows short-path ancestors, including missing children',
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'studio short paths '))
    try {
      const result = spawnSync('cmd.exe', ['/d', '/c', `for %I in ("${dir}") do @echo %~sI`], {
        encoding: 'utf8',
        windowsVerbatimArguments: true
      })
      expect(result.status).toBe(0)
      const short = result.stdout.trim()
      const expected = realpathSync.native(dir)
      expect(canonicalPath(short)).toBe(expected)
      expect(canonicalPath(join(short, 'missing', 'workspace'))).toBe(
        join(expected, 'missing', 'workspace')
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
)
