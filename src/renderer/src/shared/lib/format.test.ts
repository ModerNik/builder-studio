import { describe, expect, it } from 'vitest'
import { DEFAULT_LINT_RULES, LINT_RULES, type LintRuleToggles } from '@shared/api'
import { hasEnabledLintRule, isLintRuleEnabled, lintProblems } from './format'

const allOff = (): LintRuleToggles =>
  Object.fromEntries(LINT_RULES.map((rule) => [rule, false])) as LintRuleToggles

describe('format lint helpers', () => {
  it('excludes palette and off-by-default floating from default problem counts', () => {
    expect(isLintRuleEnabled('palette')).toBe(false)
    expect(isLintRuleEnabled('floating')).toBe(false)
    expect(isLintRuleEnabled('gravity')).toBe(true)
    expect(lintProblems({ palette: 104, floating: 5, gravity: 3, dark: 2 })).toBe(5)
  })

  it('respects individual rule toggles including enabling floating and disabling rules', () => {
    const counts = { palette: 104, floating: 5, gravity: 4778, dark: 9752, fire: 1 }
    expect(lintProblems(counts, { ...DEFAULT_LINT_RULES, floating: true })).toBe(14536)
    expect(lintProblems(counts, { ...DEFAULT_LINT_RULES, gravity: false, dark: false })).toBe(1)
    expect(lintProblems(counts, allOff())).toBe(0)
  })

  it('reports whether at least one lint rule is enabled', () => {
    expect(hasEnabledLintRule(DEFAULT_LINT_RULES)).toBe(true)
    expect(hasEnabledLintRule(allOff())).toBe(false)
    expect(hasEnabledLintRule({ ...allOff(), floating: true })).toBe(true)
  })
})
