import { shell } from 'electron'
import { existsSync } from 'fs'
import { isAbsolute, join, relative, resolve } from 'path'
import { z } from 'zod'
import { ReviewRoundSchema } from '@shared/api'
import { buildDir } from '../workspace/projects'
import { readFile } from 'fs/promises'
import { listRounds, saveRound, writeDesign } from '../workspace/review'
import { projectSettings, resolved } from '../app/settings'
import { DEFAULT_MINECRAFT_VERSION } from '@shared/minecraft'
import { appendResults, commitBuild, finalizeStaged, validateExportDir } from '../workspace/ship'
import { under } from '../workspace/paths'
import { installedGit } from '../runtime/runtime'
import type { IpcContext } from '../index'
import type { Handle } from './guard'

/** Review rounds, the design log and export. */
export function registerReview(ctx: IpcContext, handle: Handle): void {
  const { jobs, reviews, idle } = ctx
  const exportedPaths = new Set<string>()
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
  handle('design:reveal', z.string(), (build) => {
    const dir = buildDir(resolved().workspace, build)
    const file = join(dir, 'DESIGN.md')
    if (existsSync(file)) shell.showItemInFolder(file)
    else void shell.openPath(dir)
  })
  handle(
    'ship:finalize',
    z.object({ job: z.number().int(), targetDir: z.string().min(1).optional() }),
    async ({ job, targetDir }) => {
      const j = jobs.list().find((j) => j.id === job)
      const copied = j?.events.find((e) => e.event === 'copied')
      if (!j?.staging || j.state !== 'done' || copied?.event !== 'copied')
        throw new Error(`job ${job} is not a finished ship build`)
      if (
        (j.minecraftVersion ?? DEFAULT_MINECRAFT_VERSION) !==
        projectSettings(j.spec.build).minecraftVersion
      )
        throw new Error('Build again for the project’s current Minecraft version before exporting')
      const target = await validateExportDir(targetDir || resolved().schematics)
      const staged = isAbsolute(copied.path) ? copied.path : join(resolved().workspace, copied.path)
      const dest = finalizeStaged(staged, j.staging, target)
      exportedPaths.add(resolve(dest))
      if (exportedPaths.size > 50) exportedPaths.delete(exportedPaths.values().next().value!)
      return dest
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
  handle('ship:commit', z.object({ build: z.string(), message: z.string().min(1) }), (a) => {
    idle(a.build)
    return commitBuild(
      resolved().workspace,
      a.build,
      a.message,
      installedGit(resolved().git) || 'git'
    )
  })
  handle('ship:reveal', z.string().min(1), (path) => {
    if (!isAbsolute(path)) throw new Error('Reveal path must be absolute')
    const full = resolve(path)
    const schematics = resolved().schematics
    const inSchematics = !!schematics && !!under(schematics, relative(resolve(schematics), full))
    if (!exportedPaths.has(full) && !inSchematics)
      throw new Error('Only exported schematic files can be revealed')
    if (!existsSync(full)) throw new Error(`File not found: ${path}`)
    shell.showItemInFolder(full)
  })
}
