// Proto options per build, remembered between runs (a per-machine convenience, so localStorage).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { studio } from '@/shared/api/studio'
import { toast } from 'sonner'
import { jobFeature } from '@shared/availability'

export interface RunOptions {
  name?: string
  x0?: number
  z0?: number
  sx?: number
  sz?: number
  seed?: number
  views?: string
  look?: 'game' | 'sun' | 'flat'
  noRender?: boolean
}

interface Store {
  byBuild: Record<string, RunOptions>
  set(build: string, o: RunOptions): void
  rename(from: string, to: string): void
}

export const useRunOptions = create<Store>()(
  persist(
    (set) => ({
      byBuild: {},
      set: (build, o) => set((s) => ({ byBuild: { ...s.byBuild, [build]: o } })),
      rename: (from, to) =>
        set(({ byBuild: { [from]: o, ...rest } }) => ({ byBuild: o ? { ...rest, [to]: o } : rest }))
    }),
    { name: 'run-options', partialize: (s) => ({ byBuild: s.byBuild }) }
  )
)

/** Start a build job. Full writes outside the repo (the schematics folder), so it asks first, and it builds
 *  the whole thing under the build's own name: the proto's name and window don't apply. */
export async function runJob(
  build: string,
  part: 'proto' | 'check' | 'full',
  o: RunOptions
): Promise<void> {
  try {
    const spec =
      part === 'full'
        ? { build, part, views: o.views, look: o.look }
        : { ...o, noRender: part === 'proto' && o.noRender, build, part }
    const availability = await studio.availability.get()
    const missing = availability.features[jobFeature(spec)].missing
    if (missing.length)
      throw new Error(
        missing
          .map(
            (name) =>
              `${availability.requirements[name].detail} (Settings → ${availability.requirements[name].repair})`
          )
          .join('\n')
      )
    if (part === 'full') {
      if (
        !confirm(
          `Full build of ${build}: the whole build, a bill, and a copy into the schematics folder. Run it?`
        )
      )
        return
      await studio.jobs.run(spec)
    } else await studio.jobs.run(spec)
  } catch (e) {
    toast.error(String(e))
  }
}
