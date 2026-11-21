import { create } from 'zustand'
import type { BridgeMethod, BridgeMethods, BridgeProgress } from '@shared/api'
import { studio } from '@/shared/api/studio'

export const usePartsProgress = create(() => ({ entries: {} as Record<string, BridgeProgress> }))

export function setPartsProgress(key: string, progress: BridgeProgress | null): void {
  usePartsProgress.setState(({ entries }) => {
    const next = { ...entries }
    if (progress) next[key] = progress
    else delete next[key]
    return { entries: next }
  })
}

export async function partsCall<M extends BridgeMethod>(
  key: string,
  method: M,
  params: BridgeMethods[M]['params'],
  minecraftVersion?: string
): Promise<BridgeMethods[M]['result']> {
  setPartsProgress(key, { stage: 'waiting', fraction: null })
  try {
    return await studio.bridge.call(
      method,
      params,
      (p) => setPartsProgress(key, p),
      minecraftVersion
    )
  } finally {
    setPartsProgress(key, null)
  }
}
