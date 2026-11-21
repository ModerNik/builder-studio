// Settings › AI assistant: provider checks, Codex sign-in and the Anthropic API key.
import { useState } from 'react'
import { useMutation, useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ProviderDiagnostic } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'

export function useProviderChecks(): UseQueryResult<ProviderDiagnostic[]> {
  // the same query Setup's provider checks use; here it runs on its own once
  return useQuery({
    queryKey: ['provider-checks'],
    queryFn: () => studio.agent.diagnose(),
    retry: false
  })
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads all of it
export function useCodexLogin() {
  const login = useMutation({ mutationFn: () => studio.agent.login() })
  const cancel = useMutation({
    mutationFn: () => studio.agent.cancelLogin(),
    onSuccess: () => login.reset()
  })
  return { login, cancel }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads all of it
export function useApiKey(recheck: () => void) {
  const saved = useQuery({ queryKey: ['api-key'], queryFn: () => studio.agent.hasApiKey() })
  const [key, setKey] = useState('')
  const save = useMutation({
    mutationFn: (k: string) => studio.agent.setApiKey(k),
    onSuccess: () => {
      setKey('')
      void queryClient.invalidateQueries({ queryKey: ['api-key'] })
      recheck()
    }
  })
  return { saved, key, setKey, save }
}
