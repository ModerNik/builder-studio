// Zod-free so the renderer can check names without loading zod at boot; the schemas in api.ts reuse these rules.
import { PROJECT_NAME_MAX_LENGTH } from './constants'

export { PROJECT_NAME_MAX_LENGTH }

/**
 * Why a user-facing project display name (already trimmed) is invalid, or '' when it is fine:
 * spaces, numbers, Unicode and any printable symbols up to 100 chars.
 */
export function projectNameIssue(name: string): string {
  if (!name) return 'Enter a project name'
  if (name.length > PROJECT_NAME_MAX_LENGTH)
    return `Use at most ${PROJECT_NAME_MAX_LENGTH} characters`
  if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(name))
    return 'Project name cannot contain control characters or line breaks'
  return ''
}

const RESERVED_WINDOWS = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i

/** Why an on-disk folder name under builds/ (passed to the Python engine) is invalid, or ''. */
export function buildFolderIssue(folder: string): string {
  if (folder.length > PROJECT_NAME_MAX_LENGTH)
    return `Use at most ${PROJECT_NAME_MAX_LENGTH} characters`
  if (!/^[a-z][a-z0-9_]*$/.test(folder))
    return 'Use lowercase letters, digits and underscores, starting with a letter'
  if (RESERVED_WINDOWS.test(folder)) return 'Reserved Windows name'
  return ''
}

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
  const issue = buildFolderIssue(candidate)
  if (issue) throw new Error(`${candidate}: ${issue}`)
  return candidate
}
