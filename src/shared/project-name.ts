import { z } from 'zod'

export const PROJECT_NAME_MAX_LENGTH = 100

/** User-facing project display name: spaces, numbers, Unicode and any printable symbols up to 100 chars. */
export const ProjectNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a project name')
  .max(PROJECT_NAME_MAX_LENGTH, `Use at most ${PROJECT_NAME_MAX_LENGTH} characters`)
  .refine(
    (s) => !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(s),
    'Project name cannot contain control characters or line breaks'
  )

const RESERVED_WINDOWS = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i

/** On-disk folder name under builds/ passed to the Python engine (tools.new_build). */
export const BuildFolderNameSchema = z
  .string()
  .max(PROJECT_NAME_MAX_LENGTH)
  .regex(
    /^[a-z][a-z0-9_]*$/,
    'Use lowercase letters, digits and underscores, starting with a letter'
  )
  .refine((s) => !RESERVED_WINDOWS.test(s), 'Reserved Windows name')

export const ProjectMetaSchema = z.object({
  name: ProjectNameSchema
})
export type ProjectMeta = z.infer<typeof ProjectMetaSchema>

const MAX_SLUG_BASE = 80

/** Normalizes a display name for case-insensitive duplicate checks. */
export const normalizeProjectName = (name: string): string => name.trim().toLocaleLowerCase()

/** Derives a unique, filesystem- and engine-safe folder slug from any project display name. */
export function slugFromProjectName(
  displayName: string,
  takenFolders: Iterable<string> = []
): string {
  const taken = new Set<string>()
  for (const folder of takenFolders) {
    if (!folder.includes('/')) taken.add(folder.toLowerCase())
  }
  const raw = displayName
    .trim()
    .normalize('NFD')
    .replace(/\p{Mn}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  let base = /^[a-z]/.test(raw) ? raw : raw ? `build_${raw}` : 'build'
  if (base.length > MAX_SLUG_BASE)
    base = base.slice(0, MAX_SLUG_BASE).replace(/_+$/g, '') || 'build'
  if (RESERVED_WINDOWS.test(base)) base = `build_${base}`
  let candidate = base
  let suffix = 2
  while (taken.has(candidate)) {
    candidate = `${base}_${suffix++}`
  }
  return BuildFolderNameSchema.parse(candidate)
}
