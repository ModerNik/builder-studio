// The Review screen's drafts, in their own module so a hot reload of the screen keeps them.
import { create } from 'zustand'
import type { ReviewPin, ReviewRequest } from '@shared/api'

export type Xyz = [number, number, number]
export interface Draft {
  requestId: string | null
  question: string
  files: string[] // repo-relative .litematic paths
  parts: string[]
  pick: string | null
  approved: string[]
  notes: string
  pins: ReviewPin[]
  paste: Record<string, Xyz | null> // edits over what the jobs and old rounds say
}

export const blank = (files: string[] = []): Draft => ({
  requestId: null,
  question: '',
  files,
  parts: [],
  pick: null,
  approved: [],
  notes: '',
  pins: [],
  paste: {}
})

/** One draft per build, kept while the app runs; an agent request replaces it. */
export const useReview = create<{
  drafts: Record<string, Draft>
  set(build: string, d: Partial<Draft>): void
  open(r: ReviewRequest): void
}>((set) => ({
  drafts: {},
  set: (build, d) =>
    set((s) => ({ drafts: { ...s.drafts, [build]: { ...(s.drafts[build] ?? blank()), ...d } } })),
  open: (r) =>
    set((s) => ({
      drafts: {
        ...s.drafts,
        [r.build]: { ...blank(r.variants), requestId: r.id, question: r.question, parts: r.parts }
      }
    }))
}))

export const stem = (path: string): string =>
  path
    .split('/')
    .pop()!
    .replace(/\.litematic$/, '')
