// Diagnostics: the checks run again on demand, and the plain-text report to copy when asking for help.
import { useMutation, useQuery } from '@tanstack/react-query'
import type { Availability, Feature, Requirement } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'

/** Plain text to paste when asking for help. */
async function report(a: Availability): Promise<string> {
  const { version } = await studio.updater.get()
  return [
    `Builder Studio ${version}, checked ${new Date(a.checkedAt).toISOString()}`,
    '',
    'Requirements:',
    ...(Object.keys(a.requirements) as Requirement[]).map(
      (name) =>
        `  ${a.requirements[name].ok ? 'ok     ' : 'missing'} ${name}: ${a.requirements[name].detail}`
    ),
    '',
    'Features:',
    ...(Object.keys(a.features) as Feature[]).map(
      (name) =>
        `  ${a.features[name].ok ? 'ok     ' : 'off    '} ${name}${a.features[name].missing.length ? ` (needs ${a.features[name].missing.join(', ')})` : ''}`
    )
  ].join('\n')
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads all of it
export function useDiagnostics() {
  const checks = useQuery({
    queryKey: ['availability'],
    queryFn: () => studio.availability.get(),
    retry: false
  })
  const recheck = useMutation({
    mutationFn: async () => {
      await queryClient.cancelQueries({ queryKey: ['availability'] })
      return studio.availability.get(true)
    },
    onSuccess: (value) => queryClient.setQueryData(['availability'], value)
  })
  const copy = useMutation({
    mutationFn: async () => navigator.clipboard.writeText(await report(checks.data!)),
    onSuccess: () => setTimeout(() => copy.reset(), 2000)
  })
  return { checks, recheck, copy }
}
