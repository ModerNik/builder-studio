import { NewBuildNameSchema } from '@shared/api'

/** A free build name from a schematic file name ("My House (2).litematic" → "my_house_2"), or ''. */
export function nameFromFile(file: string, taken: string[]): string {
  const stem = file
    .replace(/\.[^.]*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const name = /^[a-z]/.test(stem) ? stem : stem && `build_${stem}`
  return NewBuildNameSchema.safeParse(name).success && !taken.includes(name) ? name : ''
}
