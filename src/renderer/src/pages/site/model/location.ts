// The Site screen's state and bridge calls: remembered world and map area, regions, the map, its heights, and terrain.npz.
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { BridgeMethods } from '@shared/api'
import { studio } from '@/shared/api/studio'
import { buildUrl } from '@/shared/lib/urls'
import { errorText } from '@/entities/build/model/workspace'
import { mapBox, norm, type Box } from '@/entities/site/model/site'

type SiteMap = BridgeMethods['site_map']['result']
const MARGIN = 48

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads all of it
export function useSiteLocation(name: string, target: string) {
  const key = `site:${name}` // per-viewer memory of the last world and map
  const saved = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '{}') as {
        world?: string
        center?: number[]
        side?: number
      }
    } catch {
      return {}
    }
  }, [key])
  const worlds = useQuery({ queryKey: ['worlds'], queryFn: () => studio.site.worlds() })
  const [world, setWorld] = useState(saved.world ?? '')
  const [center, setCenter] = useState<number[]>(saved.center ?? [0, 0])
  const [side, setSide] = useState(saved.side ?? 512)
  const [map, setMap] = useState<SiteMap | null>(null)
  const [box, setBox] = useState<Box | null>(null)
  const [margin, setMargin] = useState(MARGIN)
  const [confirm, setConfirm] = useState(false)
  const [written, setWritten] = useState('')
  const [setupOpen, setSetupOpen] = useState(false)
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ world, center, side }))
    } catch {
      /* private window: no memory */
    }
  }, [key, world, center, side])

  const regions = useQuery({
    queryKey: ['site_regions', world, target],
    queryFn: () => studio.bridge.call('site_regions', { world }, undefined, target),
    enabled: !!world
  })
  const area = mapBox(center, side)
  const draw = useMutation({
    mutationFn: () => studio.bridge.call('site_map', { world, box: area }, undefined, target),
    onSuccess: (m) => {
      setMap(m)
      setBox(null)
      setSetupOpen(false)
    },
    onError: (e) => toast.error(`Couldn’t map the area: ${errorText(e)}`)
  })
  const heights = useQuery({
    queryKey: ['heights', map?.heights, draw.submittedAt],
    queryFn: async () =>
      new Int16Array(await (await fetch(buildUrl(map!.heights, draw.submittedAt))).arrayBuffer()),
    enabled: !!map
  })
  const write = useMutation({
    mutationFn: (overwrite: boolean) =>
      studio.bridge.call(
        'site_terrain',
        {
          world,
          box: norm(box!),
          build: name,
          margin,
          overwrite
        },
        undefined,
        target
      ),
    onSuccess: (r) => {
      if (r.exists) return setConfirm(true)
      const cols = `${r.shape?.join(' × ')} columns`
      const ground = r.inside
        ? `, ground y ${r.inside[0]}..${r.inside[1]} (median ${r.inside[2]})`
        : ''
      const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      setWritten(`Written ${time}: ${cols}${ground}.`)
      toast.success(
        `Wrote ${r.path}: ${cols}${ground}${r.missing ? `, ${r.missing} without a chunk` : ''}`
      )
    },
    onError: (e) => toast.error(`Couldn’t write terrain.npz: ${errorText(e)}`)
  })

  async function pickOther(): Promise<void> {
    const p = await studio.site.pick()
    if (p) setWorld(p)
  }

  return {
    worlds,
    world,
    setWorld,
    center,
    setCenter,
    side,
    setSide,
    map,
    box,
    setBox,
    margin,
    setMargin,
    confirm,
    setConfirm,
    written,
    setupOpen,
    setSetupOpen,
    regions,
    area,
    draw,
    heights,
    write,
    pickOther
  }
}
