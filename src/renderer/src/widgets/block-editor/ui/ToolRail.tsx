// The tool rail (DESIGN › Tool rail): Undo and Redo, then the Editor's tools in their groups, down the
// viewer's start edge.
import { Fragment, type ReactElement } from 'react'
import { Redo2, Undo2, type LucideIcon } from 'lucide-react'
import { Tip } from '@/shared/ui/common/Tip'
import { Shortcut } from '@/shared/ui/primitives/kbd'
import {
  ViewerToolbar,
  ViewerToolbarButton,
  ViewerToolbarSeparator
} from '@/entities/viewer/ui/ViewerOverlay'
import type { ToolId } from '@/entities/block-edit/model/edit'
import { TOOL_GROUPS } from '../model/tools'

export function ToolRail({
  tool,
  onTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}: {
  tool: ToolId
  onTool: (tool: ToolId) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}): ReactElement {
  return (
    <ViewerToolbar label="Edit tools" orientation="vertical">
      <RailButton label="Undo" keys="Ctrl+Z" icon={Undo2} disabled={!canUndo} onClick={onUndo} />
      <RailButton label="Redo" keys="Ctrl+Y" icon={Redo2} disabled={!canRedo} onClick={onRedo} />
      {TOOL_GROUPS.map((group) => (
        <Fragment key={group[0].id}>
          <ViewerToolbarSeparator />
          {group.map((t) => (
            <RailButton
              key={t.id}
              label={t.label}
              keys={t.keys}
              icon={t.icon}
              pressed={tool === t.id}
              variants={t.variants}
              onClick={() => onTool(t.id)}
            />
          ))}
        </Fragment>
      ))}
    </ViewerToolbar>
  )
}

function RailButton({
  label,
  keys,
  icon: Icon,
  pressed,
  variants,
  disabled,
  onClick
}: {
  label: string
  keys?: string
  icon: LucideIcon
  /** A tool: whether it is the active one. Leave it out for actions. */
  pressed?: boolean
  variants?: boolean
  disabled?: boolean
  onClick: () => void
}): ReactElement {
  return (
    <Tip
      side="right"
      label={
        <>
          {label}
          {keys && <Shortcut keys={keys} />}
        </>
      }
    >
      <ViewerToolbarButton
        aria-label={label}
        aria-pressed={pressed}
        aria-keyshortcuts={keys?.replace('Ctrl', 'Control')}
        disabled={disabled}
        onClick={onClick}
        className="relative w-(--density-control-sm) px-0 aria-pressed:bg-accent-subtle"
      >
        <Icon aria-hidden="true" />
        {variants && (
          // the mark for a tool with variants (brush shapes, line or box): a corner triangle
          <span
            aria-hidden="true"
            className="absolute end-0.5 bottom-0.5 size-1 bg-current [clip-path:polygon(100%_0,100%_100%,0_100%)]"
          />
        )}
      </ViewerToolbarButton>
    </Tip>
  )
}
