import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'fs'
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

  it('copes with no DESIGN.md and parses shipped stems with spaces', () => {
    expect(parseDesign('')).toEqual({ status: [], rounds: [], shipped: [] })
    expect(parseDesign('### Shipped Grand Keep v2 (2026-11-25)\n').shipped).toEqual([
      'Grand Keep v2'
    ])
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

  it('updates displayName in project.json while keeping the folder stable, and refuses collisions/bad names', async () => {
    const r = repo()
    await expect(renameBuild(r.root, 'ring', 'other')).rejects.toThrow('already exists')
    await expect(renameBuild(r.root, 'ring', 'OTHER')).rejects.toThrow('already exists')
    await expect(renameBuild(r.root, 'ring', '   ')).rejects.toThrow()
    await expect(renameBuild(r.root, 'ring', 'bad\nname')).rejects.toThrow()
    await expect(renameBuild(r.root, 'ring', 'a'.repeat(101))).rejects.toThrow()
    await expect(renameBuild(r.root, '../ring', 'Valid Name')).rejects.toThrow()
    expect(await renameBuild(r.root, 'ring', 'Ring #2: Gate & Tower!')).toBe('ring')
    expect(existsSync(join(r.root, 'builds/ring/DESIGN.md'))).toBe(true)
    const ring = (await listBuilds(r.root)).find((b) => b.name === 'ring')!
    expect(ring.displayName).toBe('Ring #2: Gate & Tower!')
    // case-only rename of the same build succeeds
    expect(await renameBuild(r.root, 'ring', 'ring #2: gate & tower!')).toBe('ring')
  })

  it('picks full isometric preview of shipped/final build over contact sheets and random detail folders', async () => {
    const r = repo()
    const put = (rel: string, mtimeSec: number): void => {
      const p = join(r.root, rel)
      mkdirSync(join(p, '..'), { recursive: true })
      writeFileSync(p, 'png')
      utimesSync(p, mtimeSec, mtimeSec)
    }
    // Only sheet.png exists initially -> preview stays undefined (never uses tiled sheet.png)
    const initial = (await listBuilds(r.root)).find((b) => b.name === 'ring')!
    expect(initial.preview).toBeUndefined()
    expect(initial.sheet).toBe('builds/ring/out/v1_3d/sheet.png')

    // Arbitrary non-version subfolder with a newer iso render must be ignored
    put('builds/ring/out/window_closeup/iso_se.png', 5000)
    put('builds/ring/out/v1_3d/elev_s.png', 4000)
    expect((await listBuilds(r.root)).find((b) => b.name === 'ring')!.preview).toBeUndefined()

    // Fallback to newest version's isometric render when no final/shipped build exists yet
    put('builds/ring/out/v1_3d/iso_sw.png', 1000)
    expect((await listBuilds(r.root)).find((b) => b.name === 'ring')!.preview).toBe(
      'builds/ring/out/v1_3d/iso_sw.png'
    )

    // Full build stem (matching folder name "ring") beats draft version v1
    put('builds/ring/out/ring_3d/iso_se.png', 2000)
    expect((await listBuilds(r.root)).find((b) => b.name === 'ring')!.preview).toBe(
      'builds/ring/out/ring_3d/iso_se.png'
    )

    // Shipped build in DESIGN.md beats everything else (preferring iso_se over iso_nw)
    writeFileSync(
      join(r.root, 'builds/ring/DESIGN.md'),
      '## Status\n### Shipped final_v3 (2026-11-25)\n'
    )
    put('builds/ring/out/final_v3_3d/iso_nw.png', 3000)
    put('builds/ring/out/final_v3_3d/iso_se.png', 3000)
    const finalBuild = (await listBuilds(r.root)).find((b) => b.name === 'ring')!
    expect(finalBuild.preview).toBe('builds/ring/out/final_v3_3d/iso_se.png')
    expect(finalBuild.previewMtime).toBeGreaterThan(0)

    // Custom Render Studio thumbnail (preview.png) takes priority over iso_se.png
    put('builds/ring/out/final_v3_3d/preview.png', 4000)
    const customThumb = (await listBuilds(r.root)).find((b) => b.name === 'ring')!
    expect(customThumb.preview).toBe('builds/ring/out/final_v3_3d/preview.png')

    // A newer custom Render Studio thumbnail on a draft overrides an older shipped thumbnail
    put('builds/ring/out/v2.litematic', 5000)
    put('builds/ring/out/v2_3d/preview.png', 6000)
    const newerThumb = (await listBuilds(r.root)).find((b) => b.name === 'ring')!
    expect(newerThumb.preview).toBe('builds/ring/out/v2_3d/preview.png')
  })

  it('supports _ctx isometric fallback, custom iso_*.png views, and malformed project.json fallback', async () => {
    const r = repo()
    writeFileSync(join(r.root, 'builds/other/project.json'), '{not-json')
    mkdirSync(join(r.root, 'builds/other/out/v1_ctx'), { recursive: true })
    writeFileSync(join(r.root, 'builds/other/out/v1.litematic'), 'x')
    writeFileSync(join(r.root, 'builds/other/out/v1_ctx/iso_custom.png'), 'png')
    const other = (await listBuilds(r.root)).find((b) => b.name === 'other')!
    expect(other.displayName).toBe('other')
    expect(other.preview).toBe('builds/other/out/v1_ctx/iso_custom.png')
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
