// Build site placement metadata (builds/<name>/data/site.json) and safe build.py ORIGIN updates.
import { existsSync } from 'fs'
import { mkdir, readFile } from 'fs/promises'
import { dirname } from 'path'
import { SitePlacementSchema, type SitePlacement } from '@shared/api'
import { toolPath } from '../workspace/paths'
import { writeAtomic } from '../workspace/review'

const SITE_META_REL = (build: string): string => `builds/${build}/data/site.json`
const BUILD_PY_REL = (build: string): string => `builds/${build}/build.py`

export async function readSiteMeta(
  workspace: string,
  build: string
): Promise<SitePlacement | null> {
  const file = toolPath(workspace, SITE_META_REL(build))
  if (!existsSync(file)) return null
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    const result = SitePlacementSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export async function saveSiteMeta(
  workspace: string,
  build: string,
  placement: SitePlacement
): Promise<void> {
  const file = toolPath(workspace, SITE_META_REL(build))
  await mkdir(dirname(file), { recursive: true })
  writeAtomic(file, JSON.stringify(placement, null, 2) + '\n')
}

// Matches a top-level ORIGIN = (x, y, z) assignment while preserving any trailing inline comment.
const ORIGIN_LINE_RE = /^([ \t]*ORIGIN[ \t]*=[ \t]*)\([^)\r\n]*\)([ \t]*(?:#[^\r\n]*)?)$/m

/** Update the top-level ORIGIN = (x, y, z) line in builds/<build>/build.py if present. */
export async function updateBuildOrigin(
  workspace: string,
  build: string,
  origin: [number, number, number]
): Promise<boolean> {
  const file = toolPath(workspace, BUILD_PY_REL(build))
  if (!existsSync(file)) return false
  const source = await readFile(file, 'utf8')
  if (!ORIGIN_LINE_RE.test(source)) return false
  const next = source.replace(ORIGIN_LINE_RE, `$1(${origin[0]}, ${origin[1]}, ${origin[2]})$2`)
  if (next === source) return true
  writeAtomic(file, next)
  return true
}
