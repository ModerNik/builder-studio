import type { ReactElement } from 'react'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Display', title: 'Skeleton' }

export default function SkeletonSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="gallery tile">
          <div role="status" aria-label="Loading builds" className="flex w-48 flex-col gap-2">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </Specimen>
        <Specimen label="rows">
          <div role="status" aria-label="Loading versions" className="flex w-64 flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="size-7 rounded-full" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        </Specimen>
      </Specimens>
      <Guidance>
        Skeletons are hidden from screen readers; give the container role=&quot;status&quot; and a label. They pulse,
        and stand still under reduced motion.
      </Guidance>
    </div>
  )
}
