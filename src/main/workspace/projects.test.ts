import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  archiveBuild,
  deleteVersion,
  listBuilds,
  outSize,
  parseDesign,
  renameBuild
} from './projects'

const MD = `# Narkina5

Intro.

## Status
- Current version: pit_v1 approved (round 13: hull-corner whirlpools next).
- Open items: approve the block-out;
  then detail windows.

## 4. Process log
### Sketch v1 (2026-10-26)
- not a round
### Round 3: heptagon (2026-10-26)
### Round 12 — pit bottom
- Status: not this one
### Shipped pit_v1 (2026-10-30)
`

describe('parseDesign', () => {
  it('reads Status bullets and Round headings', () => {
    const d = parseDesign(MD)
    expect(d.status).toEqual([
      'Current version: pit_v1 approved (round 13: hull-corner whirlpools next).',
      'Open items: approve the block-out; then detail windows.'
    ])
    expect(d.rounds).toEqual([
      { n: 3, title: 'heptagon (2026-10-26)' },
      { n: 12, title: 'pit bottom' }
    ])
    expect(d.shipped).toEqual(['pit_v1'])
  })

  it('copes with no DESIGN.md', () => {
    expect(parseDesign('')).toEqual({ status: [], rounds: [], shipped: [] })
  })
})

function repo(): { root: string; trashed: string[]; trash: (p: string) => Promise<void> } {
  const root = mkdtempSync(join(tmpdir(), 'studio-'))
  const put = (rel: string, text = 'x'): void => {
    mkdirSync(join(root, rel, '..'), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
  put('builds/ring/build.py')
  put('builds/ring/DESIGN.md', '## Status')
  put('builds/ring/out/v1.litematic', '12345')
  put('builds/ring/out/v1_3d/sheet.png')
  put('builds/ring/out/v1.parts.npz')
  put('builds/ring/out/.parts/v1/abc.litematic')
  put('builds/other/build.py')
  const trashed: string[] = []
  return { root, trashed, trash: async (p) => void trashed.push(p) }
}

describe('build file operations', () => {
  it('keeps draft versions independent of project upgrades and defaults older drafts to 26.3', async () => {
    const r = repo()
    writeFileSync(join(r.root, 'builds/ring/minecraft.json'), '{"minecraftVersion":"1.20.1"}')
    writeFileSync(
      join(r.root, 'builds/ring/out/v1.minecraft.json'),
      '{"minecraftVersion":"1.12.2"}'
    )
    writeFileSync(join(r.root, 'builds/ring/out/old.litematic'), 'x')
    const ring = (await listBuilds(r.root)).find((b) => b.name === 'ring')!
    expect(ring.minecraftVersion).toBe('1.20.1')
    expect(Object.fromEntries(ring.versions.map((v) => [v.path, v.minecraftVersion]))).toEqual({
      'builds/ring/out/v1.litematic': '1.12.2',
      'builds/ring/out/old.litematic': '26.3'
    })
  })

  it('reads where a draft sits in the build from its sidecar', async () => {
    const r = repo()
    writeFileSync(
      join(r.root, 'builds/ring/out/v1.minecraft.json'),
      '{"minecraftVersion":"26.3","origin":[-4,60,12]}'
    )
    writeFileSync(join(r.root, 'builds/ring/out/old.litematic'), 'x')
    const ring = (await listBuilds(r.root)).find((b) => b.name === 'ring')!
    expect(Object.fromEntries(ring.versions.map((v) => [v.path, v.origin]))).toEqual({
      'builds/ring/out/v1.litematic': [-4, 60, 12],
      'builds/ring/out/old.litematic': undefined
    })
  })

  it('still lists every project when one has an unsupported or corrupt version file', async () => {
    const r = repo()
    writeFileSync(join(r.root, 'builds/ring/minecraft.json'), '{"minecraftVersion":"99.0"}')
    writeFileSync(join(r.root, 'builds/ring/out/v1.minecraft.json'), '{')
    const builds = await listBuilds(r.root)
    expect(builds.map((b) => b.name).sort()).toEqual(['other', 'ring'])
    const ring = builds.find((b) => b.name === 'ring')!
    expect(ring.minecraftVersion).toBeUndefined()
    expect(ring.versions[0].minecraftVersion).toBeUndefined()
  })

  it('flags only versions with a parts sidecar', async () => {
    const r = repo()
    writeFileSync(join(r.root, 'builds/ring/out/legacy.litematic'), 'x')
    const ring = (await listBuilds(r.root)).find((b) => b.name === 'ring')!
    expect(Object.fromEntries(ring.versions.map((v) => [v.path, !!v.parts]))).toEqual({
      'builds/ring/out/v1.litematic': true,
      'builds/ring/out/legacy.litematic': false
    })
  })

  it('trashes a version and its renders, and refuses paths outside out/', async () => {
    const r = repo()
    await deleteVersion(r.root, 'builds/ring/out/v1.litematic', r.trash)
    expect(r.trashed).toEqual(
      ['v1.litematic', 'v1_3d', 'v1.parts.npz', '.parts/v1'].map((p) =>
        join(r.root, 'builds/ring/out', p)
      )
    )
    await expect(deleteVersion(r.root, 'builds/ring/build.py', r.trash)).rejects.toThrow()
    await expect(deleteVersion(r.root, 'builds/../x/out/a.litematic', r.trash)).rejects.toThrow()
  })

  it('renames in place and refuses collisions and bad names', async () => {
    const r = repo()
    await expect(renameBuild(r.root, 'ring', 'other')).rejects.toThrow('already exists')
    await expect(renameBuild(r.root, 'ring', '../x')).rejects.toThrow()
    await expect(renameBuild(r.root, '../ring', 'x')).rejects.toThrow()
    expect(await renameBuild(r.root, 'ring', 'ring2')).toBe('ring2')
    expect(existsSync(join(r.root, 'builds/ring2/DESIGN.md'))).toBe(true)
  })

  it('archives the sources, trashes out/, and hides _archive from the gallery', async () => {
    const r = repo()
    expect(await outSize(r.root, 'ring')).toBe(8)
    await archiveBuild(r.root, 'ring', r.trash)
    expect(r.trashed).toEqual([join(r.root, 'builds/ring/out')])
    expect(existsSync(join(r.root, 'builds/_archive/ring/build.py'))).toBe(true)
    expect((await listBuilds(r.root)).map((b) => b.name)).toEqual(['other'])
  })
})
