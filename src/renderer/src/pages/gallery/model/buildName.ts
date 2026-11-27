import { PROJECT_NAME_MAX_LENGTH } from '@shared/constants'
import { normalizeProjectName, projectNameIssue } from '@shared/project-name'

/** A free project name from a schematic file name ("My House (2).litematic" → "My House (2)"), or ''. */
export function nameFromFile(file: string, taken: string[]): string {
  const clean = file
    .replace(/\.[^.]*$/, '')
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PROJECT_NAME_MAX_LENGTH)
    .trim()
  const takenSet = new Set(taken.map(normalizeProjectName))
  return !projectNameIssue(clean) && !takenSet.has(normalizeProjectName(clean)) ? clean : ''
}
