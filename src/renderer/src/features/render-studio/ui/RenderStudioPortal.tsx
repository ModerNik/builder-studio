// Lazy host mounted in Shell so Three.js and the cinematic shader stack load only when Render Studio opens.
import { lazy, Suspense, type ReactElement } from 'react'
import { useRenderStudio } from '../model/store'

const LazyRenderStudio = lazy(() =>
  import('./RenderStudioLightbox').then((m) => ({ default: m.RenderStudioHost }))
)

export function RenderStudioPortal(): ReactElement | null {
  const active = useRenderStudio((s) => s.open || s.launch !== null)
  if (!active) return null
  return (
    <Suspense fallback={null}>
      <LazyRenderStudio />
    </Suspense>
  )
}
