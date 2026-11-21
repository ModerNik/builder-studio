// Settings › Minecraft: refreshing availability after a target change.
import { queryClient } from '@/shared/api/studio'

export const refreshAvailability = (): void =>
  void queryClient.invalidateQueries({ queryKey: ['availability'] })
