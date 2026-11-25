// The app-wide listeners: review requests, show / show_sheet, the MCP status report, update and job toasts.
import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { BuildSummary, ReviewRequest } from '@shared/api'
import { queryClient, studio } from '@/shared/api/studio'
import { useShow } from '@/entities/build/model/builds'
import { PART_LABEL, useJobs } from '@/entities/job/model/jobs'
import { useReview } from '@/entities/review/model/review'

const buildLabel = (id: string): string =>
  queryClient.getQueryData<BuildSummary[]>(['builds'])?.find((b) => b.name === id)?.displayName ||
  id

/** Mounted once by the Shell: `pathname` is the current route, `current` the open build's name. */
export function useAppSubscriptions(pathname: string, current: string | null): void {
  const navigate = useNavigate()

  // the agent asked for a review (MCP request_review): open it, also for requests made before a reload
  useEffect(() => {
    const show = (r: ReviewRequest): void => {
      useReview.getState().open(r)
      void navigate({ to: '/build/$name/review', params: { name: r.build } })
      toast(`The agent asks for a review of ${buildLabel(r.build)}`, { description: r.question })
    }
    void studio.review.pending().then((rs) => rs.forEach(show))
    const stopRequest = studio.review.onRequest(show)
    const stopClosed = studio.review.onClosed((id) => {
      for (const [build, draft] of Object.entries(useReview.getState().drafts))
        if (draft.requestId === id) useReview.getState().set(build, { requestId: null })
    })
    return () => {
      stopRequest()
      stopClosed()
    }
  }, [navigate])

  // the agent asked to show a file (MCP show) or a sheet (show_sheet): the workspace picks it up from useShow
  useEffect(() => {
    const offShow = studio.app.onShow(({ path, build }) => {
      useShow.setState({ path, sheet: null, t: Date.now() })
      void navigate({ to: '/build/$name', params: { name: build } })
    })
    const offSheet = studio.app.onSheet(({ path, build }) => {
      useShow.setState({ path: null, sheet: path, t: Date.now() })
      void navigate({ to: '/build/$name', params: { name: build } })
    })
    return () => {
      offShow()
      offSheet()
    }
  }, [navigate])

  // MCP status(): the workspace and review screens report their own state, every other screen just its route
  useEffect(() => {
    if (!/^\/build\/[^/]+(\/review)?$/.test(pathname))
      studio.app.report({
        build: current,
        version: null,
        tab: pathname,
        pick: null,
        parts: [],
        review: null
      })
  }, [pathname, current])

  // a new version finished downloading in the background (main/updater.ts)
  useEffect(
    () =>
      studio.updater.onState((s) => {
        if (s.s === 'ready')
          toast(`Builder Studio ${s.version} is ready`, {
            id: 'update',
            duration: Infinity,
            action: { label: 'Restart to update', onClick: () => void studio.updater.install() }
          })
      }),
    []
  )

  // toast job ends
  useEffect(
    () =>
      studio.jobs.onUpdate((u) => {
        if (u.kind !== 'end') return
        const job = useJobs.getState().jobs.find((j) => j.id === u.id)
        const what = job
          ? `${PART_LABEL[job.spec.part]}: ${buildLabel(job.spec.build)}`
          : 'Build activity'
        if (u.state === 'done') toast.success(`${what} complete`)
        else if (u.state === 'failed')
          toast.error(`${what} failed`, {
            description: 'Open activity details in the build to see what happened.'
          })
      }),
    []
  )
}
