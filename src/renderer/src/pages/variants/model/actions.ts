// What the Variants screen does: the agent models, starting a round, and each lane's send, stop and permit.
import { useState } from 'react'
import { toast } from 'sonner'
import type { AgentMode, Provider, Ref } from '@shared/api'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { studio } from '@/shared/api/studio'
import { requestAgentPrefs, useAgentPrefs } from '@/features/agent-chat/model/agent'
import { addError, addUser, begin } from '@/features/agent-chat/model/variants'
import { refsText } from '@/entities/ref/model/refs'
import { lanePrompt, type LETTERS } from './lanes'

type Round = {
  brief: string
  part: string
  count: number
  letters: (typeof LETTERS)[number][]
  dirs: string[]
  attached: Ref[]
  fork: boolean
  forkable: string | null
  provider: Provider
  mode: AgentMode
}

/** Starts a round: closes the old lanes, then one agent session per letter. */
export function useStartVariants(
  build: string,
  onStarted: () => void
): {
  starting: boolean
  start: (o: Round) => Promise<void>
} {
  const [starting, setStarting] = useState(false)
  const start = async ({
    brief,
    part,
    count,
    letters,
    dirs,
    attached,
    fork,
    forkable,
    provider,
    mode
  }: Round): Promise<void> => {
    const text = attached.length ? `${brief.trim()}\n\n${refsText(build, attached)}` : brief.trim()
    const prompts = Object.fromEntries(
      letters.map((l, i) => [l, lanePrompt(l, count, build, part, text, dirs[i])])
    )
    const tries = Object.fromEntries(letters.map((l, i) => [l, dirs[i].trim()]))
    setStarting(true)
    let began = false
    try {
      const { model, effort } = await requestAgentPrefs(provider)
      await studio.variants.close()
      if (useAgentPrefs.getState().provider !== provider)
        throw new Error('The provider changed. Start variants again.')
      begin(build, prompts, { part, brief: brief.trim(), forked: fork && !!forkable, tries })
      began = true
      onStarted()
      await studio.variants.start({
        build,
        lanes: letters.map((lane) => ({ lane, text: prompts[lane] })),
        from: fork ? forkable : null,
        model,
        effort,
        mode
      })
    } catch (e) {
      if (began) for (const l of letters) addError(l, e)
      else toast.error('Couldn’t start variants. ' + errorMessage(e))
    } finally {
      setStarting(false)
    }
  }
  return { starting, start }
}

export const sendToLane = (lane: string, t: string): void => {
  addUser(lane, t)
  studio.variants.send(lane, t).catch((e) => addError(lane, e))
}

export const stopLane = (lane: string): void => void studio.variants.interrupt(lane)

export const permitLane = (lane: string, p: Parameters<typeof studio.variants.permit>[1]): void =>
  void studio.variants.permit(lane, p).catch((e) => toast.error(String(e)))
