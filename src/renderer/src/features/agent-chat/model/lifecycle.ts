// The round lifecycle's state and steps: DESIGN.md's last round, saving a brief and starting its session, and
// approving a round (the agent's Status turn, then the commit of builds/<build>).
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Ref } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { refsText } from '@/entities/ref/model/refs'
import { newThread, send, useAgent, watchTurn } from './agent'
import { getBrief, lastRound, setBrief } from './brief'

export const today = (): string => new Date().toISOString().slice(0, 10)

const approvePrompt = (build: string, n: number): string =>
  `I approve round ${n} of ${build}. Update only the \`## Status\` block of builds/${build}/DESIGN.md to say round ${n} ` +
  `is approved and what comes next, as docs/agent-workflow.md describes. Do not edit any other file, do not commit ` +
  `and do not push: Builder Studio commits builds/${build} after I check it.`

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the row reads all of it
export function useRound(build: string) {
  const design = useQuery({ queryKey: ['design', build], queryFn: () => studio.design.read(build) })
  const [brief, setBriefOpen] = useState<{ base: string; text: string } | null>(null)
  const [refs, setRefs] = useState<Ref[]>([])
  const [phase, setPhase] = useState<'idle' | 'status' | 'commit'>('idle')
  const [commit, setCommit] = useState<{ n: number; message: string; diff: string } | null>(null)
  const n = design.data !== undefined ? lastRound(design.data) : null
  const stopTurn = useRef<(() => void) | null>(null)
  useEffect(() => () => stopTurn.current?.(), [])

  const openBrief = async (): Promise<void> => {
    const base = await studio.design.read(build)
    setBriefOpen({ base, text: getBrief(base) })
    setRefs([])
  }
  const saveBrief = async (): Promise<void> => {
    if (!brief?.text.trim()) return
    try {
      await studio.design.write(build, brief.base, setBrief(brief.base, build, brief.text, today()))
      void queryClient.invalidateQueries({ queryKey: ['design', build] })
      setBriefOpen(null)
      newThread(build)
      await send(
        `New brief for ${build}, now in builds/${build}/DESIGN.md §1:\n\n${brief.text.trim()}\n\n` +
          `Read DESIGN.md and start the round as docs/agent-workflow.md describes.` +
          (refs.length ? `\n\n${refsText(build, refs)}` : ''),
        { title: `${build} · brief ${today()}` }
      )
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  const approve = async (): Promise<void> => {
    try {
      const round = lastRound(await studio.design.read(build))
      const { active, threads } = useAgent.getState()
      if (!threads[active]) throw new Error('Open an agent session before approving a round.')
      stopTurn.current?.()
      // Approve, step 2: once the agent's Status turn ends, show what a commit of builds/<build> would take
      stopTurn.current = watchTurn(active, (state) => {
        stopTurn.current?.()
        stopTurn.current = null
        if (!state || state.status === 'off' || state.error) {
          setPhase('idle')
          return void toast.error('The agent stopped before updating Status.')
        }
        setPhase('commit')
        void studio.ship
          .commit(build, 'x', true)
          .then((diff) =>
            setCommit({ n: round, message: `${build}: round ${round} approved`, diff })
          )
          .catch((e) => (toast.error(errorMessage(e)), setPhase('idle')))
      })
      setPhase('status')
      await send(approvePrompt(build, round))
    } catch (e) {
      stopTurn.current?.()
      stopTurn.current = null
      setPhase('idle')
      toast.error(errorMessage(e))
    }
  }
  const cancelCommit = (): void => (setCommit(null), setPhase('idle'))
  const doCommit = async (): Promise<void> => {
    if (!commit) return
    try {
      const out = await studio.ship.commit(build, commit.message, false)
      toast.success('Committed', { description: out.split('\n')[0] })
      setCommit(null)
      setPhase('idle')
      newThread(build, `${build} · round ${commit.n + 1}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return {
    n,
    brief,
    setBriefOpen,
    refs,
    setRefs,
    phase,
    commit,
    setCommit,
    openBrief,
    saveBrief,
    approve,
    cancelCommit,
    doCommit
  }
}
