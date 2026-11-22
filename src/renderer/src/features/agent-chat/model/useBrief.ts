// The Brief dialog's state: DESIGN.md §1 to edit, and saving it, then starting a new thread with it.
import { useState } from 'react'
import { toast } from 'sonner'
import type { Ref } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { refsText } from '@/entities/ref/model/refs'
import { newThread, send } from './agent'
import { getBrief, setBrief } from './brief'

export const today = (): string => new Date().toISOString().slice(0, 10)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the dialog reads all of it
export function useBrief(build: string) {
  const [brief, setBriefOpen] = useState<{ base: string; text: string } | null>(null)
  const [refs, setRefs] = useState<Ref[]>([])

  const openBrief = async (): Promise<void> => {
    try {
      const base = await studio.design.read(build)
      setBriefOpen({ base, text: getBrief(base) })
      setRefs([])
    } catch (e) {
      toast.error(errorMessage(e))
    }
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
          `Read builds/${build}/DESIGN.md and start on this brief.` +
          (refs.length ? `\n\n${refsText(build, refs)}` : ''),
        { title: `${build} · brief ${today()}` }
      )
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return { brief, setBriefOpen, refs, setRefs, openBrief, saveBrief }
}
