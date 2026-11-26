// What the reference board does to a saved ref: update note/url, copy image, delete it.
import { toast } from 'sonner'
import type { Ref, RefUpdate } from '@shared/api'
import { studio } from '@/shared/api/studio'
import { fetchImageBytes } from '@/shared/lib/image-clipboard'
import { errorText } from '@/entities/build/model/workspace'
import { refreshRefs, useChatRefs } from '@/entities/ref/model/refs'

export async function saveNote(name: string, r: Ref, note: string): Promise<boolean> {
  const trimmed = note.trim()
  if (trimmed === r.note) return true
  try {
    await studio.refs.note(name, r.id, trimmed)
    await refreshRefs(name)
    return true
  } catch (e) {
    toast.error(errorText(e))
    return false
  }
}

export async function updateRefItem(name: string, r: Ref, patch: RefUpdate): Promise<boolean> {
  try {
    await studio.refs.update(name, r.id, patch)
    await refreshRefs(name)
    return true
  } catch (e) {
    toast.error(errorText(e))
    return false
  }
}

export async function removeRef(name: string, r: Ref): Promise<boolean> {
  try {
    useChatRefs.getState().remove(name, r.id)
    await studio.refs.remove(name, r.id)
    await refreshRefs(name)
    return true
  } catch (e) {
    toast.error(errorText(e))
    return false
  }
}

export async function copyRefImage(src: string): Promise<void> {
  try {
    const bytes = await fetchImageBytes(src)
    await studio.render.copyImage(bytes)
    toast.success('Image copied to clipboard')
  } catch (e) {
    toast.error(errorText(e))
  }
}
