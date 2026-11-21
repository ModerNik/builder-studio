import { join } from 'path'
import { z } from 'zod'
import { RefAddSchema } from '@shared/api'
import { buildDir } from '../workspace/projects'
import { resolved } from '../app/settings'
import { addRef, listRefs, removeRef, setRefNote } from '../workspace/refs'
import type { IpcContext } from '../index'
import type { Handle } from './guard'

/** The reference board. */
export function registerRefs(ctx: IpcContext, handle: Handle): void {
  const { trash } = ctx
  const refsDir = (build: string): string => join(buildDir(resolved().workspace, build), 'refs')
  handle('refs:list', z.string(), (build) => listRefs(refsDir(build)))
  handle('refs:add', z.object({ build: z.string(), ref: RefAddSchema }), (a) =>
    addRef(refsDir(a.build), a.ref)
  )
  handle('refs:note', z.object({ build: z.string(), id: z.string(), note: z.string() }), (a) =>
    setRefNote(refsDir(a.build), a.id, a.note)
  )
  handle('refs:remove', z.object({ build: z.string(), id: z.string() }), (a) =>
    removeRef(refsDir(a.build), a.id, trash)
  )
}
