import { isAbsolute, join } from 'path'
import { z } from 'zod'
import { ReviewRoundSchema } from '@shared/api'
import { buildDir } from '../workspace/projects'
import { readFile } from 'fs/promises'
import { listRounds, saveRound, writeDesign } from '../workspace/review'
import { projectSettings, resolved } from '../app/settings'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { appendResults, commitBuild, finalizeStaged } from '../workspace/ship'
import { installedGit } from '../runtime/runtime'
import type { IpcContext } from '../index'
import type { Handle } from './guard'

/** Review rounds, the design log and export. */
export function registerReview(ctx: IpcContext, handle: Handle): void {
  const { jobs, reviews, idle } = ctx
  const none = z.undefined()
  handle('review:list', z.string(), (build) => listRounds(resolved().workspace, build))
  handle(
    'review:save',
    z.object({ round: ReviewRoundSchema, requestId: z.string().nullable() }),
    async ({ round, requestId }) => {
      const saved = await saveRound(resolved().workspace, round)
      if (requestId) reviews.answer(requestId, saved)
      return saved
    }
  )
  handle('review:cancel', z.string(), (id) => reviews.answer(id, null))
  handle('review:pending', none, () => reviews.list())
  handle('design:read', z.string(), (build) =>
    readFile(join(buildDir(resolved().workspace, build), 'DESIGN.md'), 'utf8').catch(() => '')
  )
  handle('design:write', z.object({ build: z.string(), base: z.string(), md: z.string() }), (a) =>
    writeDesign(resolved().workspace, a.build, a.base, a.md)
  )
  handle(
    'ship:finalize',
    z.object({ job: z.number().int(), dry: z.boolean() }),
    async ({ job, dry }) => {
      const j = jobs.list().find((j) => j.id === job)
      const copied = j?.events.find((e) => e.event === 'copied')
      if (!j?.staging || j.state !== 'done' || copied?.event !== 'copied')
        throw new Error(`job ${job} is not a finished ship build`)
      if (
        (j.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION) !==
        projectSettings(j.spec.build).minecraftVersion
      )
        throw new Error('Build again for the project’s current Minecraft version before exporting')
      const target = dry ? join(resolved().cache, 'ship', 'dry-final') : resolved().schematics
      if (!target) throw new Error('no schematics folder: set one in Settings')
      const staged = isAbsolute(copied.path) ? copied.path : join(resolved().workspace, copied.path)
      return finalizeStaged(staged, j.staging, target)
    }
  )
  handle(
    'ship:results',
    z.object({
      build: z.string(),
      title: z.string().min(1),
      rows: z.array(z.tuple([z.string(), z.string()]))
    }),
    (a) => appendResults(resolved().workspace, a.build, a.title, a.rows)
  )
  handle(
    'ship:commit',
    z.object({ build: z.string(), message: z.string().min(1), dry: z.boolean() }),
    (a) => {
      idle(a.build)
      return commitBuild(
        resolved().workspace,
        a.build,
        a.message,
        a.dry,
        installedGit(resolved().git) || 'git'
      )
    }
  )
}
