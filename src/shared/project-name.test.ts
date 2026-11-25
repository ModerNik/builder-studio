import { describe, expect, it } from 'vitest'
import {
  BuildFolderNameSchema,
  PROJECT_NAME_MAX_LENGTH,
  ProjectNameSchema,
  normalizeProjectName,
  slugFromProjectName
} from './project-name'

describe('ProjectNameSchema', () => {
  it('allows spaces, numbers, Unicode and printable symbols up to the length limit', () => {
    for (const valid of [
      'my_build',
      'Harbor Lighthouse #2 (v5)',
      'Castle: Part 1? / 100% Survival!',
      '2026 Base + Docks [A&B] ~ $50',
      'Сборка №1 — Замок 🏰',
      'a'.repeat(PROJECT_NAME_MAX_LENGTH)
    ]) {
      expect(ProjectNameSchema.parse(valid)).toBe(valid)
    }
    expect(ProjectNameSchema.parse('  Trimmed Name  ')).toBe('Trimmed Name')
  })

  it('rejects empty/whitespace names, names over the limit, and control characters', () => {
    for (const invalid of [
      '',
      '   ',
      'a'.repeat(PROJECT_NAME_MAX_LENGTH + 1),
      'line1\nline2',
      'tab\tname',
      'null\x00byte'
    ]) {
      expect(ProjectNameSchema.safeParse(invalid).success, JSON.stringify(invalid)).toBe(false)
    }
  })
})

describe('slugFromProjectName', () => {
  it('derives engine-safe folder slugs and preserves simple snake_case names', () => {
    expect(slugFromProjectName('my_build')).toBe('my_build')
    expect(slugFromProjectName('Harbor Lighthouse #2 (v5)')).toBe('harbor_lighthouse_2_v5')
    expect(slugFromProjectName('2026 Castle!')).toBe('build_2026_castle')
    expect(slugFromProjectName('!!! 🏰')).toBe('build')
    expect(slugFromProjectName('CON')).toBe('build_con')
    expect(slugFromProjectName('nul')).toBe('build_nul')
    expect(slugFromProjectName('a'.repeat(100)).length).toBeLessThanOrEqual(PROJECT_NAME_MAX_LENGTH)
  })

  it('avoids collisions with existing top-level folders case-insensitively and ignores nested groups', () => {
    expect(slugFromProjectName('My Build', ['my_build', 'my_build_2'])).toBe('my_build_3')
    expect(slugFromProjectName('My Build', ['MY_BUILD'])).toBe('my_build_2')
    expect(slugFromProjectName('Showcase', ['_examples/showcase'])).toBe('showcase')
    expect(BuildFolderNameSchema.safeParse(slugFromProjectName('Castle: Part 1?')).success).toBe(
      true
    )
  })

  it('normalizes display names for case-insensitive duplicate checks', () => {
    expect(normalizeProjectName('  My Castle #1 ')).toBe('my castle #1')
  })
})
