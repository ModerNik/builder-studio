import { cn } from '@/shared/lib/utils'
import { chromeButton } from '@/shared/ui/common/styles'

/** A glass toolbar's button: compact, with a label at text-base. */
export const viewerToolButton = cn(
  chromeButton,
  'h-(--density-control-sm) min-w-(--density-control-sm) px-1.5 text-base'
)
