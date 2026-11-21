import type { ReactElement } from 'react'
import { CopyIcon, MoreHorizontalIcon, RedoIcon, SettingsIcon, Trash2Icon, UndoIcon } from 'lucide-react'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import { forceFocus, Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Actions', title: 'Icon button' }

export default function IconButtonSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens title="States (hover or Tab to see the tooltip)">
        <Specimen label="ghost (default)">
          <IconButton label="Undo" shortcut="Ctrl+Z">
            <UndoIcon />
          </IconButton>
        </Specimen>
        <Specimen label="hover">
          <IconButton label="Redo" className="bg-surface-hover text-fg">
            <RedoIcon />
          </IconButton>
        </Specimen>
        <Specimen label="focus">
          <IconButton label="Copy path" className={forceFocus} tabIndex={-1}>
            <CopyIcon />
          </IconButton>
        </Specimen>
        <Specimen label="disabled (no tooltip)">
          <IconButton label="Redo" disabled>
            <RedoIcon />
          </IconButton>
        </Specimen>
        <Specimen label="loading">
          <IconButton label="Saving" loading>
            {null}
          </IconButton>
        </Specimen>
        <Specimen label="open menu (data-state)">
          <IconButton label="More actions" data-state="open">
            <MoreHorizontalIcon />
          </IconButton>
        </Specimen>
      </Specimens>
      <Specimens title="Variants and sizes">
        <Specimen label="outline">
          <IconButton label="Settings" variant="outline">
            <SettingsIcon />
          </IconButton>
        </Specimen>
        <Specimen label="secondary">
          <IconButton label="Settings" variant="secondary">
            <SettingsIcon />
          </IconButton>
        </Specimen>
        <Specimen label="destructive">
          <IconButton label="Delete version" variant="destructive">
            <Trash2Icon />
          </IconButton>
        </Specimen>
        <Specimen label="icon-xs">
          <IconButton label="Copy" size="icon-xs">
            <CopyIcon />
          </IconButton>
        </Specimen>
        <Specimen label="icon-sm">
          <IconButton label="Copy" size="icon-sm">
            <CopyIcon />
          </IconButton>
        </Specimen>
        <Specimen label="icon-lg">
          <IconButton label="Copy" size="icon-lg">
            <CopyIcon />
          </IconButton>
        </Specimen>
      </Specimens>
      <Guidance>
        `label` is required by the type: it is both the aria-label and the tooltip, so an icon button can
        never ship unnamed. Do not use `title`. A disabled button shows no tooltip, so never put the only
        explanation of why it is disabled there; say it next to the control.
      </Guidance>
    </div>
  )
}
