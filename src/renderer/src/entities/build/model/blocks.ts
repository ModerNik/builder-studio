import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { resourceUrl } from '@/shared/lib/urls'

/** The block's mean texture colour, from the installed measured-color resource. */
export function useBlockColors(): UseQueryResult<Record<string, number[]>> {
  return useQuery({
    queryKey: ['block_colors'],
    queryFn: async () =>
      (
        (await (await fetch(resourceUrl('lib/mcb/data/block_colors.json'))).json()) as {
          colors: Record<string, number[]>
        }
      ).colors
  })
}

/** A lookup of a block's CSS colour for the kit's Swatch and BlockChip; id with or without minecraft: and properties. */
export function useBlockColor(): (id: string) => string | null {
  const colors = useBlockColors().data
  return (id) => blockColor(colors, id)
}

/** A block's CSS colour from the measured colours, or null when it has none. */
export function blockColor(
  colors: Record<string, number[]> | undefined,
  id: string
): string | null {
  const c = colors?.[(id.includes(':') ? id : `minecraft:${id}`).split('[')[0]]
  return c ? `rgb(${c.map((v) => Math.round(v * 255)).join(',')})` : null
}
