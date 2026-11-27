// The Workspace's labels and pure helpers. The bridge data and parts overlays are in lib/analysis.ts;
// UI lives in app/workspace/*.
import {
  DEFAULT_LINT_RULES,
  type Job,
  type LintRule,
  type LintRuleToggles,
  type LintWhere,
  type PartInfo
} from '@shared/api'
import type { Cell } from '@/entities/viewer/ui/BuildViewer'
import type { ViewName } from '@/entities/viewer/model/look'
import { isLintRuleEnabled, short } from '@/shared/lib/format'
export { errorMessage as errorText } from '@/shared/ui/feedback/errors'

/** Files over this size are checked and counted only when asked: the bridge reads the whole array. */
export const AUTO_LINT_BYTES = 512 * 1024

export type BuildVersion = {
  path: string
  mtime: number
  size: number
  sheet?: string
  parts?: boolean
  minecraftVersion?: string
  origin?: [number, number, number] // where the file's (0, 0, 0) sits in build coordinates
}

export const versionName = (path: string): string =>
  path
    .split('/')
    .pop()!
    .replace(/\.litematica?$/i, '')

export const partLabel = (name: string): string => (name === '-' ? 'Untagged' : name)

/** The build code that opened a part: `file:line in fn()`. */
export const partSources = (p: PartInfo): string[] =>
  p.sources.map(([f, l, fn]) => `${f}:${l} in ${fn}()`)

/** A part's centre cell, for Locate. */
export const partCentre = (p: PartInfo): Cell =>
  p.box[0].map((lo, i) => Math.round((lo + p.box[1][i]) / 2)) as Cell

/** The preview sheet of a version: the one it recorded, else the renderer's default next to the file. */
export const sheetOf = (version: BuildVersion): string =>
  version.sheet ?? `${version.path.replace(/\.litematic$/, '')}_3d/sheet.png`

export const CAMERA_LABELS: Partial<Record<ViewName, string>> = {
  iso_se: 'Southeast',
  iso_ne: 'Northeast',
  iso_nw: 'Northwest',
  iso_sw: 'Southwest',
  top: 'Top',
  elev_s: 'Front (south)',
  elev_e: 'Right (east)',
  elev_n: 'Back (north)',
  elev_w: 'Left (west)',
  orbit: 'Free orbit',
  bottom: 'Bottom'
}

export const CHECK_LABELS: Record<string, string> = {
  floating: 'Floating blocks',
  unattached: 'Missing support',
  gravity: 'Blocks that will fall',
  halves: 'Incomplete doors or beds',
  fire: 'Fire risk',
  leaves: 'Leaves that may decay',
  invalid: 'Invalid block states',
  dark: 'Dark areas',
  see_through: 'See-through gaps',
  groove: 'Slab gaps',
  palette: 'Block types'
}
export const checkLabel = (key: string): string => CHECK_LABELS[key] ?? key.replaceAll('_', ' ')

/** Check markers in the 3D view and the dot beside each check: categorical and semantic tokens. */
export const CHECK_COLORS: Record<string, string> = {
  floating: '--cat-8',
  unattached: '--cat-2',
  gravity: '--cat-4',
  halves: '--cat-7',
  fire: '--danger-solid',
  leaves: '--cat-6',
  invalid: '--cat-5',
  dark: '--cat-1',
  see_through: '--cat-3',
  groove: '--warning-solid'
}

export const CHECK_DESCRIPTIONS: Record<LintRule, string> = {
  floating: 'Gravity-affected blocks not supported from below by a non-gravity block or anchor.',
  unattached:
    'Torches, lanterns, signs, carpets, rails and other blocks with nothing to attach to.',
  gravity: 'Sand, gravel, concrete powder and other gravity blocks over air.',
  halves: 'Door or bed halves missing their matching half.',
  fire: 'Flammable blocks near lava or fire.',
  leaves: 'Non-persistent leaves that can decay in game.',
  invalid: 'Blocks or block-state properties unavailable in the target Minecraft version.',
  dark: 'Covered spawnable cells at block light 0. Turning this off also speeds up checks.',
  see_through: 'Stair or slab notches that leave an open gap through a wall.',
  groove: 'Half-block grooves where a slab or stair meets a full block.'
}

export const JOB_LABELS: Record<Job['spec']['part'], string> = {
  proto: 'Draft generation',
  check: 'Build check',
  full: 'Full build',
  dump: 'Layer export'
}

/** The material list grouped by block id, biggest first, each with its block states. */
export function groupMaterials(
  states: [string, number][]
): [string, { n: number; states: [string, number][] }][] {
  const grouped = new Map<string, { n: number; states: [string, number][] }>()
  for (const [state, n] of states) {
    const [id, properties = ''] = short(state).split('[')
    const block = grouped.get(id) ?? { n: 0, states: [] }
    block.n += n
    if (properties) block.states.push([properties.replace(/]$/, '').replaceAll(',', ', '), n])
    grouped.set(id, block)
  }
  return [...grouped].sort((a, b) => b[1].n - a[1].n)
}

/**
 * The checks to locate: generation checks run before hidden blocks are removed, so a check is placed in
 * 3D only where the saved file found the same count as the job did.
 */
export function locatableChecks(
  where: Record<string, LintWhere>,
  counts: Record<string, number>,
  jobCounts?: Record<string, number>,
  rules: Partial<LintRuleToggles> = DEFAULT_LINT_RULES
): [string, LintWhere][] {
  return Object.entries(where).filter(
    ([k]) =>
      isLintRuleEnabled(k, rules) &&
      (!jobCounts || (jobCounts[k] > 0 && counts[k] === jobCounts[k]))
  )
}

/** Checks the job counted that the saved file counts differently. */
export const shiftedChecks = (
  counts: Record<string, number>,
  jobCounts?: Record<string, number>,
  rules: Partial<LintRuleToggles> = DEFAULT_LINT_RULES
): string[] =>
  Object.entries(jobCounts ?? {})
    .filter(([k, n]) => isLintRuleEnabled(k, rules) && n > 0 && counts[k] !== n)
    .map(([k]) => k)
