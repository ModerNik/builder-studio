// The Browse… dialogs settings fields open.
import { studio } from '@/shared/api/studio'

export const pickPath = (browse: 'file' | 'folder', start: string): Promise<string | null> =>
  browse === 'file' ? studio.setup.pickFile(start) : studio.workspace.pick(start)
