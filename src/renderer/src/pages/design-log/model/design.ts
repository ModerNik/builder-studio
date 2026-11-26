// The Design log's reads, writes, file reveal, and sheet clipboard copy.
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryClient, studio } from '@/shared/api/studio'
import { fetchImageBytes } from '@/shared/lib/image-clipboard'
import { errorText } from '@/entities/build/model/workspace'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the screen reads both queries
export function useDesignLog(name: string) {
  const md = useQuery({
    queryKey: ['design', name],
    queryFn: () => studio.design.read(name)
  })
  const rounds = useQuery({
    queryKey: ['rounds', name],
    queryFn: () => studio.review.list(name)
  })
  return { md, rounds }
}

export const writeDesign = (name: string, base: string, md: string): Promise<void> =>
  studio.design.write(name, base, md)

export function designSaved(name: string): void {
  void queryClient.invalidateQueries({ queryKey: ['design', name] })
  void queryClient.invalidateQueries({ queryKey: ['rounds', name] })
  void queryClient.invalidateQueries({ queryKey: ['builds'] })
}

export async function revealDesign(name: string): Promise<void> {
  try {
    await studio.design.reveal(name)
  } catch (e) {
    toast.error(errorText(e))
  }
}

export async function copySheetImage(src: string): Promise<void> {
  try {
    const bytes = await fetchImageBytes(src)
    await studio.render.copyImage(bytes)
    toast.success('Sheet copied to clipboard')
  } catch (e) {
    toast.error(errorText(e))
  }
}
