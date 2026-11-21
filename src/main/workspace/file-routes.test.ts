import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { servedFile, toolPath, type FileRoots } from './paths'

let base = ''
afterEach(() => {
  if (base) rmSync(base, { recursive: true, force: true })
})

describe('workspace/resource/cache file routes', () => {
  it('serves relocated bridge paths and only approved public resources/cache files', () => {
    base = mkdtempSync(join(tmpdir(), 'studio routes сборка '))
    const roots: FileRoots = {
      workspace: join(base, 'workspace'),
      resources: join(base, 'resources'),
      cache: join(base, 'cache'),
      assets: join(base, 'assets')
    }
    const put = (root: string, rel: string): string => {
      const path = join(root, rel)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, 'data')
      return path
    }
    const schematic = put(roots.workspace, 'builds/starter/out/куб v1.litematic')
    const colors = put(roots.resources, 'lib/mcb/data/block_colors.json')
    const catalog = put(roots.resources, 'docs/catalog.md')
    const map = put(roots.cache, 'site/world карта.png')
    put(roots.cache, 'ship/final.litematic')
    put(roots.resources, 'private.json')
    const index = put(roots.assets, 'index.json')
    const local = (path: string): string => `build://local/${encodeURIComponent(path)}`
    expect(
      servedFile('build://repo/builds/starter/out/' + encodeURIComponent('куб v1.litematic'), roots)
    ).toBe(schematic)
    expect(servedFile('build://resource/lib/mcb/data/block_colors.json', roots)).toBe(colors)
    expect(servedFile(local(catalog), roots)).toBe(catalog)
    expect(servedFile(local(map), roots)).toBe(map)
    expect(servedFile('build://assets/index.json', roots)).toBe(index)
    for (const url of [
      'build://resource/private.json',
      'build://cache/ship/final.litematic',
      'build://repo/a%2f..%2f..%2fprivate.json',
      'build://resource/%',
      'build://other/index.json',
      local(join(base, 'outside.txt')),
      local(join(roots.resources, 'private.json'))
    ])
      expect(servedFile(url, roots), url).toBeNull()
    // Windows junctions need no symlink privilege; aliases must not escape the advertised root.
    const outside = join(base, 'outside')
    put(outside, 'secret.txt')
    symlinkSync(
      outside,
      join(roots.workspace, 'escape'),
      process.platform === 'win32' ? 'junction' : 'dir'
    )
    expect(servedFile('build://repo/escape/secret.txt', roots)).toBeNull()
    expect(toolPath(roots.workspace, 'builds/starter/out/a.png')).toBe(
      join(roots.workspace, 'builds/starter/out/a.png')
    )
    expect(() => toolPath(roots.workspace, '../outside/secret.txt')).toThrow('inside the workspace')
    expect(() => toolPath(roots.workspace, 'escape/secret.txt')).toThrow('through a link')
    expect(() => toolPath(roots.workspace, 'escape/not-created/DESIGN.md')).toThrow(
      'through a link'
    )
  })
})
