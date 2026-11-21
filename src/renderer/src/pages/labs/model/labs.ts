// What Labs reads besides the bridge tools: the remembered tab, docs/catalog.md and the prefab index.
import { useState } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { assetUrl, buildUrl } from '@/shared/lib/urls'

export interface Piece {
  id: string
  file: string
  category: string
  kind: string
  size: number[]
  blocks: number
  top: string[]
  warnings: string[]
  number: number
  sheet: string
}

export function useLabsTab(): { tab: string; pick: (t: string) => void } {
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem('labs:tab') ?? 'palette'
    } catch {
      return 'palette'
    }
  })
  const pick = (t: string): void => {
    setTab(t)
    try {
      localStorage.setItem('labs:tab', t)
    } catch {
      /* private window: no memory */
    }
  }
  return { tab, pick }
}

export function useCatalogDoc(cat: { doc: string } | undefined): UseQueryResult<string> {
  return useQuery({
    queryKey: ['catalog-md', cat?.doc],
    queryFn: async () => {
      const res = await fetch(buildUrl(cat!.doc))
      // an error page is not the catalog
      if (!res.ok) throw new Error(`${res.status} ${res.statusText || 'error'} reading ${cat!.doc}`)
      return res.text()
    },
    enabled: !!cat
  })
}

export function usePrefabIndex(): UseQueryResult<{
  pieces: Piece[]
  summary: Record<string, number>
}> {
  return useQuery({
    queryKey: ['prefabs'],
    queryFn: async () => {
      const res = await fetch(assetUrl('index.json'))
      if (!res.ok) throw new Error('file not found')
      return (await res.json()) as { pieces: Piece[]; summary: Record<string, number> }
    }
  })
}
