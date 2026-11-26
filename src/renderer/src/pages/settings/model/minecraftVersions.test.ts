import { describe, expect, it } from 'vitest'
import { MINECRAFT_VERSIONS } from '@shared/minecraft'
import {
  addableMinecraftVersions,
  defaultAddVersion,
  visibleMinecraftVersions,
  withVersionFiles,
  withoutVersionFiles
} from './minecraftVersions'

describe('Settings › Minecraft version helpers', () => {
  it('lists only the default target and explicitly configured versions, newest first', () => {
    expect(visibleMinecraftVersions('26.3', undefined)).toEqual(['26.3'])
    expect(
      visibleMinecraftVersions('26.3', {
        '1.20.4': { jar: 'a.jar' },
        '26.2': {}
      })
    ).toEqual(['26.3', '26.2', '1.20.4'])
  })

  it('excludes visible versions from addable versions while preserving chronological order', () => {
    const addable = addableMinecraftVersions(['26.3', '26.2'])
    expect(addable).not.toContain('26.3')
    expect(addable).not.toContain('26.2')
    expect(addable.length).toBe(MINECRAFT_VERSIONS.length - 2)
    expect(addable[0]).toBe(MINECRAFT_VERSIONS[0])
  })

  it('preselects the newest detected addable version, falling back to the newest addable', () => {
    const addable = addableMinecraftVersions(['26.3'])
    expect(
      defaultAddVersion(addable, [
        { version: '1.21.11', jar: '1.21.11.jar' },
        { version: '26.2', jar: '26.2.jar' }
      ])
    ).toBe('26.2')
    expect(defaultAddVersion(addable, [])).toBe(addable.at(-1))
    expect(defaultAddVersion([], [])).toBe('')
  })

  it('adds version entries with trimmed non-empty paths and removes entries cleanly', () => {
    const added = withVersionFiles(undefined, '1.21.11', { jar: '  client.jar  ', pack: '   ' })
    expect(added).toEqual({ '1.21.11': { jar: 'client.jar' } })

    const empty = withVersionFiles(added, '26.2', { jar: '', pack: '' })
    expect(empty).toEqual({ '1.21.11': { jar: 'client.jar' }, '26.2': {} })

    expect(withoutVersionFiles(empty, '1.21.11')).toEqual({ '26.2': {} })
  })
})
