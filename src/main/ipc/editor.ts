import { z } from 'zod'
import { EditsFileSchema } from '@shared/api'
import { resolved } from '../app/settings'
import { blocksOf, catalogPath, readCatalog } from '../runtime/blocks'
import { readEdits, saveEdits } from '../workspace/edits'
import type { IpcContext } from '../index'
import type { Handle } from './guard'

/** The block editor: the blocks of a version and a build's hand edits. */
export function registerEditor(_ctx: IpcContext, handle: Handle): void {
  // the parsed catalog of every version is ~19 MB of heap: keep only the blocks of the version last asked for
  let last: { key: string; blocks: ReturnType<typeof blocksOf> } | null = null
  handle('blocks:list', z.string(), (version) => {
    const path = catalogPath(resolved().python)
    if (!path) return null
    if (last?.key !== `${path}|${version}`)
      last = { key: `${path}|${version}`, blocks: blocksOf(readCatalog(path), version) }
    return last.blocks
  })
  handle('edits:read', z.string(), (build) => readEdits(resolved().workspace, build))
  handle('edits:save', z.object({ build: z.string(), edits: EditsFileSchema }), (a) =>
    saveEdits(resolved().workspace, a.build, a.edits)
  )
}
