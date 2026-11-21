import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { Detected } from '@shared/api'
import { studio } from '@/shared/api/studio'

/** What each empty settings path field resolves to on this machine (null = not found). */
export const useDetected = (): UseQueryResult<Detected> =>
  useQuery({ queryKey: ['detected'], queryFn: () => studio.settings.detected() })

/** Minecraft versions installed in the launcher, with their jar paths. */
export const useInstallations = (
  enabled = true
): UseQueryResult<{ version: string; jar: string }[]> =>
  useQuery({
    queryKey: ['minecraft-installations'],
    queryFn: () => studio.minecraft.installations(),
    enabled
  })
