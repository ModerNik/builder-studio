// What the reference board does to a saved ref: change its note, delete it.
import { toast } from 'sonner'
import type { Ref } from '@shared/api'
import { studio } from '@/shared/api/studio'
import { errorText } from '@/entities/build/model/workspace'
import { refreshRefs } from '@/entities/ref/model/refs'

export const saveNote = (name: string, r: Ref, note: string): void => {
  if (note.trim() === r.note) return
  void studio.refs
    .note(name, r.id, note)
    .then(() => refreshRefs(name))
    .catch((e) => toast.error(errorText(e)))
}

export const removeRef = async (name: string, r: Ref): Promise<void> => {
  await studio.refs.remove(name, r.id).catch((e) => toast.error(errorText(e)))
  void refreshRefs(name)
}
