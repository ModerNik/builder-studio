import type { Provider, ProviderDiagnostic } from '@shared/api'

export const PROVIDER_TEXT: Record<Provider, { name: string; meta: string }> = {
  claude: { name: 'Claude', meta: 'Anthropic · your own API key · runs online' },
  codex: { name: 'Codex', meta: 'OpenAI · runs online' },
  ollama: { name: 'Ollama', meta: 'Runs on your PC · uses a server you already run' }
}

/** A failed check that a sign-in would fix. */
export const signInNeeded = (p: ProviderDiagnostic): boolean =>
  !p.ok && /sign|log ?in|auth/i.test(p.detail)
