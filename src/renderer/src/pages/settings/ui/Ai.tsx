// Settings › AI assistant: which provider drafts with you, its connection, and how many variants run at once.
import type { ReactElement } from 'react'
import { CircleCheck, CircleDashed, CircleX, LoaderCircle, TriangleAlert } from 'lucide-react'
import { Button } from '@/shared/ui/primitives/button'
import { Field } from '@/shared/ui/primitives/field'
import { Input } from '@/shared/ui/primitives/input'
import { NumberField } from '@/shared/ui/primitives/number-field'
import { RadioCard, RadioGroup } from '@/shared/ui/primitives/radio-group'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { SettingsPanel, SettingsRow } from '@/entities/settings/ui/Settings'
import { PROVIDER_TEXT, signInNeeded } from '@/features/agent-chat/model/providers'
import { type Provider, type ProviderDiagnostic, type Settings } from '@shared/api'
import { PROVIDERS } from '@shared/constants'
import { ErrorNotice, SettingInput } from './bits'
import { clampCap } from '@/entities/settings/model/cap'
import { useSaveSettings } from '@/entities/settings/model/save'
import { useApiKey, useCodexLogin, useProviderChecks } from '../model/ai'

/** A provider's check as a badge: Ready, API key needed, Sign-in needed, Not connected, Not reachable (Ollama), Checking…. */
export function ProviderBadge({
  provider,
  check,
  checking
}: {
  provider: Provider
  check: ProviderDiagnostic | undefined
  checking: boolean
}): ReactElement {
  if (!check)
    return checking ? (
      <StatusBadge tone="neutral" icon={LoaderCircle}>
        Checking…
      </StatusBadge>
    ) : (
      <StatusBadge tone="neutral" icon={CircleDashed}>
        Not checked
      </StatusBadge>
    )
  if (check.ok)
    return (
      <StatusBadge tone="success" icon={CircleCheck}>
        Ready
      </StatusBadge>
    )
  if (/API key/.test(check.detail))
    return (
      <StatusBadge tone="warning" icon={TriangleAlert}>
        API key needed
      </StatusBadge>
    )
  if (signInNeeded(check))
    return (
      <StatusBadge tone="warning" icon={TriangleAlert}>
        Sign-in needed
      </StatusBadge>
    )
  return provider === 'ollama' && /refused|reach|connect|ECONN|fetch/i.test(check.detail) ? (
    <StatusBadge tone="danger" icon={CircleX}>
      Not reachable
    </StatusBadge>
  ) : (
    <StatusBadge tone="neutral" icon={CircleDashed}>
      Not connected
    </StatusBadge>
  )
}

export function Ai({ settings }: { settings: Settings }): ReactElement {
  const save = useSaveSettings()
  const checks = useProviderChecks()
  const cap = clampCap(settings.variantCap)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <RadioGroup
          aria-label="AI assistant"
          data-issue="ai claude"
          value={settings.provider}
          disabled={save.isPending}
          onValueChange={(id) => save.mutate({ provider: id as Provider })}
        >
          {PROVIDERS.map((id) => {
            const check = checks.data?.find((p) => p.provider === id)
            return (
              <RadioCard
                key={id}
                value={id}
                title={PROVIDER_TEXT[id].name}
                description={PROVIDER_TEXT[id].meta}
                badge={<ProviderBadge provider={id} check={check} checking={checks.isFetching} />}
              >
                {id === 'ollama' && <OllamaFields settings={settings} />}
                {id === 'claude' && <ApiKey recheck={() => void checks.refetch()} />}
                <ProviderDetail
                  provider={id}
                  check={check}
                  checking={checks.isFetching}
                  recheck={() => void checks.refetch()}
                />
              </RadioCard>
            )
          })}
        </RadioGroup>
        <p className="text-sm text-fg-secondary">Switching the assistant reloads the window.</p>
        <ErrorNotice error={save.error ?? checks.error} />
      </div>
      <SettingsPanel>
        <SettingsRow
          title="Variants drafted at once"
          htmlFor="variant-cap"
          detail={`When you ask for options, this many are drafted side by side, 2 to 6. More is faster but uses more of your AI plan.`}
        >
          <NumberField
            id="variant-cap"
            className="w-32"
            min={2}
            max={6}
            value={cap}
            disabled={save.isPending}
            onValueChange={(v) => v != null && save.mutate({ variantCap: clampCap(v) })}
          />
        </SettingsRow>
      </SettingsPanel>
    </div>
  )
}

