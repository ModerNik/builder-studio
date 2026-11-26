import { describe, expect, it, vi } from 'vitest'
import { exceedsVanillaStructureLimit, exportResultsRows, lintText } from './ship'
vi.mock('@/entities/job/model/jobs', () => ({ useJobs: {} }))

describe('ship', () => {
  it('says lint in words, leaving out info counts and disabled rules', () => {
    expect(lintText(undefined)).toBe('not run')
    expect(lintText({ palette: 4, floating: 1 })).toBe('clean')
    expect(lintText({ palette: 4, floating: 1 }, { floating: true })).toBe('floating 1')
    expect(lintText({ gravity: 3, palette: 1 })).toBe('falls (gravity) 3')
    expect(lintText({ gravity: 3, dark: 2, palette: 1 }, { gravity: false })).toBe('dark 2')
    expect(lintText({ gravity: 3, dark: 2 }, { gravity: false, dark: false })).toBe('clean')
  })

  it('flags vanilla Structure Block (.nbt) builds larger than 48 blocks on any axis', () => {
    expect(exceedsVanillaStructureLimit('nbt', [48, 32, 48])).toBe(false)
    expect(exceedsVanillaStructureLimit('nbt', [49, 20, 20])).toBe(true)
    expect(exceedsVanillaStructureLimit('litematic', [120, 80, 120])).toBe(false)
    expect(exceedsVanillaStructureLimit('schem', [120, 80, 120])).toBe(false)
  })

  it('builds DESIGN.md export summary rows without Hollow count or Bill of materials', () => {
    const rows = exportResultsRows({
      file: 'builds/tower/out/tower.litematic',
      format: 'schem',
      shape: [32, 48, 32],
      paste: [-10, 64, 20],
      lintSummary: 'clean',
      verifySummary: 'bill and shape match',
      exportedTo: 'C:/schematics/Tower/tower.schem'
    })
    expect(rows).toEqual([
      ['File', 'builds/tower/out/tower.litematic'],
      ['Format', '.schem (Sponge)'],
      ['Shape', '32 × 48 × 32'],
      ['Paste at', '-10, 64, 20'],
      ['Lint', 'clean'],
      ['Verify', 'bill and shape match'],
      ['Exported to', 'C:/schematics/Tower/tower.schem']
    ])
  })
})
