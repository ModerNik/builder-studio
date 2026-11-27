// Settings › Linter: master on/off switch and per-rule toggles for build checks.
import type { ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import { Switch } from '@/shared/ui/primitives/switch'
import { SettingsPanel, SettingsRow } from '@/entities/settings/ui/Settings'
import { CHECK_DESCRIPTIONS, checkLabel } from '@/entities/build/model/workspace'
import { useSaveSettings } from '@/entities/settings/model/save'
import { type LintRule, type LintRuleToggles, type Settings } from '@shared/api'
import { DEFAULT_LINT_RULES, LINT_RULES } from '@shared/constants'
import { ErrorNotice } from './bits'

export function Linter({ settings }: { settings: Settings }): ReactElement {
  const save = useSaveSettings()
  const { linter } = settings
  const setEnabled = (enabled: boolean): void => save.mutate({ linter: { ...linter, enabled } })
  const setRules = (rules: LintRuleToggles): void => save.mutate({ linter: { ...linter, rules } })
  const setRule = (rule: LintRule, on: boolean): void => setRules({ ...linter.rules, [rule]: on })

  const allOn = LINT_RULES.every((r) => linter.rules[r])
  const allOff = LINT_RULES.every((r) => !linter.rules[r])
  const isDefault = LINT_RULES.every((r) => linter.rules[r] === DEFAULT_LINT_RULES[r])

  return (
    <div className="flex flex-col gap-6">
      <SettingsPanel>
        <SettingsRow
          title="Enable linter"
          detail="Run build checks in the workspace and require zero issues before export. Turn off to skip checks."
          htmlFor="setting-linter-enabled"
        >
          <Switch
            id="setting-linter-enabled"
            checked={linter.enabled}
            disabled={save.isPending}
            onCheckedChange={setEnabled}
          />
        </SettingsRow>
      </SettingsPanel>

      <SettingsPanel title="Lint rules">
        <SettingsRow
          title="Rule presets"
          detail="Toggle every rule at once or restore the default set."
          disabled={!linter.enabled}
        >
          <Button
            size="sm"
            variant="outline"
            disabled={!linter.enabled || save.isPending || allOn}
            onClick={() =>
              setRules(Object.fromEntries(LINT_RULES.map((r) => [r, true])) as LintRuleToggles)
            }
          >
            Enable all
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!linter.enabled || save.isPending || allOff}
            onClick={() =>
              setRules(Object.fromEntries(LINT_RULES.map((r) => [r, false])) as LintRuleToggles)
            }
          >
            Disable all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!linter.enabled || save.isPending || isDefault}
            onClick={() => setRules({ ...DEFAULT_LINT_RULES })}
          >
            Reset defaults
          </Button>
        </SettingsRow>
        {LINT_RULES.map((rule) => {
          const id = `setting-lint-${rule}`
          return (
            <SettingsRow
              key={rule}
              title={checkLabel(rule)}
              detail={CHECK_DESCRIPTIONS[rule]}
              htmlFor={id}
              disabled={!linter.enabled}
            >
              <Switch
                id={id}
                checked={linter.rules[rule]}
                disabled={!linter.enabled || save.isPending}
                onCheckedChange={(on) => setRule(rule, on)}
              />
            </SettingsRow>
          )
        })}
      </SettingsPanel>
      <ErrorNotice error={save.error} />
    </div>
  )
}