/** The chosen card's check: what it found, Check again, and how to sign in when it is signed out. */
export function ProviderDetail({
  provider,
  check,
  checking,
  recheck
}: {
  provider: Provider
  check: ProviderDiagnostic | undefined
  checking: boolean
  recheck: () => void
}): ReactElement {
  const { login, cancel } = useCodexLogin()
  const codexSignIn = provider === 'codex' && !!check && signInNeeded(check)
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={
            codexSignIn
              ? 'min-w-0 flex-[1_1_12rem] text-sm text-fg-secondary'
              : 'min-w-0 flex-[1_1_12rem] font-mono text-sm break-words text-fg-secondary'
          }
        >
          {codexSignIn
            ? 'Codex was found on this PC. Sign in once to connect it.'
            : (check?.detail ?? (checking ? 'Checking…' : ''))}
        </span>
        {codexSignIn && !login.isSuccess && (
          <Button variant="primary" disabled={login.isPending} onClick={() => login.mutate()}>
            Sign in with ChatGPT
          </Button>
        )}
        <Button variant="outline" disabled={checking} onClick={recheck}>
          Check again
        </Button>
      </div>
      {codexSignIn && !login.isSuccess && (
        <p className="text-sm text-fg-muted">Opens your browser.</p>
      )}
      {login.isSuccess && (
        <InlineNotice tone="info" className="flex-wrap items-center text-sm">
          Finish signing in in your browser, then check again.
          <Button variant="ghost" size="sm" onClick={() => cancel.mutate()}>
            Cancel sign-in
          </Button>
        </InlineNotice>
      )}
      <ErrorNotice error={login.error ?? cancel.error} />
    </>
  )
}

/** The key is write-only here: main keeps it encrypted and only says whether one is saved. */
export function ApiKey({ recheck }: { recheck: () => void }): ReactElement {
  const { saved, key, setKey, save } = useApiKey(recheck)
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(key)
      }}
    >
      <Field
        label={saved.data ? 'Anthropic API key · saved' : 'Anthropic API key'}
        hint="Create a key in the Anthropic Console; usage is billed to that account. It is stored encrypted on this PC. To use a Claude subscription instead, connect Claude Code or Claude Desktop under External agents."
      >
        <span className="flex flex-wrap gap-2">
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-[1_1_14rem] font-mono text-sm"
            value={key}
            placeholder={saved.data ? 'Enter a new key to replace the saved one' : 'sk-ant-…'}
            onChange={(e) => setKey(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={!key.trim() || save.isPending}>
            Save key
          </Button>
          {saved.data && (
            <Button
              type="button"
              variant="ghost"
              disabled={save.isPending}
              onClick={() => save.mutate('')}
            >
              Remove
            </Button>
          )}
        </span>
      </Field>
      <ErrorNotice error={save.error ?? saved.error} />
    </form>
  )
}

function OllamaFields({ settings }: { settings: Settings }): ReactElement {
  return (
    <div className="grid gap-3 @md:grid-cols-2">
      <Field id="setting-ollamaEndpoint" label="Server address" hint="Saves when you leave it.">
        <SettingInput
          setting="ollamaEndpoint"
          value={settings.ollamaEndpoint}
          placeholder="http://127.0.0.1:11434"
          onBlurOnly
        />
      </Field>
      <Field id="setting-ollamaModel" label="Model">
        <SettingInput
          setting="ollamaModel"
          value={settings.ollamaModel}
          placeholder="An installed model, e.g. qwen3-coder"
          mono={false}
          onBlurOnly
        />
      </Field>
    </div>
  )
}
