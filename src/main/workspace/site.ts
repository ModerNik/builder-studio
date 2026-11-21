// Site picker: the world saves to choose from. Only folder listings here; the bridge reads copies of region files.
import { existsSync } from 'fs'
import { readdir } from 'fs/promises'
import { dirname, join } from 'path'

export interface World {
  name: string
  path: string
}

/** The saves folders worth looking in: next to the Litematica schematics folder, then the default launcher's. */
export function savesDirs(schematics: string, appData: string): string[] {
  const dirs = [schematics && join(dirname(schematics), 'saves'), join(appData, '.minecraft', 'saves')]
  return [...new Set(dirs.filter((d) => d && existsSync(d)))]
}

/** Folders with a level.dat, by name. */
export async function listWorlds(dirs: string[]): Promise<World[]> {
  const out: World[] = []
  for (const d of dirs)
    for (const e of await readdir(d, { withFileTypes: true }).catch(() => []))
      if (e.isDirectory() && existsSync(join(d, e.name, 'level.dat'))) out.push({ name: e.name, path: join(d, e.name) })
  return out.sort((a, b) => a.name.localeCompare(b.name))
}
