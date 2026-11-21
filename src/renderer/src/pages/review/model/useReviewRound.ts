// The Review screen's round: the draft, the versions under review, paste positions, and saving or declining it.
// ui/Review.tsx renders what this returns.
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { BuildSummary, ReviewPin, ReviewRound } from '@shared/api'
import { errorMessage } from '@/shared/ui/feedback/errors'
import { queryClient, studio } from '@/shared/api/studio'
import { useBuild } from '@/entities/build/model/builds'
import { useJobs } from '@/entities/job/model/jobs'
import { blank, stem, useReview, type Draft, type Xyz } from '@/entities/review/model/review'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads most of this state
export function useReviewRound(name: string) {
  const { data: build } = useBuild(name)
  const draft = useReview((s) => s.drafts[name])
  const set = useReview((s) => s.set)
  const jobs = useJobs((s) => s.jobs)
  const rounds = useQuery({ queryKey: ['rounds', name], queryFn: () => studio.review.list(name) })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ message: string | null; at: number }>({
    message: null,
    at: 0
  })

  useEffect(
    () =>
      studio.app.report({
        build: name,
        version: null,
        tab: 'review',
        pick: null,
        parts: [],
        review: { build: name, question: draft?.question ?? '' }
      }),
    [name, draft?.question]
  )

  // first visit: the two newest versions
  useEffect(() => {
    if (!draft && build) set(name, { files: build.versions.slice(0, 2).map((v) => v.path) })
  }, [draft, build, name, set])

  const d = draft ?? blank()
  const versions = useMemo(() => build?.versions ?? [], [build])
  const files = d.files
    .map((p) => versions.find((v) => v.path === p))
    .filter((v): v is BuildSummary['versions'][number] => !!v)
  const missing = d.files.filter((p) => !versions.some((v) => v.path === p)).map(stem)
  const nextRound = Math.max(0, ...(rounds.data ?? []).map((r) => r.round)) + 1
  const patch = (p: Partial<Draft>): void => set(name, p)

  // paste positions: the user's edits, else the newest job that wrote the file, else an older round
  const paste = (path: string): { xyz: Xyz | null; from: string } => {
    if (path in d.paste) return { xyz: d.paste[path], from: 'your edit' }
    for (const j of jobs) {
      const w = j.events.findLast((e) => e.event === 'wrote' && e.path === path)
      if (w && w.event === 'wrote' && w.paste) return { xyz: w.paste, from: 'the job' }
    }
    for (const r of [...(rounds.data ?? [])].reverse()) {
      const f = r.files.find((f) => f.path === path)
      if (f?.paste) return { xyz: f.paste, from: `round ${r.round}` }
    }
    return { xyz: null, from: 'unknown' }
  }
  // diff: each variant against the file the newest round with a pick chose
  const picked = [...(rounds.data ?? [])].reverse().find((r) => r.pick)
  const lastPick =
    picked &&
    versions.find((v) => v.path === picked.files.find((f) => f.name === picked.pick)?.path)

  const nextPin = Math.max(0, ...d.pins.map((p) => p.n)) + 1
  const addPin = (pin: ReviewPin): void => patch({ pins: [...d.pins, pin] })
  const togglePick = (s: string): void => patch({ pick: d.pick === s ? null : s })
  const toggleFile = (p: string): void =>
    patch({
      files: d.files.includes(p) ? d.files.filter((x) => x !== p) : [...d.files, p].slice(-4)
    })

  async function save(): Promise<void> {
    if (!files.length) return
    setSaving(true)
    const round: ReviewRound = {
      round: 1, // main numbers it
      build: name,
      date: new Date().toLocaleDateString('sv'), // YYYY-MM-DD, local
      question: d.question,
      files: files.map((v) => ({
        name: stem(v.path),
        path: v.path,
        paste: paste(v.path).xyz,
        sheet: v.sheet ?? null
      })),
      pick: d.pick && files.some((v) => stem(v.path) === d.pick) ? d.pick : null,
      approved: d.approved,
      notes: d.notes,
      pins: d.pins.filter((p) => files.some((v) => stem(v.path) === p.file))
    }
    try {
      const saved = await studio.review.save(round, d.requestId)
      const line = `feedback in the app: ${saved.path}`
      const n = saved.round.round
      const message = d.requestId ? `Round ${n} saved · Sent to the agent.` : `Round ${n} saved`
      setStatus((s) => ({ message, at: s.at + 1 }))
      toast.success(`Round ${n} saved`, {
        description: d.requestId ? 'Sent to the agent.' : saved.path,
        action: d.requestId
          ? undefined
          : { label: 'Copy line', onClick: () => void navigator.clipboard.writeText(line) },
        duration: 10000
      })
      set(name, blank(d.files))
      void queryClient.invalidateQueries({ queryKey: ['rounds', name] })
    } catch (e) {
      toast.error(`Couldn’t save the round: ${errorMessage(e)}`)
    } finally {
      setSaving(false)
    }
  }

  async function decline(): Promise<void> {
    if (!d.requestId) return
    await studio.review.cancel(d.requestId)
    patch({ requestId: null })
    toast('Request declined: the agent gets no round.')
  }

  return {
    build,
    set,
    rounds,
    saving,
    status,
    d,
    versions,
    files,
    missing,
    nextRound,
    patch,
    paste,
    picked,
    lastPick,
    nextPin,
    addPin,
    togglePick,
    toggleFile,
    save,
    decline
  }
}
