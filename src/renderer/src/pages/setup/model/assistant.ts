// The AI assistant step's provider checks and ChatGPT sign-in.
import { useMutation, useQuery } from '@tanstack/react-query'
import { studio } from '@/shared/api/studio'

export const cancelLogin = (): void => void studio.agent.cancelLogin()

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads all of it
export function useProviderChecks(save: () => Promise<void>) {
  // the checks read saved settings, so the actions below save the draft first
  const checks = useQuery({ queryKey: ['provider-checks'], queryFn: () => studio.agent.diagnose() })
  const login = useMutation({
    mutationFn: async () => {
      await save()
      await studio.agent.login()
    },
    onSettled: () => void checks.refetch()
  })
  return { checks, login }
}
