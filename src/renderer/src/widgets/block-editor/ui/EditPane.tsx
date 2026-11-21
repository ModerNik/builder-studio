// The Editor's Edit tab (DESIGN › Edit tab): the tool and its options, the block to place with its state, the
// block picker and History, in one scrolling pane. Select has no section: the tool HUD shows what it selected.
import type { ReactElement } from 'react'
import { BlockPicker } from '@/entities/block/ui/BlockPicker'
import { BlockStateEditor } from '@/entities/block/ui/BlockStateEditor'
import { fullState } from '@/entities/block/model/registry'
import { RulerReadout } from '@/features/block-tools/ruler/ui/RulerReadout'
import type { BlockEditor } from '../model/editor'
import { toolOf } from '../model/tools'
import { HistoryList } from './HistoryList'
import { ToolOptions } from './ToolOptions'

const section = 'flex flex-col gap-2 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0'

export function EditPane({
  editor: e,
  build
}: {
  editor: BlockEditor
  build: string
}): ReactElement {
  const tool = toolOf(e.tool)
  const block = e.place
  return (
    <div className="flex flex-col gap-4">
      {e.tool !== 'select' && (
        <>
          <section className="flex flex-col gap-1">
            <h2 className="font-medium">{tool.label}</h2>
            <p className="text-sm text-fg-secondary">{tool.hint}</p>
            <ToolOptions
              tool={e.tool}
              options={e.options}
              onChange={e.setOptions}
              transform={e.transform}
            />
            {e.tool === 'ruler' && <RulerReadout measure={e.ruler} onClear={e.clearRuler} />}
          </section>
          <section className={section} aria-live="polite">
            <h3 className="font-medium">Block</h3>
            {block ? (
              <BlockStateEditor
                block={block.info}
                props={block.props}
                onChange={(props) => e.setPlace({ info: block.info, props })}
                icon={e.icon(fullState(block.info, block.props))}
                color={e.color(block.info.id)}
                favourite={e.favourites.includes(block.info.id)}
                onFavourite={() => e.toggleFavourite(block.info.id)}
              />
            ) : (
              <p className="text-sm text-fg-secondary">
                Pick a block below, or Alt-click one in the build.
              </p>
            )}
          </section>
        </>
      )}
      <section className={section}>
        <h3 className="font-medium">Blocks</h3>
        <BlockPicker
          blocks={e.blocks}
          recent={e.recent}
          value={e.place?.info.id ?? null}
          onChange={(info) => {
            e.setPlace({ info, props: {} })
            if (!tool.block) e.setTool('place')
          }}
          icon={e.icon}
          color={e.color}
          className="w-full"
        />
      </section>
      <HistoryList
        className={section}
        edits={e.history.edits}
        cursor={e.history.cursor}
        onJump={e.jumpTo}
        onUndo={e.undo}
        onRedo={e.redo}
        handEdits={e.history.layer.size}
        onDiscard={e.discard}
        build={build}
      />
    </div>
  )
}
