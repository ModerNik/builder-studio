import type { ReactElement } from 'react'
import { Button } from '@/shared/ui/primitives/button'
import { Field } from '@/shared/ui/primitives/field'
import { Input } from '@/shared/ui/primitives/input'
import { RadioCard, RadioGroup } from '@/shared/ui/primitives/radio-group'
import { InlineNotice } from '@/shared/ui/feedback/Alert'
import { PROVIDERS, type Provider } from '@shared/api'
import { PROVIDER_TEXT, signInNeeded } from '@/features/agent-chat/model/providers'
import { ApiKey, ProviderBadge } from '@/pages/settings/ui/Ai'
import { StepHeader, type StepProps } from './parts'
import { cancelLogin, useProviderChecks } from '../model/assistant'

export function Assistant({ form, patch, act, save }: StepProps): ReactElement {
  const { checks, login } = useProviderChecks(save)
  const selected = checks.data?.find((c) => c.provider === form.provider)
  return (
    <div className="flex flex-col gap-6">
      <StepHeader eyebrow="Step 5 of 6 · Optional" title="Pick an AI assistant">
        The assistant drafts and revises builds with you. You can switch at any time.
      </StepHeader>
      <RadioGroup
        aria-label="AI assistant"
        value={form.provider}
        onValueChange={(id) => patch({ provider: id as Provider })}
      >
        {PROVIDERS.map((id) => {
          const check = checks.data?.find((c) => c.provider === id)
          return (
            <RadioCard
              key={id}
              value={id}
              title={PROVIDER_TEXT[id].name}
              description={id === 'ollama' ? 'Runs on your PC' : PROVIDER_TEXT[id].meta}
              badge={<ProviderBadge provider={id} check={check} checking={checks.isFetching} />}
            >
              {id === 'codex' && check && signInNeeded(check) && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="primary"
                    disabled={login.isPending}
                    onClick={() => login.mutate()}
                  >
                    Sign in with ChatGPT
                  </Button>
                  {login.isPending ? (
                    <Button variant="ghost" onClick={cancelLogin}>
                      Cancel sign-in
                    </Button>
                  ) : (
                    <span className="text-sm text-fg-muted">Opens your browser</span>
                  )}
                </div>
              )}
              {id === 'claude' && (
                <ApiKey
                  recheck={() =>
                    act(async () => {
                      await save()
                      await checks.refetch()
                    })
                  }
                />
              )}
              {id === 'ollama' && (
                <>
                  <p className="text-sm text-fg-secondary">
                    Builder Studio connects to an Ollama server you already run. It doesn’t install
                    Ollama or models.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Ollama server address" className="flex-[2_1_14rem]">
                      <Input
                        placeholder="http://127.0.0.1:11434"
                        spellCheck={false}
                        value={form.ollamaEndpoint}
                        onChange={(e) => patch({ ollamaEndpoint: e.target.value })}
                        className="font-mono text-sm"
                      />
                    </Field>
                    <Field label="Installed model name" className="flex-[1_1_10rem]">
                      <Input
                        placeholder="e.g. qwen3:14b"
                        spellCheck={false}
                        value={form.ollamaModel}
                        onChange={(e) => patch({ ollamaModel: e.target.value })}
                        className="font-mono text-sm"
                      />
                    </Field>
                    <Button
                      variant="outline"
                      disabled={checks.isFetching}
                      onClick={() =>
                        act(async () => {
                          await save()
                          await checks.refetch()
                        })
                      }
                    >
                      Test connection
                    </Button>
                  </div>
                  {check && !check.ok && (
                    <InlineNotice tone="danger" className="text-sm">
                      {check.detail}
                    </InlineNotice>
                  )}
                </>
              )}
            </RadioCard>
          )
        })}
      </RadioGroup>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-secondary">
        <p role="status" className="min-w-0 flex-1">
          {checks.isFetching
            ? 'Checking assistants…'
            : selected && !selected.ok && form.provider !== 'ollama'
              ? selected.detail
              : ''}
        </p>
        <Button variant="ghost" disabled={checks.isFetching} onClick={() => void checks.refetch()}>
          Check again
        </Button>
      </div>
      {(checks.error || login.error) && (
        <InlineNotice tone="danger">{String(checks.error ?? login.error)}</InlineNotice>
      )}
      <p className="text-sm text-fg-secondary">
        Claude and Codex send your prompts to their online services. Ollama stays on your PC.
      </p>
    </div>
  )
}
